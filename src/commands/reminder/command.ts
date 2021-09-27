import { addMilliseconds, formatDistanceToNow, isBefore } from "date-fns";
import { TextChannel } from "discord.js";
import parseDuration from "parse-duration";
import { client } from "../..";
import { DI } from "../../database";
import { Reminder, User } from "../../database/entities";
import { Command } from "../../types/Command";

let reminderCache: Reminder[] = [];

const reminderInterval = setInterval(() => {
  const pastReminders = reminderCache.filter((r) => {
    return isBefore(r.triggerAt, new Date());
  });

  const futureReminders = reminderCache.filter((r) => {
    return !isBefore(r.triggerAt, new Date());
  });

  reminderCache = futureReminders;

  pastReminders.forEach((r) => {
    const channel = client.channels.cache.get(r.context) as TextChannel;
    channel.send(r.message);

    DI.reminderRepository.removeAndFlush(r);
  });
}, 1000);

async function refreshRemindersCache() {
  reminderCache = await DI.reminderRepository.findAll();
}

const command: Command = {
  name: "Reminder",
  description: "Reminds you",
  invocations: ["reminder", "remindme"],
  args: true,
  enabled: true,
  usage: "[invocation]",
  async onload() {
    refreshRemindersCache();
  },
  async execute(message, args) {
    if (args.length < 2) return;
    const duration = args.shift();
    const msg = args.join(" ");
    const reminderOffset = parseDuration(duration);

    let user = await DI.userRepository.findOne(message.author.id);
    if (!user) {
      user = new User();
      user.id = message.author.id;
    } else {
      await DI.em.populate(user, ["reminders"]);
    }

    user.username = `${message.author.username}#${message.author.discriminator}`;

    const reminder = new Reminder();
    reminder.user = user;
    reminder.message = msg;
    reminder.triggerAt = addMilliseconds(new Date(), reminderOffset);
    reminder.context = message.channel.id;

    user.reminders.add(reminder);

    await DI.userRepository.persistAndFlush(user);

    message.channel.send(
      `${message.author.toString()} you will be reminded *${formatDistanceToNow(reminder.triggerAt, {
        addSuffix: true,
      })}*: ${msg}`
    );
    refreshRemindersCache();
  },
};

export default command;
