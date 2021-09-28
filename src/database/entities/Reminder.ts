import { Entity, ManyToOne, Property } from "@mikro-orm/core";
import { BaseEntity } from "./BaseEntity";
import { User } from "./User";

@Entity()
export class Reminder extends BaseEntity {
  @Property()
  message: string;

  @Property()
  context: string;

  @Property()
  triggerAt: Date;

  @ManyToOne(() => User, { nullable: false })
  user: User;
}
