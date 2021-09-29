import { Options } from '@mikro-orm/core';
import { SqlHighlighter } from '@mikro-orm/sql-highlighter';
import path from 'path';
import { BaseEntity, Reminder, User } from './entities';

const config: Options = {
  type: 'sqlite',
  dbName: 'kyuu.db',
  entities: [User, Reminder, BaseEntity],
  highlighter: new SqlHighlighter(),
  debug: true,
  migrations: {
    path: path.join(process.cwd(), '/src/database/migrations'),
  },
};

export default config;
