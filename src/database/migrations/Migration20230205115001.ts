import { Migration } from '@mikro-orm/migrations';

export class Migration20230205115001 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'create table `user` (`id` varchar not null, `created_at` datetime not null, `updated_at` datetime not null, `username` varchar not null, `latlng` varchar not null, `address` varchar not null, primary key (`id`));'
    );

    this.addSql(
      'create table `reminder` (`id` varchar not null, `created_at` datetime not null, `updated_at` datetime not null, `message` varchar not null, `context` varchar not null, `trigger_at` datetime not null, primary key (`id`));'
    );

    this.addSql(
      'create table `trivia_points` (`id` varchar not null, `created_at` datetime not null, `updated_at` datetime not null, `user_id` varchar not null, `channel_id` varchar not null, `points` integer not null, primary key (`id`));'
    );

    this.addSql('alter table `reminder` add column `user_id` varchar null;');
    this.addSql('create index `reminder_user_id_index` on `reminder` (`user_id`);');
  }
}
