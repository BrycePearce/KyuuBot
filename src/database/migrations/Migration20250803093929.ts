import { Migration } from '@mikro-orm/migrations';

export class Migration20250803093929 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'create table `trivia_stats` (`id` text not null, `created_at` datetime not null, `updated_at` datetime not null, `user_id` text not null, `channel_id` text not null, `points` integer not null default 0, `wins` integer not null default 0, constraint `trivia_stats_user_id_foreign` foreign key(`user_id`) references `user`(`id`), primary key (`id`));'
    );
    this.addSql('create index `trivia_stats_user_id_index` on `trivia_stats` (`user_id`);');
    this.addSql(
      'create unique index `trivia_stats_user_id_channel_id_unique` on `trivia_stats` (`user_id`, `channel_id`);'
    );

    this.addSql('drop table if exists `trivia_points`;');

    this.addSql('PRAGMA foreign_keys = OFF;');
    this.addSql(
      'CREATE TABLE `_knex_temp_alter867` (`id` text NOT NULL, `created_at` datetime NOT NULL, `updated_at` datetime NOT NULL, `username` text NULL, `latlng` text NULL, `address` text NULL, PRIMARY KEY (`id`));'
    );
    this.addSql('INSERT INTO "_knex_temp_alter867" SELECT * FROM "user";;');
    this.addSql('DROP TABLE "user";');
    this.addSql('ALTER TABLE "_knex_temp_alter867" RENAME TO "user";');
    this.addSql('PRAGMA foreign_keys = ON;');

    this.addSql('alter table `reminder` add column `attachments` json null;');
    this.addSql('alter table `reminder` add column `delivered` integer not null default false;');
    this.addSql('alter table `reminder` rename column `context` to `channel_id`;');
    this.addSql('alter table `reminder` rename column `trigger_at` to `remind_at`;');
  }
}
