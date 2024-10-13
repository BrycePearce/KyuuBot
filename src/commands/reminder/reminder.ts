import { addMilliseconds, formatDistanceToNow, isBefore } from 'date-fns';
import { User as DiscordUser, Message, TextChannel } from 'discord.js';
import parseDuration from 'parse-duration';
import { client } from '../..';
import { DI } from '../../database';
import { Reminder, User } from '../../database/entities';
import { Command, ICommand, Invoke } from '../commandRegistry';

@Command(['reminder', 'reminders', 'remindme', 'remind'])
class ReminderCommand implements ICommand {
  name: string = 'Reminder';
  reminderCache: Reminder[] = [];
  reminderInterval: NodeJS.Timer = null;

  onLoad() {
    this.refreshRemindersCache();
    this.reminderInterval = setInterval(this.eventLoop.bind(this), 1000);
  }

  unLoad?: () => void;

  eventLoop() {
    const pastReminders = this.reminderCache.filter((r) => {
      return isBefore(r.triggerAt, new Date());
    });

    const futureReminders = this.reminderCache.filter((r) => {
      return !isBefore(r.triggerAt, new Date());
    });

    this.reminderCache = futureReminders;

    pastReminders.forEach(async (r) => {
      const channel = client.channels.cache.get(r.context) as TextChannel;
      const user = await getUser(r.user.id);

      channel.send(`Hey ${user.toString()}, here's your reminder.\n> ${r.message}`);

      DI.reminderRepository.removeAndFlush(r);
    });
  }

  @Invoke('list')
  async list(_args: string[], message: Message) {
    const channel = message.channel;
    if (!channel.isSendable()) return;
    let user = await DI.userRepository.findOne(message.author.id, ['reminders']);

    let reminders = 'You have no reminders 😓';

    if (user?.reminders.length > 0) {
      const reminderStrings = user.reminders
        .getItems()
        .sort((a, b) => a.triggerAt.getTime() - b.triggerAt.getTime())
        .map((reminder, index) => {
          return `${index + 1}) \`${reminder.message}\` **${formatDistanceToNow(reminder.triggerAt, {
            addSuffix: true,
          })}**`;
        });

      reminders = reminderStrings.join('\n');
    }

    channel.send(
      `${message.author.toString()} Reminders:\n\n${reminders}\n ${
        user?.reminders.length > 4 ? "\nWow! You're a busy dude! 😅" : ''
      }${user?.reminders.length > 1 ? '\n You can delete some of these... `.reminder del #`' : ''}`
    );
  }

  @Invoke(['delete', 'del', 'remove', 'rm', 'rem'])
  async remove(args: string[], message: Message) {
    const channel = message.channel;
    if (!channel.isSendable()) return;
    const sortedIndexKey = args[0];
    const parsedSortedIndexKey = parseInt(sortedIndexKey);
    if (isNaN(parsedSortedIndexKey)) {
      return channel.send('**Not a reminder number**');
    }

    let user = await DI.userRepository.findOne(message.author.id, ['reminders']);

    const sortedReminders = user.reminders.getItems().sort((a, b) => a.triggerAt.getTime() - b.triggerAt.getTime());

    user.reminders.remove(sortedReminders[parsedSortedIndexKey - 1]);
    DI.em.persistAndFlush(user);
  }

  @Invoke()
  async create(args: string[], message: Message) {
    const channel = message.channel;
    if (!channel.isSendable()) return;
    const duration = args.shift();
    const msg = args.join(' ');
    const reminderOffset = parseDuration(duration);

    if (msg.length < 1) {
      return channel.send('**Invalid Parameters.** *Example:* `.reminder 1h30m Take out the trash`');
    }

    if (reminderOffset === null) {
      return channel.send('**Invalid duration.** *Example:* `.reminder 1h30m Take out the trash`');
    }

    let user = await DI.userRepository.findOne(message.author.id);
    if (!user) {
      user = new User();
      user.id = message.author.id;
    } else {
      await DI.em.populate(user, ['reminders']);
    }

    user.username = `${message.author.username}#${message.author.discriminator}`;

    const reminder = new Reminder();
    reminder.user = user;
    reminder.message = msg;
    reminder.triggerAt = addMilliseconds(new Date(), reminderOffset);
    reminder.context = channel.id;

    user.reminders.add(reminder);

    await DI.userRepository.persistAndFlush(user);

    channel.send(
      `${message.author.toString()} you will be reminded *${formatDistanceToNow(reminder.triggerAt, {
        addSuffix: true,
      })}*: ${msg}`
    );

    this.refreshRemindersCache();
  }

  async refreshRemindersCache() {
    this.reminderCache = await DI.reminderRepository.findAll(['user']);
  }
}

async function getUser(id: string): Promise<DiscordUser> {
  if (client.users.cache.get(id)) {
    return client.users.cache.get(id);
  }
  return await client.users.fetch(id);
}
