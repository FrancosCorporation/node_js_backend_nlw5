import type { Request, Response } from "express";
import { ApiError } from "../errors/ApiError";
import { SettingsService } from "../Service/SettingsService";

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{1,50}$/;

export class SettingsController {
  async create(request: Request, response: Response): Promise<Response> {
    const body = request.body ?? {};
    if (
      typeof body.username !== "string" ||
      !USERNAME_PATTERN.test(body.username) ||
      typeof body.chat !== "boolean"
    ) {
      throw new ApiError(
        400,
        "Informe um nome de atendente válido e o estado do chat.",
      );
    }

    const service = new SettingsService();
    const setting = await service.create({
      username: body.username,
      chat: body.chat,
    });
    return response.status(201).json(setting);
  }

  async findByUsername(
    request: Request,
    response: Response,
  ): Promise<Response> {
    const username = Array.isArray(request.params.username)
      ? (request.params.username[0] ?? "")
      : request.params.username;
    if (!USERNAME_PATTERN.test(username))
      throw new ApiError(400, "Nome de atendente inválido.");

    const service = new SettingsService();
    const setting = await service.findByUsername(username);
    return response.json({ chat: setting?.chat ?? true });
  }

  async update(request: Request, response: Response): Promise<Response> {
    const username = Array.isArray(request.params.username)
      ? (request.params.username[0] ?? "")
      : request.params.username;
    const body = request.body ?? {};
    if (!USERNAME_PATTERN.test(username) || typeof body.chat !== "boolean") {
      throw new ApiError(
        400,
        "Informe um nome de atendente e um estado de chat válidos.",
      );
    }

    const service = new SettingsService();
    const setting = await service.update(username, body.chat);
    return response.json(setting);
  }
}
