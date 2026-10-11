import jwt, { type JwtPayload } from "jsonwebtoken";

export type TokenRole = "admin" | "client";

const TOKEN_ISSUER = "node-js-backend-nlw5";
const TOKEN_AUDIENCE = "node-js-backend-nlw5-chat";

export function createToken(
  role: TokenRole,
  subject: string,
  secret: string,
): string {
  return jwt.sign({ role }, secret, {
    algorithm: "HS256",
    audience: TOKEN_AUDIENCE,
    expiresIn: role === "admin" ? "4h" : "30d",
    issuer: TOKEN_ISSUER,
    subject,
  });
}

export function verifyToken(
  token: string,
  secret: string,
  role: TokenRole,
): string {
  const payload = jwt.verify(token, secret, {
    algorithms: ["HS256"],
    audience: TOKEN_AUDIENCE,
    issuer: TOKEN_ISSUER,
  }) as JwtPayload & { role?: unknown };

  if (payload.role !== role || typeof payload.sub !== "string") {
    throw new Error("Token inválido.");
  }
  return payload.sub;
}
