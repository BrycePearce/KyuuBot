import Uwuifier from 'uwuifier';
import { Command } from '../../../types/Command';

const uwuifier = new Uwuifier();

const command: Command = {
  name: 'Uwuifier',
  description: 'Uwuifies text',
  invocations: ['uwu'],
  args: true,
  enabled: true,
  usage: '[invocation] [textToTransform]',
  async execute(message, args) {
    const channel = message.channel;
    if (!channel.isSendable()) return;
    channel.send(uwuifier.uwuifySentence(args.join(' ')));
  },
};

export default command;
