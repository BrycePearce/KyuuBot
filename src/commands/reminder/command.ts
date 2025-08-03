import { addMilliseconds, formatDistanceToNow, formatDuration, intervalToDuration, isBefore } from 'date-fns';
import { AttachmentBuilder, Channel, User as DiscordUser, Message } from 'discord.js';
import parseDuration from 'parse-duration';
import { client } from '../..';
import { getDbContext } from '../../database';
import { findOrCreateUser } from '../../database/api/userApi';
import { Reminder } from '../../database/entities';
import { Command } from '../../types/Command';

let reminderCache: Reminder[] = [];
let reminderInterval: NodeJS.Timeout | null = null;

export async function refreshRemindersCache() {
  const { reminderRepository } = getDbContext();
  reminderCache = await reminderRepository.findAll({ populate: ['user'] });
}

async function removeReminder(reminder: Reminder) {
  // remove from db
  const { em } = getDbContext();
  em.remove(reminder);
  await em.flush();

  // remove from cache
  reminderCache = reminderCache.filter((r) => r.id !== reminder.id);
}

async function processDueReminders() {
  const { em } = getDbContext();
  const now = Date.now();
  let channel: Channel = null;

  const dueReminders = reminderCache.filter((r) => r.remindAt.getTime() <= now);
  reminderCache = reminderCache.filter((r) => !isBefore(r.remindAt, now));

  for (const reminder of dueReminders) {
    try {
      channel = client.channels.cache.get(reminder.channelId);
      if (!channel?.isSendable()) continue;

      const user = await getUser(reminder.user.id);
      const messageContent = `${user.toString()}, here's your reminder:\n> ${reminder.message}`;
      const files = reminder.attachments?.length ? reminder.attachments.map((url) => new AttachmentBuilder(url)) : [];

      await channel.send({
        content: messageContent,
        files,
      });

      await removeReminder(reminder);
    } catch (err) {
      if (channel?.isTextBased() && channel?.isSendable()) {
        channel.send(`Failed to send reminder ${reminder.id}: ${err}`);
      } else {
        console.error(`Failed to send reminder ${reminder.id} in channel ${reminder.channelId}:`, err);
      }
    }
  }

  // Flush once after all removals
  await em.flush();
}

export function startReminderLoop() {
  reminderInterval = setInterval(processDueReminders, 1000);
}

export function stopReminderLoop() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
}

// TODO: move this function to a client utils file
async function getUser(id: string): Promise<DiscordUser> {
  return client.users.cache.get(id) ?? (await client.users.fetch(id, { force: true }));
}

const command: Command = {
  name: 'Reminder',
  description: 'Reminds you',
  invocations: ['reminder', 'reminders', 'remindme', 'remind'],
  args: true,
  enabled: true,
  usage: '[invocation]',

  async onload() {
    await refreshRemindersCache();
    if (this.enabled) {
      startReminderLoop();
    }
  },
  unload() {
    stopReminderLoop();
  },
  async execute(message, args) {
    if (args[0] === 'list') {
      await listReminders(message);
    } else {
      await createReminder(message, args);
    }
  },
};

export async function createReminder(message: Message, args: string[]) {
  const channel = message.channel;
  if (!channel.isSendable()) return;

  const durationInput = args.shift();
  const reminderText = args.join(' ');
  const reminderOffset = parseDuration(durationInput);

  if (!durationInput || reminderOffset === null) {
    channel.send('**Invalid duration.** *Example:* `.reminder 1h30m Take out the trash`');
    return;
  }

  const user = await findOrCreateUser(message.author.id);
  const { em } = getDbContext();

  const reminder = new Reminder();
  reminder.user = user;
  reminder.message = reminderText;
  reminder.remindAt = addMilliseconds(new Date(), reminderOffset);
  reminder.channelId = channel.id;

  // Handle attachments
  if (message.attachments.size > 0) {
    reminder.attachments = message.attachments.map((a) => a.url);
  }

  await em.persistAndFlush(reminder);

  const duration = intervalToDuration({
    start: new Date(),
    end: reminder.remindAt,
  });
  const formatted = formatDuration(duration, {
    format: ['days', 'hours', 'minutes', 'seconds'],
    zero: false,
  });
  const reminderMsg = `${message.author} you will be reminded in ${formatted}: ${reminderText}`;
  await channel.send(reminderMsg);

  await refreshRemindersCache();
}

export async function listReminders(message: Message) {
  const channel = message.channel;
  if (!channel.isSendable()) return;

  const { userRepository } = getDbContext();
  const user = await userRepository.findOne(message.author.id, { populate: ['reminders'] });

  if (!user || user.reminders.length === 0) {
    channel.send(`🙀 ${message.author.toString()} You have no reminders 🙀`);
    return;
  }

  const reminderStrings = user.reminders
    .getItems()
    .sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime())
    .map((reminder, index) => {
      return `${index + 1}) \`${reminder.message}\` **${formatDistanceToNow(reminder.remindAt, {
        addSuffix: true,
      })}**`;
    });

  const response = `${message.author.toString()} Reminders:\n\n${reminderStrings.join('\n')}`;
  channel.send(response);
}

export default command;
