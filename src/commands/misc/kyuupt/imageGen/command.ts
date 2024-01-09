import OpenAI from 'openai';

import { getRandomEmotePath } from '../../../../utils/files';

import { AttachmentBuilder } from 'discord.js';
import got from 'got';
import type { Command } from '../../../../types/Command';

const openai = new OpenAI({
  apiKey: process.env.gptImageGen,
});

const command: Command = {
  name: 'Kyuubot Images',
  description: 'Integrates OpenAI Api to create images with dall-e',
  invocations: ['i', 'image', 'generate'],
  args: true,
  enabled: true,
  usage: '[invocation] [prompt]',
  async execute(message, args) {
    if (args.length === 0) {
      message.channel.send(
        '🙀 To use KyuuPT image generation, you need to add a prompt to your invocation. For example .generate [prompt] 🙀'
      );
      return;
    }

    const prompt = args.join('');

    try {
      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt,
        size: '1024x1024',
      });

      const responseUrl = response.data[0]?.url;
      const responseBuffer = await got(responseUrl, { responseType: 'buffer' });

      if (!responseBuffer || (responseBuffer?.body ?? '').length === 0) {
        message.channel.send({
          content: 'There was a problem generating your image',
          files: [await getRandomEmotePath()],
        });
        return;
      }

      const attachment = new AttachmentBuilder(responseBuffer.body, { name: 'image.png' });
      message.channel.send({ files: [attachment] });
    } catch (ex) {
      message.channel.send('Something really went wrong generating your image:\n\n' + ex);
    }
  },
};

export default command;
