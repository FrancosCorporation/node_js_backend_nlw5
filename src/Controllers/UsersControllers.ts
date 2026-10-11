import type { Request, Response } from "express";
import { isEmail } from "validator";
import { ApiError } from "../errors/ApiError";
import { UsersService } from "../Service/UsersService";

export class UsersController {
  async create(request: Request, response: Response): Promise<Response> {
    const email = request.body?.email;
    if (typeof email !== "string" || !isEmail(email.trim())) {
      throw new ApiError(400, "Informe um endereço de e-mail válido.");
    }

    const service = new UsersService();
    const user = await service.create(email);
    return response.status(201).json(user);
  }
}
