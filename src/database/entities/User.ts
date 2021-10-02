import { Cascade, Collection, Entity, OneToMany, PrimaryKey, Property } from '@mikro-orm/core';
import { BaseEntity, Reminder } from './index';

@Entity()
export class User extends BaseEntity {
  @PrimaryKey()
  id: string;

  @OneToMany(() => Reminder, (reminder) => reminder.user, { cascade: [Cascade.ALL] })
  reminders = new Collection<Reminder>(this);

  @Property()
  username?: string;

  @Property()
  latlng: string;

  @Property()
  address!: string;
}
