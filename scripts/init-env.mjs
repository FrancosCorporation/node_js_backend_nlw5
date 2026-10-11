import { randomBytes, randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(projectRoot, ".env");
const databaseDirectory = resolve(projectRoot, "database");

mkdirSync(databaseDirectory, { recursive: true, mode: 0o700 });
chmodSync(databaseDirectory, 0o700);

if (existsSync(envPath)) {
  console.log(".env já existe; ele foi mantido.");
  process.exit(0);
}

const template = readFileSync(resolve(projectRoot, ".env.example"), "utf8");
const values = {
  JWT_SECRET: randomBytes(48).toString("base64url"),
  ADMIN_ID: randomUUID(),
  ADMIN_USERNAME: `admin_${randomBytes(6).toString("hex")}`,
  ADMIN_PASSWORD: randomBytes(32).toString("base64url"),
};

let envContents = template;
for (const [key, value] of Object.entries(values)) {
  envContents = envContents.replace(`${key}=__GENERATE__`, `${key}=${value}`);
}

writeFileSync(envPath, envContents, {
  encoding: "utf8",
  mode: 0o600,
  flag: "wx",
});
chmodSync(envPath, 0o600);
console.log(
  "Arquivo .env criado com credenciais aleatórias e permissões 0600.",
);
