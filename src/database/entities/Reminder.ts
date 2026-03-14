import { Entity, Index, ManyToOne, Property } from '@mikro-orm/core';
import { BaseEntity } from './BaseEntity';
import { User } from './User';

@Entity()
@Index({ properties: ['delivered', 'remindAt'] })
@Index({ properties: ['lockedAt'] })
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

  @Property({ nullable: true })
  lockedAt?: Date | null = null;
}
