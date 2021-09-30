import { Cascade, Collection, Entity, OneToMany, Property } from '@mikro-orm/core';
import { BaseEntity } from './BaseEntity';
import { User } from './User';

@Entity()
export class Location extends BaseEntity {
  @OneToMany(() => User, (user) => user.location, { cascade: [Cascade.ALL] })
  users = new Collection<User>(this);

  @Property()
  latlng: string;

  @Property()
  address!: string;
}
