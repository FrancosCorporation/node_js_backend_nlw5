import { randomUUID } from "node:crypto";
import { Column, CreateDateColumn, Entity, PrimaryColumn } from "typeorm";

@Entity("users")
export class User {
  @PrimaryColumn({ type: "uuid" })
  id!: string;

  @Column({ type: "varchar" })
  email!: string;

  @CreateDateColumn({ type: "datetime" })
  created_at!: Date;

  constructor() {
    this.id ??= randomUUID();
  }
}
