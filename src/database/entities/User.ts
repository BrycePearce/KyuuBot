import { Cascade, Collection, Entity, OneToMany, PrimaryKey, Property } from '@mikro-orm/core';
import { BaseEntity, Reminder } from './index';

@Entity()
export class User extends BaseEntity {
  @PrimaryKey()
  id: string;

  @Property({ nullable: true })
  username?: string;

  @Property({ nullable: true })
  latlng?: string;

  @Property({ nullable: true })
  address?: string;

  @OneToMany(() => Reminder, (r) => r.user, { cascade: [Cascade.ALL] })
  reminders = new Collection<Reminder>(this);
}
