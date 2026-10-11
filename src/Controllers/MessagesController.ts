import type { Request, Response } from "express";
import { isUUID } from "validator";
import { ApiError } from "../errors/ApiError";
import { MessagesService } from "../Service/MessagesService";

export class MessagesController {
  async create(request: Request, response: Response): Promise<Response> {
    const body = request.body ?? {};
    if (
      typeof body.user_id !== "string" ||
      !isUUID(body.user_id) ||
      typeof body.text !== "string" ||
      !body.text.trim() ||
      body.text.trim().length > 2000
    ) {
      throw new ApiError(
        400,
        "Informe um usuário válido e uma mensagem de até 2000 caracteres.",
      );
    }
    if (!request.authAdminId)
      throw new ApiError(401, "Autenticação de atendente necessária.");

    const service = new MessagesService();
    const message = await service.create({
      admin_id: request.authAdminId,
      text: body.text.trim(),
      user_id: body.user_id,
    });
    return response.status(201).json(message);
  }

  async showByUser(request: Request, response: Response): Promise<Response> {
    const userId = Array.isArray(request.params.id)
      ? (request.params.id[0] ?? "")
      : request.params.id;
    if (!isUUID(userId))
      throw new ApiError(400, "Identificador de usuário inválido.");

    const service = new MessagesService();
    const messages = await service.listByUser(userId);
    return response.json(messages);
  }
}
