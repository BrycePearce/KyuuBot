import { Entity, Property, OneToMany, PrimaryKey } from "@mikro-orm/core";
import { Base, Reminder } from './index';

@Entity()
export class User extends Base {
    @PrimaryKey()
    userId!: string;

    @Property()
    createdAt: Date = new Date();

    @Property({ onUpdate: () => new Date() })
    updatedAt: Date = new Date();

    @OneToMany(() => Reminder, reminder => reminder.userId)
    reminders: Reminder[] = [];
};