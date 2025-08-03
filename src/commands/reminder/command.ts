import { addMilliseconds, formatDistanceToNow, formatDuration, intervalToDuration } from 'date-fns';
import { AttachmentBuilder, Message } from 'discord.js';
import parseDuration from 'parse-duration';
import { client } from '../..';
import {
  addReminder,
  getDueReminders,
  getUserReminders,
  refreshRemindersCache,
  removeReminder,
  startReminderLoop,
  stopReminderLoop,
} from '../../database/api/reminderApi';
import { Command } from '../../types/Command';

async function processDueReminders() {
  const dueReminders = await getDueReminders();

  for (const reminder of dueReminders) {
    let channel = client.channels.cache.get(reminder.channelId);

    try {
      if (!channel?.isSendable()) continue;

      const user =
        client.users.cache.get(reminder.user.id) ?? (await client.users.fetch(reminder.user.id, { force: true }));
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
      startReminderLoop(processDueReminders);
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

  const now = new Date();
  const remindAt = addMilliseconds(now, reminderOffset);

  const reminder = await addReminder(message.author.id, {
    message: reminderText,
    remindAt,
    channelId: channel.id,
    attachments: message.attachments.map((a) => a.url),
  });

  const duration = intervalToDuration({
    start: now,
    end: reminder.remindAt,
  });
  const formatted = formatDuration(duration, {
    format: ['days', 'hours', 'minutes', 'seconds'],
    zero: false,
  });
  const reminderMsg = `${message.author} you will be reminded in ${formatted}: ${reminderText}`;
  await channel.send(reminderMsg);
}

export async function listReminders(message: Message) {
  const channel = message.channel;
  if (!channel.isSendable()) return;

  const reminders = await getUserReminders(message.author.id);

  if (!reminders.length) {
    channel.send(`🙀 ${message.author.toString()} You have no reminders 🙀`);
    return;
  }

  const reminderStrings = reminders.map((reminder, index) => {
    return `${index + 1}) \`${reminder.message}\` **${formatDistanceToNow(reminder.remindAt, {
      addSuffix: true,
    })}**`;
  });

  const response = `${message.author.toString()} Reminders:\n\n${reminderStrings.join('\n')}`;
  channel.send(response);
}

export default command;
