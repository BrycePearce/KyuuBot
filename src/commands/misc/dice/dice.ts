import { Message } from 'discord.js';
import Roll from 'roll';
import { Command, ICommand, Invoke } from '../../commandRegistry';
const dice = new Roll();

@Command(['roll', 'r', 'dice', 'd'])
class Dice implements ICommand {
  name = 'Dice Roll';

  @Invoke()
  async DefaultRoll(args, message: Message) {
    try {
      const rollParams = args.join('');
      if (!isValidArgs(rollParams)) return;
      const roll = dice.roll(rollParams);

      const sumTotal = roll.input.sides * roll.input.quantity;
      const percentOfTotal = (100 * roll.result) / sumTotal;
      message.channel.send(
        `:: Total ${roll.result} / ${sumTotal} [${Math.round(percentOfTotal)}%] :: Results [${roll.rolled.join(
          ', '
        )}] ::`
      );
    } catch (ex) {
      message.channel.send(ex['message'] || 'Something went really wrong');
    }
  }
}

const isValidArgs = (args: string) => {
  if (args.length === 0) return false;

  const digitsOnly = Number(args.replace(/\D/g, ''));
  return Number.isInteger(digitsOnly);
};
