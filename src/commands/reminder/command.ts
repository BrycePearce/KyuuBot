import { addMilliseconds, formatDistanceToNow, isBefore } from 'date-fns';
import { User as DiscordUser, Message, TextChannel } from 'discord.js';
import parseDuration from 'parse-duration';
import { client } from '../..';
import { DI } from '../../database';
import { Reminder, User } from '../../database/entities';
import { Command } from '../../types/Command';

let reminderCache: Reminder[] = [];

let reminderInterval = null;

async function refreshRemindersCache() {
  reminderCache = await DI.reminderRepository.findAll(['user']);
}

const reminderLoop = () => {
  const pastReminders = reminderCache.filter((r) => {
    return isBefore(r.triggerAt, new Date());
  });

  const futureReminders = reminderCache.filter((r) => {
    return !isBefore(r.triggerAt, new Date());
  });

  reminderCache = futureReminders;

  pastReminders.forEach(async (r) => {
    const channel = client.channels.cache.get(r.context) as TextChannel;
    const user = await getUser(r.user.id);

    channel.send(`Hey ${user.toString()}, here's your reminder.\n> ${r.message}`);

    DI.reminderRepository.removeAndFlush(r);
  });
};

// TODO: move this function to a client utils file
async function getUser(id: string): Promise<DiscordUser> {
  if (client.users.cache.get(id)) {
    return client.users.cache.get(id);
  }
  return await client.users.fetch(id, { force: true });
}

const command: Command = {
  name: 'Reminder',
  description: 'Reminds you',
  invocations: ['reminder', 'reminders', 'remindme', 'remind'],
  args: true,
  enabled: true,
  usage: '[invocation]',
  async onload() {
    refreshRemindersCache();
    if (this.enabled) {
      reminderInterval = setInterval(reminderLoop, 1000);
    }
  },
  unload() {
    if (reminderInterval) {
      clearInterval(reminderInterval);
    }
  },
  async execute(message, args) {
    if (args[0] === 'list') {
      listReminders(message);
    } else if (args[0] === 'delete' || args[0] === 'del') {
      deleteReminders(message, args[1]);
    } else {
      createReminder(message, args);
    }
  },
};

async function createReminder(message: Message, args: string[]) {
  const channel = message.channel;
  if (!channel.isSendable()) return;
  const duration = args.shift();
  const msg = args.join(' ');
  const reminderOffset = parseDuration(duration);

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
  refreshRemindersCache();
}

async function listReminders(message: Message) {
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

async function deleteReminders(message: Message, sortedIndexKey: string) {
  const channel = message.channel;
  if (!channel.isSendable()) return;
  const parsedSortedIndexKey = parseInt(sortedIndexKey);
  if (isNaN(parsedSortedIndexKey)) {
    return channel.send('**Not a reminder number**');
  }

  let user = await DI.userRepository.findOne(message.author.id, ['reminders']);

  const sortedReminders = user.reminders.getItems().sort((a, b) => a.triggerAt.getTime() - b.triggerAt.getTime());

  user.reminders.remove(sortedReminders[parsedSortedIndexKey - 1]);
  DI.em.persistAndFlush(user);
}

export default command;
