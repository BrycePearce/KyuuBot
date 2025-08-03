import { Readable } from 'stream';
import { Command } from '../../../../types/Command';
import openaiClient from '../../../../utils/clients/openaiClient';
import { buildContentArray } from './buildContentArray';
import { extractImageUrls } from './extractImages';
const discordMaxCharacterCount = 2000;

const command: Command = {
  name: 'KyuuPT',
  description: 'Integrates OpenAI API',
  invocations: ['kyuupt', 'ask', 'askJeeves', 'chat', 'write'],
  args: true,
  enabled: true,
  usage: '[invocation] [query]',
  async execute(message, args) {
    const channel = message.channel;
    if (!channel.isSendable()) return;

    if (args.length === 0 && message.attachments.size === 0) {
      await channel.send(
        '🙀 To use KyuuPT, you need to add a prompt or an image to your invocation. For example: `.ask [question]` 🙀'
      );
      return;
    }

    const userPrompt = args.join(' ');

    // load in images from user message
    const imageUrls = extractImageUrls(message);

    // build the openai message object
    const contentArray = buildContentArray(userPrompt, imageUrls);
    // const tools: ChatCompletionTool[] = [weatherTool];

    try {
      const response = await openaiClient.chat.completions.create({
        model: 'chatgpt-4o-latest',
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant that can interpret both text and images. Provide concise, accurate responses.',
          },
          {
            role: 'user',
            content: contentArray,
          },
        ],
        max_tokens: 500,
      });

      const completionText = response.choices?.[0]?.message?.content ?? '';

      if (completionText.length <= discordMaxCharacterCount) {
        await channel.send(completionText);
      } else {
        // attach huge responses as a file
        const stream = new Readable();
        stream.push(completionText);
        stream.push(null);

        await channel.send({
          content: "The response was too long, so I've attached it as a file:",
          files: [
            {
              attachment: stream,
              name: 'response.txt',
            },
          ],
        });
      }
    } catch (error: any) {
      if (error?.response) {
        await channel.send(`🙀 Error: ${error.response.status}, ${JSON.stringify(error.response.data)} 🙀`);
      } else {
        await channel.send(`🙀 Error: ${error.message} 🙀`);
      }
    }
  },
};

export default command;
