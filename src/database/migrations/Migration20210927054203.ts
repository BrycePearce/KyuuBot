import { Migration } from '@mikro-orm/migrations';

export class Migration20210927054203 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table `reminder` add column `context` varchar null;');
  }

}
