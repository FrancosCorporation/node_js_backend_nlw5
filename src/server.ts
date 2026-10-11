import "dotenv/config";
import "reflect-metadata";
import { AppDataSource } from "./DataBase";
import { loadConfig } from "./config";
import { http, io } from "./http";
import "./webSocket/admin";
import "./webSocket/client";

async function startServer(): Promise<void> {
  const config = loadConfig();
  await AppDataSource.initialize();
  await AppDataSource.runMigrations();

  http.listen(config.port, config.host, () => {
    console.log(`Chat disponível em http://${config.host}:${config.port}`);
  });

  const shutdown = (signal: NodeJS.Signals) => {
    console.log(`${signal} recebido; encerrando o chat.`);
    io.close(() => {
      void AppDataSource.destroy().finally(() => {
        process.exitCode = 0;
      });
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

void startServer().catch(async (error: unknown) => {
  console.error("Não foi possível iniciar o chat:", error);
  if (AppDataSource.isInitialized) await AppDataSource.destroy();
  process.exitCode = 1;
});
