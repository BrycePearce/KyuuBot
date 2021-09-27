import { Cascade, Collection, Entity, OneToMany, PrimaryKey, Property } from "@mikro-orm/core";
import { BaseEntity } from "./BaseEntity";
import { Reminder } from "./Reminder";

@Entity()
export class User extends BaseEntity {
  @PrimaryKey()
  id: string;

  @Property()
  username?: string;

  @OneToMany(() => Reminder, (reminder) => reminder.user, { cascade: [Cascade.ALL] })
  reminders = new Collection<Reminder>(this);
}
