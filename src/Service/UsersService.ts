import { Repository } from "typeorm";
import { AppDataSource } from "../DataBase";
import { User } from "../entities/User";

export class UsersService {
  private readonly repository: Repository<User>;

  constructor() {
    this.repository = AppDataSource.getRepository(User);
  }

  async findById(userId: string): Promise<User | null> {
    return this.repository.findOneBy({ id: userId });
  }

  async create(email: string): Promise<User> {
    const user = this.repository.create({ email: email.trim().toLowerCase() });
    return this.repository.save(user);
  }
}
