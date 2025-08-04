import { Migration } from '@mikro-orm/migrations';

export class Migration20250804013547_add_guildId extends Migration {
  async up(): Promise<void> {
    this.addSql('drop index `trivia_stats_user_id_channel_id_unique`;');
    this.addSql('alter table `trivia_stats` rename column `channel_id` to `guild_id`;');
    this.addSql(
      'create unique index `trivia_stats_user_id_guild_id_unique` on `trivia_stats` (`user_id`, `guild_id`);'
    );
  }
}
