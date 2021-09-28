import { User } from "../entities";
import { initializeDatabase } from "../connection";

export const createUser = async (discordUserId: string) => {
    const db = await initializeDatabase();
    const user = new User();
    user.userId = discordUserId
    await db.em.persistAndFlush(user);
};