import { Reminder } from '../entities';
import { getDbContext } from '../index';
import { findOrCreateUser } from './userApi';

let reminderInterval: NodeJS.Timeout | null = null;

export async function getDueReminders(): Promise<Reminder[]> {
  const { reminderRepository } = getDbContext();
  return reminderRepository.find({ remindAt: { $lte: new Date() } }, { populate: ['user'] });
}

export async function removeReminder(reminder: Reminder) {
  const { em, reminderRepository } = getDbContext();
  const managed = await reminderRepository.findOne({ id: reminder.id });
  if (managed) {
    await em.removeAndFlush(managed);
  }
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
  return reminder;
}

export async function getUserReminders(userId: string): Promise<Reminder[]> {
  const { userRepository } = getDbContext();

  await findOrCreateUser(userId);

  const user = await userRepository.findOneOrFail({ id: userId }, { populate: ['reminders'] });

  return user.reminders.getItems().sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime());
}

export function startReminderLoop(callback: () => Promise<void>) {
  reminderInterval = setInterval(async () => {
    await callback();
  }, 1000);
}

export function stopReminderLoop() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
}
