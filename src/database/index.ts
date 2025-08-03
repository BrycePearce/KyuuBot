import { MikroORM } from '@mikro-orm/core';
import { Reminder, TriviaStats, User } from './entities';

let bound = false;

export const DI = {} as {
  orm: MikroORM;
};

export function getDbContext() {
  const em = DI.orm.em.fork();
  return {
    em,
    triviaStatsRepository: em.getRepository(TriviaStats),
    userRepository: em.getRepository(User),
    reminderRepository: em.getRepository(Reminder),
  };
}

export default async function BindDatabase() {
  if (bound) return console.warn('Attempted to bind already bound database.');
  bound = true;

  try {
    console.log('Binding Database');
    DI.orm = await MikroORM.init(); // CLI config will be used automatically

    console.log('Running Migrations');
    await DI.orm.getMigrator().up();
  } catch (error) {
    bound = false;
    throw error;
  }
}
