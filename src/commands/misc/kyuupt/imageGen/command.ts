import OpenAI from 'openai';

import { getRandomEmotePath } from '../../../../utils/files';

import type { Command } from '../../../../types/Command';

const openai = new OpenAI({
  apiKey: process.env.kyuuPT,
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
        size: '1792x1024',
      });

      const responseUrl = response.data[0]?.url;
      if (!responseUrl || (responseUrl ?? '').length === 0) {
        message.channel.send({
          content: 'There was a problem generating your image',
          files: [await getRandomEmotePath()],
        });
        return;
      }
      message.channel.send(response.data[0]?.url);
    } catch (ex) {
      message.channel.send('There was a problem generating your image:\n\n' + ex);
    }
  },
};

export default command;
