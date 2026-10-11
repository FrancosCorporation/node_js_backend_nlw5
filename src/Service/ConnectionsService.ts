import { Repository } from "typeorm";
import { AppDataSource } from "../DataBase";
import { Connection } from "../entities/Connection";

const UUID_PATTERN =
  /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

export class ConnectionService {
  private readonly repository: Repository<Connection>;

  constructor() {
    this.repository = AppDataSource.getRepository(Connection);
  }

  async connectUser(socketId: string, userId: string): Promise<Connection> {
    const existing = await this.repository.findOneBy({ user_id: userId });
    if (existing) {
      existing.socket_id = socketId;
      return this.repository.save(existing);
    }

    return this.repository.save(
      this.repository.create({
        socket_id: socketId,
        user_id: userId,
        admin_id: null,
      }),
    );
  }

  async findByUserId(userId: string): Promise<Connection | null> {
    return this.repository.findOne({
      where: { user_id: userId },
      relations: { user: true },
    });
  }

  async findBySocketId(socketId: string): Promise<Connection | null> {
    return this.repository.findOneBy({ socket_id: socketId });
  }

  async findAvailableForAdmin(): Promise<Connection[]> {
    const connections = await this.repository.find({
      relations: { user: true },
    });
    return connections.filter(
      (connection) =>
        !connection.admin_id || !UUID_PATTERN.test(connection.admin_id),
    );
  }

  async findVisibleToAdmin(adminId: string): Promise<Connection[]> {
    const connections = await this.repository.find({
      relations: { user: true },
    });
    return connections.filter(
      (connection) =>
        !connection.admin_id ||
        connection.admin_id === adminId ||
        !UUID_PATTERN.test(connection.admin_id),
    );
  }

  async updateAdminId(userId: string, adminId: string | null): Promise<void> {
    await this.repository.update({ user_id: userId }, { admin_id: adminId });
  }

  async releaseAdmin(adminId: string): Promise<void> {
    await this.repository.update({ admin_id: adminId }, { admin_id: null });
  }

  async clearSocket(userId: string, socketId: string): Promise<void> {
    await this.repository.update(
      { user_id: userId, socket_id: socketId },
      { socket_id: "" },
    );
  }
}
