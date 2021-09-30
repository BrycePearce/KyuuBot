import { Migration } from '@mikro-orm/migrations';

export class Migration20210930063919 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'create table `location` (`id` text not null, `created_at` datetime not null, `updated_at` datetime not null, `latlng` varchar not null, `address` varchar not null, primary key (`id`));'
    );

    this.addSql('alter table `user` add column `location_id` text null;');
    this.addSql('create index `user_location_id_index` on `user` (`location_id`);');
  }
}
