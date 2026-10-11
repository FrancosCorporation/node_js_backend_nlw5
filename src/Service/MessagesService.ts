import { Repository } from "typeorm";
import { AppDataSource } from "../DataBase";
import { Message } from "../entities/Message";

interface MessageInput {
  admin_id: string | null;
  text: string;
  user_id: string;
}

export class MessagesService {
  private readonly repository: Repository<Message>;

  constructor() {
    this.repository = AppDataSource.getRepository(Message);
  }

  async create(input: MessageInput): Promise<Message> {
    return this.repository.save(this.repository.create(input));
  }

  async listByUser(userId: string): Promise<Message[]> {
    return this.repository.find({
      where: { user_id: userId },
      order: { created_at: "ASC" },
    });
  }
}
