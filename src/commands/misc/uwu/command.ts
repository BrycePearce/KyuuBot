import Uwuifier from 'uwuifier';
import { Command } from '../../../types/Command';
import { extractReplySource } from '../../../utils/replySource';

const uwuifier = new Uwuifier();

const command: Command = {
  name: 'Uwuifier',
  description: 'Uwuifies text',
  invocations: ['uwu'],
  args: false,
  enabled: true,
  usage: '[invocation] [textToTransform] or reply to a message',
  async execute(message, args) {
    const channel = message.channel;
    if (!channel.isSendable()) return;

    let text = args.join(' ').trim();

    if (!text) {
      const reply = await extractReplySource(message);
      text = reply?.text ?? '';
    }

    if (!text) {
      await message.reply('Give me something to uwuify — either type some text or reply to a message.');
      return;
    }

    channel.send(uwuifier.uwuifySentence(text));
  },
};

export default command;
