import {
  addMilliseconds,
  addMonths,
  addYears,
  formatDistanceToNow,
  formatDuration,
  intervalToDuration,
  isValid,
} from 'date-fns';
import { AttachmentBuilder, Message } from 'discord.js';
import parseDuration from 'parse-duration';
import { client } from '../..';
import {
  addReminder,
  getDueReminders,
  getUserReminders,
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

function computeRemindAt(durationInput: string): Date | null {
  const CALENDAR_UNIT_REGEX = /(\d+)\s*(y|mo|w|d|h|m|s)/gi;
  const now = new Date();
  let cursor = new Date(now); // apply calendar units first
  let remainderMs = 0;

  // Extract all number+unit tokens
  let matched = false;
  let remaining = durationInput;

  for (const match of durationInput.matchAll(CALENDAR_UNIT_REGEX)) {
    matched = true;
    const [, rawNum, unitRaw] = match;
    const num = parseInt(rawNum, 10);
    const unit = unitRaw.toLowerCase();

    switch (unit) {
      case 'y':
        cursor = addYears(cursor, num);
        break;
      case 'mo':
        cursor = addMonths(cursor, num);
        break;
      case 'w':
        cursor = addMilliseconds(cursor, num * 7 * 24 * 60 * 60 * 1000);
        break;
      case 'd':
        cursor = addMilliseconds(cursor, num * 24 * 60 * 60 * 1000);
        break;
      case 'h':
        cursor = addMilliseconds(cursor, num * 60 * 60 * 1000);
        break;
      case 'm':
        cursor = addMilliseconds(cursor, num * 60 * 1000);
        break;
      case 's':
        cursor = addMilliseconds(cursor, num * 1000);
        break;
    }

    // remove this token from the leftover string so we don't double-parse
    remaining = remaining.replace(match[0], '');
  }

  if (matched) {
    // if there is leftover like "1y30" that isn't matched, let parse-duration handle it
    const leftover = remaining.trim();
    if (leftover) {
      const extraMs = parseDuration(leftover);
      if (extraMs === null) return null;
      remainderMs = extraMs;
    }
    return addMilliseconds(cursor, remainderMs);
  }

  // fallback: no calendar-style tokens matched, try parse-duration wholesale
  const fallbackMs = parseDuration(durationInput);
  if (fallbackMs === null) return null;
  return addMilliseconds(now, fallbackMs);
}

export async function createReminder(message: Message, args: string[]) {
  const channel = message.channel;
  if (!channel.isSendable()) return;

  const durationInput = args.shift()?.trim() ?? '';
  const reminderText = args.join(' ').trim();

  if (!durationInput || !reminderText) {
    await channel.send('**Invalid usage.** *Example:* `.reminder 1h30m Take out the trash`');
    return;
  }

  const now = new Date();
  const remindAt = computeRemindAt(durationInput);

  if (!remindAt || !isValid(remindAt) || remindAt.getTime() <= now.getTime()) {
    await channel.send(
      '**Invalid duration.** Make sure it’s in the future and formatted like `1y6mo`, `2d4h`, or `90m`.'
    );
    return;
  }

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
    format: ['years', 'months', 'days', 'hours', 'minutes', 'seconds'],
    zero: false,
  });

  const human = formatted || 'a moment';
  const reminderMsg = `${message.author} you will be reminded in ${human}: ${reminderText}`;
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
