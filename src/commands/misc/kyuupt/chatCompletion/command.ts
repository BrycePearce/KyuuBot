import OpenAI from 'openai';

import { Readable } from 'stream';

import type { Command } from '../../../../types/Command';

const openai = new OpenAI({
  apiKey: process.env.gptChatCompletion,
});
const invalidTempCodes = {
  invalid: -1,
  default: -2,
};
const discordMaxCharacterCount = 2000;

const command: Command = {
  name: 'KyuuPT',
  description: 'Integrates OpenAI Api',
  invocations: ['kyuupt', 'ask', 'askJeeves', 'chat', 'write'],
  args: false,
  enabled: true,
  usage: '[invocation] [temperature (percent or decimal e.g. 30, 30%, or 0.3)] [query]',
  async execute(message, args) {
    const channel = message.channel;
    if (!channel.isSendable()) return;
    if (args.length === 0) {
      channel.send('🙀 To use KyuuPT, you need to add a prompt to your invocation. For example .ask [question] 🙀');
      return;
    }

    const userPrompt = args.join(' ');

    try {
      const response = await openai.chat.completions.create({
        model: 'chatgpt-4o-latest',
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant. Your response should be 80 words or less, unless necessary for a full answer.',
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });
      const completionText = response.choices[0].message.content;

      if (completionText && completionText.length <= discordMaxCharacterCount) {
        channel.send(completionText);
        return;
      }

      const stream = new Readable();
      stream.push(completionText);
      stream.push(null); // end

      channel.send({
        files: [
          {
            attachment: stream,
            name: 'response.txt',
          },
        ],
        content: `The response was too long, so I've attached it as a file`,
      });
    } catch (error: any) {
      if (error?.response) {
        channel.send(`🙀 Error: ${error.response.status}, ${JSON.stringify(error.response.data)} 🙀`);
      } else {
        channel.send(`🙀 Error: ${error.message} 🙀`);
      }
      return;
    }
  },
};

// valid: numbers 0 - 2
// 30 -> 0.3
// 30% -> 0.3
// 100 -> 2
// invalid:
// see response codes
function mapPercentToValue(percent: string): number {
  const percentAsNumber = parseFloat(percent.replace(/%/g, ''));
  if (isNaN(percentAsNumber)) return invalidTempCodes.default;
  if (percentAsNumber < 0 || percentAsNumber > 100) return invalidTempCodes.invalid;
  const value = (percentAsNumber / 100) * 2;
  return Number(value.toFixed(2));
}

export default command;
