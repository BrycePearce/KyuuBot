import OpenAI from 'openai';

import { getRandomEmotePath } from '../../../../utils/files';
import { AttachmentBuilder } from 'discord.js';
import type { Command } from '../../../../types/Command';

const openai = new OpenAI({
  apiKey: process.env.gptImageGen,
});

const command: Command = {
  name: 'Kyuubot Image2',
  description: 'Generate images via OpenAI gpt-image-2',
  invocations: ['image2', 'i2'],
  args: true,
  enabled: true,
  usage: '[invocation] [prompt]',
  async execute(message, args) {
    const channel = message.channel;
    if (!channel.isSendable()) return;

    if (args.length === 0) {
      channel.send('🙀 You need to provide a prompt! For example: `.image2 a neon cyberpunk city at night` 🙀');
      return;
    }

    const prompt = args.join(' ').trim();

    try {
      const response = await openai.images.generate({
        model: 'gpt-image-2',
        prompt,
        n: 1,
        size: '1024x1024',
      });

      const b64Image = response.data[0]?.b64_json;
      if (!b64Image) {
        channel.send({
          content: 'There was a problem generating your image',
          files: [await getRandomEmotePath()],
        });
        return;
      }

      const imgBuf = Buffer.from(b64Image, 'base64');
      const attachment = new AttachmentBuilder(imgBuf, { name: 'image.png' });
      channel.send({ files: [attachment] });
    } catch (ex: any) {
      channel.send({
        content: '😿 Something went wrong generating your image:\n' + ex.message,
        files: [await getRandomEmotePath()],
      });
    }
  },
};

export default command;
