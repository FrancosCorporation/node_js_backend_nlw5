import type { Request, Response } from "express";
import { AppConfig } from "../config";
import { constantTimeEqual } from "../security/constantTimeEqual";
import { createToken } from "../security/tokens";

export class AdminSessionsController {
  constructor(private readonly config: AppConfig) {}

  handle = (request: Request, response: Response): Response => {
    const body = request.body ?? {};
    const username = typeof body.username === "string" ? body.username : "";
    const password = typeof body.password === "string" ? body.password : "";
    const usernameMatches = constantTimeEqual(
      username,
      this.config.adminUsername,
    );
    const passwordMatches = constantTimeEqual(
      password,
      this.config.adminPassword,
    );

    if (!(usernameMatches && passwordMatches)) {
      return response
        .status(401)
        .json({ error: "Usuário ou senha inválidos." });
    }

    const token = createToken(
      "admin",
      this.config.adminId,
      this.config.jwtSecret,
    );
    return response.json({ token, tokenType: "Bearer", expiresIn: 14400 });
  };
}
