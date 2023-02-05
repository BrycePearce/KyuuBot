import { EntityManager, EntityRepository, MikroORM } from '@mikro-orm/core';
import { Reminder, TriviaPoints, User } from './entities';

let bound = false;

export const DI = {} as {
  orm: MikroORM;
  em: EntityManager;
  userRepository: EntityRepository<User>;
  reminderRepository: EntityRepository<Reminder>;
  triviaPointsRepository: EntityRepository<TriviaPoints>;
};

export default async function BindDatabase() {
  if (bound) return console.warn('Attempted to bind already bound database.');
  bound = true;

  try {
    console.log('Binding Database');
    DI.orm = await MikroORM.init(); // CLI config will be used automatically
    DI.em = DI.orm.em;
    DI.userRepository = DI.orm.em.getRepository(User);
    DI.reminderRepository = DI.orm.em.getRepository(Reminder);
    DI.triviaPointsRepository = DI.orm.em.getRepository(TriviaPoints);

    console.log('Running Migrations');
    await DI.orm.getMigrator().up();
  } catch (error) {
    bound = false;
  }
}
