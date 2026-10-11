import type { Socket } from "socket.io";

export function allowSocketEvent(socket: Socket, maxPerMinute = 60): boolean {
  const now = Date.now();
  const startedAt = socket.data.messageWindowStartedAt ?? now;

  if (now - startedAt >= 60_000) {
    socket.data.messageWindowStartedAt = now;
    socket.data.messagesInWindow = 0;
  } else if (socket.data.messageWindowStartedAt === undefined) {
    socket.data.messageWindowStartedAt = now;
  }

  const count = socket.data.messagesInWindow ?? 0;
  if (count >= maxPerMinute) {
    socket.emit("chat_error", {
      error: "Você enviou muitas solicitações. Aguarde um minuto.",
    });
    return false;
  }

  socket.data.messagesInWindow = count + 1;
  return true;
}
