import { Repository } from "typeorm";
import { AppDataSource } from "../DataBase";
import { Setting } from "../entities/Settings";
import { ApiError } from "../errors/ApiError";

interface SettingsInput {
  chat: boolean;
  username: string;
}

export class SettingsService {
  private readonly repository: Repository<Setting>;

  constructor() {
    this.repository = AppDataSource.getRepository(Setting);
  }

  async create(input: SettingsInput): Promise<Setting> {
    if (await this.findByUsername(input.username)) {
      throw new ApiError(
        409,
        "Já existe uma configuração para esse atendente.",
      );
    }
    return this.repository.save(this.repository.create(input));
  }

  async findByUsername(username: string): Promise<Setting | null> {
    return this.repository.findOneBy({ username });
  }

  async update(username: string, chat: boolean): Promise<Setting> {
    const result = await this.repository.update({ username }, { chat });
    if (!result.affected) {
      throw new ApiError(404, "Configuração não encontrada.");
    }
    const setting = await this.findByUsername(username);
    if (!setting) throw new ApiError(404, "Configuração não encontrada.");
    return setting;
  }
}
