import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import { createServer, type IncomingMessage } from "node:http";
import path from "node:path";
import { Server, type ServerOptions } from "socket.io";
import { AppDataSource } from "./DataBase";
import { loadConfig } from "./config";
import { ApiError } from "./errors/ApiError";
import { createRoutes } from "./routes";

export const config = loadConfig();
const publicDirectory = path.resolve(__dirname, "..", "public");
const app = express();

app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'", "ws:", "wss:"],
        fontSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        upgradeInsecureRequests: null,
      },
    },
  }),
);
app.use(express.json({ limit: "32kb" }));

app.get("/health", (_request, response) => {
  const ready = AppDataSource.isInitialized;
  return response
    .status(ready ? 200 : 503)
    .json({ status: ready ? "ok" : "unavailable" });
});
app.get("/client", (_request, response) =>
  response.sendFile(path.join(publicDirectory, "html/client.html")),
);
app.get("/admin", (_request, response) =>
  response.sendFile(path.join(publicDirectory, "html/admin.html")),
);
app.use(express.static(publicDirectory, { dotfiles: "ignore", index: false }));
app.use(createRoutes(config));
app.use((_request, response) =>
  response.status(404).json({ error: "Rota não encontrada." }),
);

const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  void _next;
  if (error instanceof ApiError) {
    return response.status(error.statusCode).json({ error: error.message });
  }

  if (typeof error === "object" && error !== null && "type" in error) {
    if (error.type === "entity.parse.failed") {
      return response
        .status(400)
        .json({ error: "O corpo da requisição contém JSON inválido." });
    }
    if (error.type === "entity.too.large") {
      return response
        .status(413)
        .json({ error: "O corpo da requisição excede 32 KB." });
    }
  }

  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return response.status(409).json({ error: "O registro já existe." });
    }
  }

  console.error("Unhandled request error:", error);
  return response.status(500).json({ error: "Erro interno do servidor." });
};
app.use(errorHandler);

const http = createServer(app);

interface ConnectionWindow {
  startedAt: number;
  count: number;
}

const connectionWindows = new Map<string, ConnectionWindow>();
const connectionWindowMs = 15 * 60 * 1000;
const maxConnectionsPerWindow = 60;

const allowSocketConnection: NonNullable<ServerOptions["allowRequest"]> = (
  request: IncomingMessage,
  callback,
) => {
  const address = request.socket.remoteAddress ?? "unknown";
  const now = Date.now();
  let window = connectionWindows.get(address);

  if (!window || now - window.startedAt >= connectionWindowMs) {
    window = { startedAt: now, count: 0 };
    connectionWindows.set(address, window);
  }

  window.count += 1;
  if (connectionWindows.size > 5000) {
    for (const [key, value] of connectionWindows) {
      if (now - value.startedAt >= connectionWindowMs)
        connectionWindows.delete(key);
    }
  }

  callback(null, window.count <= maxConnectionsPerWindow);
};

const io = new Server(http, { allowRequest: allowSocketConnection });

export { http, io };
