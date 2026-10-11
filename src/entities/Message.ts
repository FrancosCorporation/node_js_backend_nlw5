import { randomUUID } from "node:crypto";
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";
import { User } from "./User";

@Entity("messages")
export class Message {
  @PrimaryColumn({ type: "uuid" })
  id!: string;

  @Column({ type: "uuid", nullable: true })
  admin_id!: string | null;

  @Column({ type: "varchar" })
  text!: string;

  @JoinColumn({ name: "user_id" })
  @ManyToOne(() => User)
  user!: User;

  @Column({ type: "uuid" })
  user_id!: string;

  @CreateDateColumn({ type: "datetime" })
  created_at!: Date;

  constructor() {
    this.id ??= randomUUID();
  }
}
