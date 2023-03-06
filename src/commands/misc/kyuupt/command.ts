import { Configuration, OpenAIApi } from 'openai';

import type { Command } from '../../../types/Command';

const configuration = new Configuration({
  apiKey: process.env.kyuuPT,
});
const openai = new OpenAIApi(configuration);

const invalidTempCodes = {
  invalid: -1,
  default: -2,
};
// const max_tokens = 250;

const command: Command = {
  name: 'KyuuPT',
  description: 'Integrates OpenAI Api',
  invocations: ['g', 'kyuupt', 'ask', 'askJeeves', 'chat'],
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
    const temperature = shouldUseDefaultTemp ? undefined : temperatureArg;

    let completionText = '';

    try {
      const response = await openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: userPrompt, name: 'user' }],
        ...(temperature && { temperature }),
        // temperature,
        // max_tokens,
      });
      completionText = response.data.choices[0].message.content;
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

    message.channel.send(completionText);
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
