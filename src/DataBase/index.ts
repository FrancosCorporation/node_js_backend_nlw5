import path from "node:path";
import { DataSource } from "typeorm";

const extension = __filename.endsWith(".ts") ? "ts" : "js";
const entityPattern = path.join(__dirname, "..", "entities", `*.${extension}`);
const migrationPattern = path.join(__dirname, "migrations", `*.${extension}`);

export const AppDataSource = new DataSource({
  type: "better-sqlite3",
  database:
    process.env.DATABASE_PATH ||
    path.resolve(process.cwd(), "database/chat.sqlite"),
  entities: [entityPattern],
  migrations: [migrationPattern],
  migrationsTableName: "migrations",
  migrationsRun: false,
  synchronize: false,
  logging: false,
});
