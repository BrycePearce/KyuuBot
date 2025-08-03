import { getDbContext } from '..';
import { User } from '../entities';

export const findOrCreateUser = async (userId: string) => {
  const { em, userRepository } = getDbContext();

  let user = await userRepository.findOne({ id: userId });

  if (!user) {
    user = new User();
    user.id = userId;
    await em.persistAndFlush(user);
  }

  return user;
};
