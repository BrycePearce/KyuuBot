import { Entity, ManyToOne, Property } from '@mikro-orm/core';
import { BaseEntity } from './BaseEntity';
import { User } from './User';

@Entity()
export class Reminder extends BaseEntity {
  @ManyToOne(() => User, { nullable: false })
  user: User;

  @Property()
  message: string;

  @Property({ type: 'json', nullable: true })
  attachments?: string[];

  @Property()
  channelId: string;

  @Property()
  remindAt: Date;

  @Property({ default: false })
  delivered: boolean = false;
}
