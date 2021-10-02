import { Migration } from '@mikro-orm/migrations';

export class Migration20211002035502 extends Migration {
  async up(): Promise<void> {
    this.addSql('alter table `user` add column `latlng` varchar null;');
    this.addSql('alter table `user` add column `address` varchar null;');
    this.addSql('drop index `user_location_id_index`;');
    this.addSql('PRAGMA table_info(`user`);');

    this.addSql('drop table if exists `location`;');
  }
}
