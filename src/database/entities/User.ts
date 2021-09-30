import { Cascade, Collection, Entity, ManyToOne, OneToMany, PrimaryKey, Property } from '@mikro-orm/core';
import { BaseEntity, Location, Reminder } from './index';

@Entity()
export class User extends BaseEntity {
  @PrimaryKey()
  id: string;

  @Property()
  username?: string;

  @OneToMany(() => Reminder, (reminder) => reminder.user, { cascade: [Cascade.ALL] })
  reminders = new Collection<Reminder>(this);

  @ManyToOne(() => Location, { nullable: true })
  location: Location;
}
