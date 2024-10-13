import Roll from 'roll';
import { Command } from '../../../types/Command';

const dice = new Roll();
const command: Command = {
  name: 'Dice Roll',
  description: 'Rolls dice',
  invocations: ['r', 'roll', 'd', 'dice'],
  args: true,
  enabled: true,
  usage: '[invocation] [dice_roll]',
  async execute(message, args) {
    const channel = message.channel;
    if (!channel.isSendable()) return;
    try {
      const rollParams = args.join('');
      if (!isValidArgs(rollParams)) return;
      const roll = dice.roll(rollParams);

      const sumTotal = roll.input.sides * roll.input.quantity;
      const percentOfTotal = (100 * roll.result) / sumTotal;
      channel.send(
        `:: Total ${roll.result} / ${sumTotal} [${Math.round(percentOfTotal)}%] :: Results [${roll.rolled.join(
          ', '
        )}] ::`
      );
    } catch (ex) {
      channel.send(ex['message'] || 'Something went really wrong');
    }
  },
};

const isValidArgs = (args: string) => {
  if (args.length === 0) return false;

  const digitsOnly = Number(args.replace(/\D/g, ''));
  return Number.isInteger(digitsOnly);
};

export default command;
