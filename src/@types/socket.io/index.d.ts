import "socket.io";

declare module "socket.io" {
  interface SocketData {
    adminId?: string;
    userId?: string;
    firstAccessInProgress?: boolean;
    messageWindowStartedAt?: number;
    messagesInWindow?: number;
  }
}
