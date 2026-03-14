import { Migration } from '@mikro-orm/migrations';

export class Migration20260314224710 extends Migration {
  async up(): Promise<void> {
    this.addSql('alter table `reminder` add column `locked_at` datetime null;');
    this.addSql('create index `reminder_locked_at_index` on `reminder` (`locked_at`);');
    this.addSql('create index `reminder_delivered_remind_at_index` on `reminder` (`delivered`, `remind_at`);');
  }
}
