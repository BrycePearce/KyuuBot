import { Entity, Property } from '@mikro-orm/core';

@Entity()
export abstract class Base {
    @Property()
    createdAt: Date = new Date();

    @Property({ onUpdate: () => new Date() })
    updatedAt: Date = new Date();
};