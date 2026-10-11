import { isEmail } from "validator";
import type { Socket } from "socket.io";
import { config, io } from "../http";
import { ConnectionService } from "../Service/ConnectionsService";
import { MessagesService } from "../Service/MessagesService";
import { UsersService } from "../Service/UsersService";
import { allowSocketEvent } from "../security/socketRateLimit";
import { createToken, verifyToken } from "../security/tokens";

interface FirstAccessPayload {
  email?: unknown;
  text?: unknown;
}

interface MessagePayload {
  text?: unknown;
}

const clientNamespace = io.of("/client");
const adminNamespace = io.of("/admin");

clientNamespace.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token === undefined || token === null || token === "") return next();
  if (typeof token !== "string") return next(new Error("Sessão inválida."));

  try {
    socket.data.userId = verifyToken(token, config.jwtSecret, "client");
    return next();
  } catch {
    return next(new Error("Sessão inválida ou expirada."));
  }
});

function emitClientError(socket: Socket, message: string): void {
  socket.emit("chat_error", { error: message });
}

clientNamespace.on("connection", (socket) => {
  const connectionsService = new ConnectionService();
  const usersService = new UsersService();
  const messagesService = new MessagesService();

  const resumeSession = async (): Promise<void> => {
    const userId = socket.data.userId;
    if (!userId) {
      emitClientError(socket, "Inicie uma conversa para continuar.");
      return;
    }

    const user = await usersService.findById(userId);
    if (!user) {
      socket.data.userId = undefined;
      emitClientError(
        socket,
        "Esta sessão não está mais disponível. Inicie uma nova conversa.",
      );
      return;
    }

    await connectionsService.connectUser(socket.id, userId);
    socket.emit("client_session", {
      token: createToken("client", userId, config.jwtSecret),
      email: user.email,
    });
    socket.emit(
      "client_list_all_messages",
      await messagesService.listByUser(userId),
    );
  };

  socket.on("client_resume", async () => {
    if (!allowSocketEvent(socket, 10)) return;
    try {
      await resumeSession();
    } catch (error) {
      console.error("Falha ao retomar sessão de cliente:", error);
      emitClientError(socket, "Não foi possível carregar sua conversa.");
    }
  });

  socket.on(
    "client_first_access",
    async (
      params: FirstAccessPayload,
      acknowledge?: (result: { error?: string }) => void,
    ) => {
      if (!allowSocketEvent(socket, 10))
        return acknowledge?.({ error: "Aguarde antes de tentar novamente." });
      if (socket.data.firstAccessInProgress)
        return acknowledge?.({ error: "A conversa já está sendo iniciada." });
      socket.data.firstAccessInProgress = true;

      try {
        if (socket.data.userId) {
          await resumeSession();
          acknowledge?.({});
          return;
        }

        const email =
          typeof params?.email === "string"
            ? params.email.trim().toLowerCase()
            : "";
        const text = typeof params?.text === "string" ? params.text.trim() : "";
        if (!isEmail(email) || email.length > 254) {
          return acknowledge?.({
            error: "Informe um endereço de e-mail válido.",
          });
        }
        if (!text || text.length > 250) {
          return acknowledge?.({
            error: "Escreva uma mensagem inicial de até 250 caracteres.",
          });
        }

        // A new browser session always receives a new user ID. Email alone never
        // selects an existing account or grants access to its conversation.
        const user = await usersService.create(email);
        socket.data.userId = user.id;
        await connectionsService.connectUser(socket.id, user.id);
        await messagesService.create({
          admin_id: null,
          text,
          user_id: user.id,
        });

        const token = createToken("client", user.id, config.jwtSecret);
        socket.emit("client_session", { token, email: user.email });
        socket.emit(
          "client_list_all_messages",
          await messagesService.listByUser(user.id),
        );
        adminNamespace.emit(
          "admin_list_all_users",
          await connectionsService.findAvailableForAdmin(),
        );
        acknowledge?.({});
      } catch (error) {
        console.error("Falha ao iniciar conversa de cliente:", error);
        acknowledge?.({
          error: "Não foi possível iniciar a conversa. Tente novamente.",
        });
      } finally {
        socket.data.firstAccessInProgress = false;
      }
    },
  );

  socket.on("client_send_to_admin", async (params: MessagePayload) => {
    if (!allowSocketEvent(socket)) return;
    const userId = socket.data.userId;
    const text = typeof params?.text === "string" ? params.text.trim() : "";
    if (!userId || !text || text.length > 2000) {
      emitClientError(socket, "Sua sessão expirou ou a mensagem é inválida.");
      return;
    }

    try {
      const connection = await connectionsService.findByUserId(userId);
      if (!connection || connection.socket_id !== socket.id) {
        emitClientError(
          socket,
          "Não foi possível localizar sua conexão. Recarregue a conversa.",
        );
        return;
      }

      const message = await messagesService.create({
        admin_id: null,
        text,
        user_id: userId,
      });
      socket.emit("client_message_sent", message);
      if (connection.admin_id) {
        const activeAdmins = await adminNamespace
          .in(connection.admin_id)
          .fetchSockets();
        if (activeAdmins.length === 0)
          await connectionsService.updateAdminId(userId, null);
        else {
          adminNamespace.to(connection.admin_id).emit("admin_receive_message", {
            connection,
            message,
            socket_id: socket.id,
          });
          return;
        }
      }

      adminNamespace.emit("admin_receive_message", {
        connection,
        message,
        socket_id: socket.id,
      });
      adminNamespace.emit(
        "admin_list_all_users",
        await connectionsService.findAvailableForAdmin(),
      );
    } catch (error) {
      console.error("Falha ao enviar mensagem de cliente:", error);
      emitClientError(socket, "Não foi possível enviar sua mensagem.");
    }
  });

  socket.on("disconnect", () => {
    const userId = socket.data.userId;
    if (userId)
      void connectionsService
        .clearSocket(userId, socket.id)
        .catch((error: unknown) => {
          console.error("Falha ao encerrar conexão de cliente:", error);
        });
  });
});
