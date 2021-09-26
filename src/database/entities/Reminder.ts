import { Entity, PrimaryKey, Property } from "@mikro-orm/core";
import { Base } from "./Base";
import { v4 as uuidv4 } from 'uuid';

@Entity()
export class Reminder extends Base {
    @PrimaryKey()
    uuid: string = uuidv4();

    @Property()
    userId: string;

    @Property()
    reminder!: string;

    @Property()
    time!: Date;
};