import { SqlHighlighter } from '@mikro-orm/sql-highlighter';
import { defineConfig } from '@mikro-orm/sqlite';
import path from 'path';
import { BaseEntity } from './entities/BaseEntity';
import { Reminder } from './entities/Reminder';
import { TriviaStats } from './entities/TriviaStats';
import { User } from './entities/User';

export default defineConfig({
  type: 'sqlite',
  dbName: './config/kyuu.db',
  entities: [TriviaStats, User, Reminder, BaseEntity],
  highlighter: new SqlHighlighter(),
  debug: true,
  migrations: {
    path: path.join(process.cwd(), 'src/database/migrations'),
  },
});
