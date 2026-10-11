import { randomUUID } from "node:crypto";
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("settings")
export class Setting {
  @PrimaryColumn({ type: "uuid" })
  id!: string;

  @Column({ type: "varchar" })
  username!: string;

  @Column({ type: "boolean" })
  chat!: boolean;

  @UpdateDateColumn({ type: "datetime" })
  updated_at!: Date;

  @CreateDateColumn({ type: "datetime" })
  created_at!: Date;

  constructor() {
    this.id ??= randomUUID();
  }
}
