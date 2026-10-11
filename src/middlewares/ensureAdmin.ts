import type { RequestHandler } from "express";
import { verifyToken } from "../security/tokens";

export function ensureAdmin(
  jwtSecret: string,
  expectedAdminId: string,
): RequestHandler {
  return (request, response, next) => {
    const match = request.header("authorization")?.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return response
        .status(401)
        .json({ error: "Autenticação de atendente necessária." });
    }

    try {
      const adminId = verifyToken(match[1], jwtSecret, "admin");
      if (adminId !== expectedAdminId) {
        return response.status(401).json({ error: "Atendente inválido." });
      }
      request.authAdminId = adminId;
      return next();
    } catch {
      return response
        .status(401)
        .json({ error: "Token inválido ou expirado." });
    }
  };
}
