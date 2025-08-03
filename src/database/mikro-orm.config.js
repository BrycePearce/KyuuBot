const { SqlHighlighter } = require('@mikro-orm/sql-highlighter');
const { defineConfig } = require('@mikro-orm/sqlite');
const path = require('path');

const { BaseEntity } = require('./entities/BaseEntity');
const { Reminder } = require('./entities/Reminder');
const { TriviaStats } = require('./entities/TriviaStats');
const { User } = require('./entities/User');

module.exports = defineConfig({
  dbName: './config/kyuu.db',
  entities: [TriviaStats, User, Reminder, BaseEntity],
  highlighter: new SqlHighlighter(),
  debug: false,
  migrations: {
    path: path.join(process.cwd(), '/src/database/migrations'),
  },
});
