import { isAfter, isEqual } from 'date-fns';
import { Reminder } from '../entities';
import { getDbContext } from '../index';
import { findOrCreateUser } from './userApi';

let reminderCache: Reminder[] = [];
let reminderInterval: NodeJS.Timeout | null = null;

export async function refreshRemindersCache() {
  const { reminderRepository } = getDbContext();
  reminderCache = await reminderRepository.findAll({ populate: ['user'] });
}

export function getDueReminders(): Reminder[] {
  const now = new Date();
  const due: Reminder[] = [];
  const future: Reminder[] = [];

  for (const r of reminderCache) {
    if (isAfter(now, r.remindAt) || isEqual(now, r.remindAt)) {
      due.push(r);
    } else {
      future.push(r);
    }
  }

  reminderCache = future;
  return due;
}

export async function removeReminder(reminder: Reminder) {
  const { em } = getDbContext();
  em.remove(reminder);
  await em.flush();
  reminderCache = reminderCache.filter((r) => r.id !== reminder.id);
}

export async function addReminder(
  userId: string,
  data: {
    message: string;
    remindAt: Date;
    channelId: string;
    attachments?: string[];
  }
): Promise<Reminder> {
  const { em } = getDbContext();
  const user = await findOrCreateUser(userId);

  const reminder = new Reminder();
  reminder.user = user;
  reminder.message = data.message;
  reminder.remindAt = data.remindAt;
  reminder.channelId = data.channelId;
  if (data.attachments?.length) {
    reminder.attachments = data.attachments;
  }

  await em.persistAndFlush(reminder);
  await refreshRemindersCache();
  return reminder;
}

export async function getUserReminders(userId: string): Promise<Reminder[]> {
  const { userRepository } = getDbContext();

  await findOrCreateUser(userId);

  const user = await userRepository.findOneOrFail({ id: userId }, { populate: ['reminders'] });

  return user.reminders.getItems().sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime());
}

export function startReminderLoop(callback: (reminders: Reminder[]) => Promise<void>) {
  reminderInterval = setInterval(async () => {
    const due = getDueReminders();
    if (due.length) {
      await callback(due);
    }
  }, 1000);
}

export function stopReminderLoop() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
}
