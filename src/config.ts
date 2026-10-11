export interface AppConfig {
  host: string;
  port: number;
  jwtSecret: string;
  adminId: string;
  adminUsername: string;
  adminPassword: string;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `A variável ${name} é obrigatória. Execute "make init" e revise .env.`,
    );
  }
  return value;
}

export function loadConfig(): AppConfig {
  const portValue = process.env.PORT ?? "3333";
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT deve ser um número entre 1 e 65535.");
  }

  const jwtSecret = required("JWT_SECRET");
  if (Buffer.byteLength(jwtSecret, "utf8") < 32) {
    throw new Error(
      'JWT_SECRET deve ter pelo menos 32 bytes. Execute "make init" para gerar um valor seguro.',
    );
  }

  const adminId = required("ADMIN_ID");
  if (
    !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(
      adminId,
    )
  ) {
    throw new Error(
      'ADMIN_ID deve ser um UUID v4. Execute "make init" para gerar as credenciais locais.',
    );
  }

  const adminUsername = required("ADMIN_USERNAME");
  const adminPassword = required("ADMIN_PASSWORD");
  if (
    adminUsername.length < 3 ||
    Buffer.byteLength(adminPassword, "utf8") < 20
  ) {
    throw new Error(
      "ADMIN_USERNAME deve ter 3 caracteres e ADMIN_PASSWORD ao menos 20 bytes.",
    );
  }

  return {
    host: process.env.HOST?.trim() || "127.0.0.1",
    port,
    jwtSecret,
    adminId,
    adminUsername,
    adminPassword,
  };
}
