import { Migration } from '@mikro-orm/migrations';

export class Migration20230205061023 extends Migration {
  async up(): Promise<void> {
    this.addSql('PRAGMA table_info(`user`);');
  }
}
