import { Command } from './../../../types/Command';

export const command: Command = {
    name: 'Remind me',
    description: 'Will ping the user with their reminder after a user specified period of itme',
    invocations: ['remindme', 'remind', 'allReminders', 'reminders'],
    args: true,
    enabled: true,
    usage: '[invocation] [time until reminder] [reminder task]',
    async execute(message) {

    }
};