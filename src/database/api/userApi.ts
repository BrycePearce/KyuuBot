import { initializeDatabase } from '../connection';
import { User } from '../entities';

export const createUser = async (discordUserId: string) => {
  const db = await initializeDatabase();
  const user = new User();
  user.userId = discordUserId;
  await db.em.persistAndFlush(user);
};
