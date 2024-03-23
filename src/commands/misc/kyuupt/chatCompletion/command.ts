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
    if (args.length === 0) {
      message.channel.send(
        '🙀 To use KyuuPT, you need to add a prompt to your invocation. For example .ask [question] 🙀'
      );
      return;
    }

    const temperatureArg = mapPercentToValue(args[0]);
    const isValidUserTemp = temperatureArg !== invalidTempCodes.invalid;
    if (!isValidUserTemp) {
      message.channel.send(
        `🙀 \nInvalid temperature given. Valid temperatures are percentages are between 0 and 100. \nHigher values like 50% will make the output more random, while lower values like 0% will make it more focused and deterministic \n🙀`
      );
      return;
    }

    const shouldUseDefaultTemp = temperatureArg === invalidTempCodes.default;
    const userPrompt = isValidUserTemp ? args.slice(1).join(' ') : args.join(' ');
    const temperature = shouldUseDefaultTemp ? 0.7 : temperatureArg;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-1106-preview',
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
        ...(temperature && { temperature }),
      });
      const completionText = response.choices[0].message.content;

      if (completionText && completionText.length <= discordMaxCharacterCount) {
        message.channel.send(completionText);
        return;
      }

      const stream = new Readable();
      stream.push(completionText);
      stream.push(null); // end

      message.channel.send({
        files: [
          {
            attachment: stream,
            name: 'response.txt',
          },
        ],
        content: `The response was too long, so I've attached it as a file`,
      });
    } catch (error: any) {
      console.log(error);
      if (error?.response) {
        console.log(error.response.data);
        message.channel.send(`🙀 Error: ${error.response.status}, ${JSON.stringify(error.response.data)} 🙀`);
      } else {
        console.log(error.message);
        message.channel.send(`🙀 Error: ${error.message} 🙀`);
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
