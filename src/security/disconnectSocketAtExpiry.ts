import type { Socket } from "socket.io";

const MAX_TIMEOUT_MS = 2_147_483_647;
const expiryTimers = new WeakMap<Socket, NodeJS.Timeout>();
const disconnectCleanupRegistered = new WeakSet<Socket>();

export function disconnectSocketAtExpiry(
  socket: Socket,
  expiresAt: number,
): void {
  const previousTimer = expiryTimers.get(socket);
  if (previousTimer) clearTimeout(previousTimer);

  if (!disconnectCleanupRegistered.has(socket)) {
    disconnectCleanupRegistered.add(socket);
    socket.once("disconnect", () => {
      const timer = expiryTimers.get(socket);
      if (timer) clearTimeout(timer);
      expiryTimers.delete(socket);
    });
  }

  const disconnectWhenExpired = (): void => {
    const remainingMs = expiresAt * 1000 - Date.now();
    if (remainingMs <= 0) {
      expiryTimers.delete(socket);
      socket.disconnect(true);
      return;
    }

    const timer = setTimeout(
      disconnectWhenExpired,
      Math.min(remainingMs, MAX_TIMEOUT_MS),
    );
    timer.unref();
    expiryTimers.set(socket, timer);
  };

  disconnectWhenExpired();
}
