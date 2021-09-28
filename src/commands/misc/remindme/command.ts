import { createReminder, getAllReminders } from './../../../database/api/reminderApi';
import { Command } from './../../../types/Command';
import { addHours } from 'date-fns';
import { client } from '../../../index';
import { TextChannel } from 'discord.js';

const command: Command = {
    name: 'Remind me',
    description: 'Will ping the user with their reminder after a user specified period of time',
    invocations: ['remindme', 'remind', 'reminder', 'allReminders', 'reminders'],
    args: true,
    enabled: true,
    usage: '[invocation] [time until reminder] [reminder task]',
    async execute(message, args) {
        const remindDate = getRequestedFutureDate(args[0]);
        const reminderMessage = args.slice(1, args.length).join(' ');
        createReminder(message.author.id, message.guild.id, message.channel.id, reminderMessage, remindDate);
    }
};

const getRequestedFutureDate = (remindTime: string) => {
    const currentDate = new Date();
    const numbersOnly = Number(remindTime.replace(/[^0-9]/g, ''));
    return addHours(currentDate, numbersOnly)
};

const checkForReminders = async () => {
    /*
        todo:
        1.) Query once on start
        2.) Cache results in memory
        3.) When new reminder is added, refresh cache
        4.) Check cache every second for updates
    */
    const b = await getAllReminders();
    const a = await client.channels.fetch('402157753432408066') as TextChannel;
    const c = b[0].reminders.getItems();
    c.forEach((reminder) => {
        console.log(reminder.reminder)
        a.send(reminder.reminder)
    })
};


// check for reminders every minute
setInterval(checkForReminders, 60 * 1000);
export default command;
