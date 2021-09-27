import { Migration } from '@mikro-orm/migrations';

export class Migration20210927042142 extends Migration {

  async up(): Promise<void> {
    this.addSql('create table `user` (`id` varchar not null, `created_at` datetime not null, `updated_at` datetime not null, `username` varchar not null, primary key (`id`));');

    this.addSql('create table `reminder` (`id` text not null, `created_at` datetime not null, `updated_at` datetime not null, `message` varchar not null, `trigger_at` datetime not null, primary key (`id`));');

    this.addSql('alter table `reminder` add column `user_id` varchar null;');
    this.addSql('create index `reminder_user_id_index` on `reminder` (`user_id`);');
  }

}
