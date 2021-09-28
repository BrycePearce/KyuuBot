import { User, Reminder } from './entities';
import { MikroORM } from "@mikro-orm/core";

export const initializeDatabase = async () => {
    const orm = await MikroORM.init({
        entities: [User, Reminder],
        dbName: 'my-db-name',
        type: 'sqlite',
    });
    console.log(orm.em); // access EntityManager via `em` property
    return orm;
};