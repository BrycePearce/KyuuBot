import { Entity, Property } from '@mikro-orm/core';
import { BaseEntity } from './BaseEntity';

@Entity()
export class TriviaPoints extends BaseEntity {
  @Property()
  userId: string;

  @Property()
  channelId: string;

  @Property()
  points: number;
}
