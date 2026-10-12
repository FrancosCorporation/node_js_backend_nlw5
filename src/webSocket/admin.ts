import { isUUID } from "validator";
import { config, io } from "../http";
import { ConnectionService } from "../Service/ConnectionsService";
import { MessagesService } from "../Service/MessagesService";
import { disconnectSocketAtExpiry } from "../security/disconnectSocketAtExpiry";
import { allowSocketEvent } from "../security/socketRateLimit";
import { verifyTokenSession } from "../security/tokens";

interface UserPayload {
  user_id?: unknown;
}

interface AdminMessagePayload extends UserPayload {
  text?: unknown;
}

const adminNamespace = io.of("/admin");

adminNamespace.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (typeof token !== "string")
    return next(new Error("Autenticação de atendente necessária."));

  try {
    const session = verifyTokenSession(token, config.jwtSecret, "admin");
    if (session.subject !== config.adminId)
      return next(new Error("Atendente inválido."));
    socket.data.adminId = session.subject;
    socket.data.tokenExpiresAt = session.expiresAt;
    return next();
  } catch {
    return next(new Error("Token de atendente inválido ou expirado."));
  }
});

adminNamespace.on("connection", (socket) => {
  const adminId = socket.data.adminId;
  if (!adminId) {
    socket.disconnect(true);
    return;
  }
  if (typeof socket.data.tokenExpiresAt !== "number") {
    socket.disconnect(true);
    return;
  }
  disconnectSocketAtExpiry(socket, socket.data.tokenExpiresAt);

  const connectionsService = new ConnectionService();
  const messagesService = new MessagesService();
  void socket.join(adminId);

  const emitVisibleConnections = async (): Promise<void> => {
    socket.emit(
      "admin_list_all_users",
      await connectionsService.findVisibleToAdmin(adminId),
    );
  };

  void emitVisibleConnections().catch((error: unknown) => {
    console.error("Falha ao listar conversas para atendente:", error);
    socket.emit("chat_error", {
      error: "Não foi possível carregar as conversas.",
    });
  });

  socket.on("admin_list_all_users", async () => {
    if (!allowSocketEvent(socket, 120)) return;
    try {
      await emitVisibleConnections();
    } catch (error) {
      console.error("Falha ao atualizar conversas do atendente:", error);
      socket.emit("chat_error", {
        error: "Não foi possível atualizar as conversas.",
      });
    }
  });

  socket.on(
    "admin_user_in_support",
    async (
      params: UserPayload,
      acknowledge?: (result: { error?: string }) => void,
    ) => {
      if (!allowSocketEvent(socket, 60))
        return acknowledge?.({ error: "Aguarde antes de tentar novamente." });
      const userId = typeof params?.user_id === "string" ? params.user_id : "";
      if (!isUUID(userId))
        return acknowledge?.({ error: "Identificador de usuário inválido." });

      try {
        const connection = await connectionsService.findByUserId(userId);
        if (!connection)
          return acknowledge?.({ error: "Conversa não encontrada." });
        const existingAdminId = connection.admin_id;
        const isLegacyAssignment =
          existingAdminId !== null && !isUUID(existingAdminId);
        if (
          existingAdminId &&
          existingAdminId !== adminId &&
          !isLegacyAssignment
        ) {
          return acknowledge?.({
            error: "Esta conversa já está atribuída a outro atendente.",
          });
        }

        await connectionsService.updateAdminId(userId, adminId);
        await emitVisibleConnections();
        acknowledge?.({});
      } catch (error) {
        console.error("Falha ao assumir conversa:", error);
        acknowledge?.({ error: "Não foi possível assumir esta conversa." });
      }
    },
  );

  socket.on(
    "admin_list_messages_by_user",
    async (
      params: UserPayload,
      acknowledge?: (messages: unknown[]) => void,
    ) => {
      if (!allowSocketEvent(socket, 120)) return acknowledge?.([]);
      const userId = typeof params?.user_id === "string" ? params.user_id : "";
      if (!isUUID(userId)) return acknowledge?.([]);

      try {
        const connection = await connectionsService.findByUserId(userId);
        if (!connection || connection.admin_id !== adminId)
          return acknowledge?.([]);
        acknowledge?.(await messagesService.listByUser(userId));
      } catch (error) {
        console.error("Falha ao listar mensagens da conversa:", error);
        acknowledge?.([]);
      }
    },
  );

  socket.on("admin_send_message", async (params: AdminMessagePayload) => {
    if (!allowSocketEvent(socket)) return;
    const userId = typeof params?.user_id === "string" ? params.user_id : "";
    const text = typeof params?.text === "string" ? params.text.trim() : "";
    if (!isUUID(userId) || !text || text.length > 2000) {
      socket.emit("chat_error", {
        error: "Informe uma conversa e uma mensagem válidas.",
      });
      return;
    }

    try {
      const connection = await connectionsService.findByUserId(userId);
      if (!connection || connection.admin_id !== adminId) {
        socket.emit("chat_error", {
          error: "Assuma esta conversa antes de responder.",
        });
        return;
      }

      const message = await messagesService.create({
        admin_id: adminId,
        text,
        user_id: userId,
      });
      if (connection.socket_id) {
        io.of("/client")
          .to(connection.socket_id)
          .emit("admin_send_to_client", { message });
      }
      socket.emit("admin_message_sent", { user_id: userId, message });
    } catch (error) {
      console.error("Falha ao enviar mensagem de atendente:", error);
      socket.emit("chat_error", {
        error: "Não foi possível enviar a mensagem.",
      });
    }
  });

  socket.on("disconnect", async () => {
    try {
      const remainingSockets = await adminNamespace.in(adminId).fetchSockets();
      if (remainingSockets.length === 0)
        await connectionsService.releaseAdmin(adminId);
    } catch (error) {
      console.error("Falha ao liberar conversas do atendente:", error);
    }
  });
});
