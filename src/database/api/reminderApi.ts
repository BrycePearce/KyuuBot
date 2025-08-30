import { Reminder } from '../entities';
import { getDbContext } from '../index';
import { findOrCreateUser } from './userApi';

let reminderTimer: NodeJS.Timeout | null = null;
let running = false;

export async function getDueReminders(): Promise<Reminder[]> {
  const { reminderRepository } = getDbContext();
  return reminderRepository.find({ remindAt: { $lte: new Date() } }, { populate: ['user'] });
}

export async function removeReminder(reminder: Reminder) {
  const { reminderRepository } = getDbContext();
  await reminderRepository.nativeDelete({ id: reminder.id });
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
  if (data.attachments?.length) reminder.attachments = data.attachments;

  await em.persistAndFlush(reminder);
  return reminder;
}

export async function getUserReminders(userId: string): Promise<Reminder[]> {
  const { userRepository } = getDbContext();
  await findOrCreateUser(userId);
  const user = await userRepository.findOneOrFail({ id: userId }, { populate: ['reminders'] });
  return user.reminders.getItems().sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime());
}

export function startReminderLoop(callback: () => Promise<void>) {
  if (reminderTimer) return;

  const tick = async () => {
    if (running) {
      reminderTimer = setTimeout(tick, 1000);
      return;
    }
    running = true;
    try {
      await callback();
    } finally {
      running = false;
      reminderTimer = setTimeout(tick, 1000);
    }
  };

  reminderTimer = setTimeout(tick, 1000);
}

export function stopReminderLoop() {
  if (reminderTimer) {
    clearTimeout(reminderTimer);
    reminderTimer = null;
  }
  running = false;
}
