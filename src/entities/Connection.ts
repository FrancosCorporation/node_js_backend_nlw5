import { randomUUID } from "node:crypto";
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./User";

@Entity("connections")
export class Connection {
  @PrimaryColumn({ type: "uuid" })
  id!: string;

  @Column({ type: "uuid", nullable: true })
  admin_id!: string | null;

  @Column({ type: "varchar" })
  socket_id!: string;

  @JoinColumn({ name: "user_id" })
  @ManyToOne(() => User)
  user!: User;

  @Column({ type: "uuid" })
  user_id!: string;

  @CreateDateColumn({ type: "datetime" })
  created_at!: Date;

  @UpdateDateColumn({ type: "datetime" })
  updated_at!: Date;

  constructor() {
    this.id ??= randomUUID();
  }
}
