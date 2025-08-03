import { Migration } from '@mikro-orm/migrations';

export class Migration20250803044858 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'create table `trivia_points` (`id` text not null, `created_at` datetime not null, `updated_at` datetime not null, `user_id` text not null, `channel_id` text not null, `points` integer not null, primary key (`id`));'
    );

    this.addSql(
      'create table `user` (`id` text not null, `created_at` datetime not null, `updated_at` datetime not null, `username` text not null, `latlng` text not null, `address` text not null, primary key (`id`));'
    );

    this.addSql(
      'create table `reminder` (`id` text not null, `created_at` datetime not null, `updated_at` datetime not null, `message` text not null, `context` text not null, `trigger_at` datetime not null, `user_id` text not null, constraint `reminder_user_id_foreign` foreign key(`user_id`) references `user`(`id`) on update cascade, primary key (`id`));'
    );
    this.addSql('create index `reminder_user_id_index` on `reminder` (`user_id`);');
  }
}
