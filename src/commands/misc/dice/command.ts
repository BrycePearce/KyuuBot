// todo: implement https://www.npmjs.com/package/roll

import { Command } from '../../../types/Command';

export const command: Command = {
    name: 'Dice Roll',
    description: 'Rolls dice',
    invocations: ['r', 'roll', 'd', 'dice'],
    args: true,
    enabled: true,
    usage: '[invocation] [dice_roll]',
    async execute(message) {
        message.channel.send('Not yet implemented');
    }
};