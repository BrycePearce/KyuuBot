import { Reminder } from '../entities';
import { getDbContext } from '../index';
import { findOrCreateUser } from './userApi';

let reminderTimer: NodeJS.Timeout | null = null;
let running = false;

const REMINDER_POLL_INTERVAL_MS = 1000;
const CLAIM_BATCH_SIZE = 25;
const LOCK_STALE_AFTER_MS = 5 * 60 * 1000;

export async function claimDueReminders(limit = CLAIM_BATCH_SIZE): Promise<Reminder[]> {
  const { reminderRepository } = getDbContext();

  const now = new Date();
  const staleBefore = new Date(now.getTime() - LOCK_STALE_AFTER_MS);

  const candidates = await reminderRepository.find(
    {
      remindAt: { $lte: now },
      delivered: false,
      $or: [{ lockedAt: null }, { lockedAt: { $lte: staleBefore } }],
    },
    {
      fields: ['id'],
      orderBy: { remindAt: 'asc' },
      limit,
    }
  );

  if (!candidates.length) return [];

  const claimedIds: string[] = [];

  for (const candidate of candidates) {
    const updatedCount = await reminderRepository.nativeUpdate(
      {
        id: candidate.id,
        delivered: false,
        $or: [{ lockedAt: null }, { lockedAt: { $lte: staleBefore } }],
      },
      {
        lockedAt: now,
      }
    );

    if (updatedCount > 0) {
      claimedIds.push(candidate.id);
    }
  }

  if (!claimedIds.length) return [];

  return reminderRepository.find(
    { id: { $in: claimedIds } },
    {
      populate: ['user'],
      orderBy: { remindAt: 'asc' },
    }
  );
}

export async function markReminderDelivered(reminderId: string): Promise<void> {
  const { reminderRepository } = getDbContext();

  await reminderRepository.nativeUpdate(
    { id: reminderId },
    {
      delivered: true,
      lockedAt: null,
    }
  );
}

export async function releaseReminderLock(reminderId: string): Promise<void> {
  const { reminderRepository } = getDbContext();

  await reminderRepository.nativeUpdate(
    { id: reminderId },
    {
      lockedAt: null,
    }
  );
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
  reminder.delivered = false;
  reminder.lockedAt = null;

  if (data.attachments?.length) {
    reminder.attachments = data.attachments;
  }

  await em.persistAndFlush(reminder);
  return reminder;
}

export async function getUserReminders(userId: string): Promise<Reminder[]> {
  const { reminderRepository } = getDbContext();
  await findOrCreateUser(userId);

  return reminderRepository.find(
    {
      user: userId,
      delivered: false,
    },
    {
      orderBy: { remindAt: 'asc' },
    }
  );
}

export function startReminderLoop(callback: () => Promise<void>) {
  if (reminderTimer) return;

  const tick = async () => {
    if (running) {
      reminderTimer = setTimeout(tick, REMINDER_POLL_INTERVAL_MS);
      return;
    }

    running = true;

    try {
      await callback();
    } finally {
      running = false;
      reminderTimer = setTimeout(tick, REMINDER_POLL_INTERVAL_MS);
    }
  };

  reminderTimer = setTimeout(tick, REMINDER_POLL_INTERVAL_MS);
}

export function stopReminderLoop() {
  if (reminderTimer) {
    clearTimeout(reminderTimer);
    reminderTimer = null;
  }

  running = false;
}
