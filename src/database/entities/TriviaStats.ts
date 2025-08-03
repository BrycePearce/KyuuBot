import { Entity, ManyToOne, Property, Unique } from '@mikro-orm/core';
import { BaseEntity } from './BaseEntity';
import { User } from './User';

@Entity()
@Unique({ properties: ['user', 'channelId'] })
export class TriviaStats extends BaseEntity {
  @ManyToOne(() => User, { cascade: [] })
  user: User;

  @Property()
  channelId: string;

  @Property()
  points: number = 0;

  @Property()
  wins: number = 0;
}
