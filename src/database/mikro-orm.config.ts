import { Options } from '@mikro-orm/core';
import { SqlHighlighter } from '@mikro-orm/sql-highlighter';
import path from 'path';
import { BaseEntity, Reminder, TriviaPoints, User } from './entities';

const config: Options = {
  type: 'sqlite',
  dbName: './config/kyuu.db',
  entities: [TriviaPoints, User, Reminder, BaseEntity],
  highlighter: new SqlHighlighter(),
  debug: true,
  migrations: {
    path: path.join(process.cwd(), '/src/database/migrations'),
  },
};

export default config;
