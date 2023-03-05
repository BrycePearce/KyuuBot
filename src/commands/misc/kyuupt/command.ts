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

const command: Command = {
  name: 'KyuuPT',
  description: 'Integrates OpenAI Api',
  invocations: ['g', 'kyuupt', 'ask', 'askJeeves'],
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

    const temperatureArg = parseValidTemperature(args[0]);
    const isValidUserTemp = temperatureArg !== invalidTempCodes.invalid;
    if (!isValidUserTemp) {
      message.channel.send(
        `🙀 Invalid temperature given. Valid temperatures are percentages, like: 30%, 0.3, or 30 🙀`
      );
      return;
    }

    const defaultSuggestedTemperature = 0.5;
    const shouldUseDefaultTemp = temperatureArg === invalidTempCodes.default;
    const userPrompt = isValidUserTemp ? args.slice(1).join(' ') : args.join(' ');
    const temperature = shouldUseDefaultTemp ? defaultSuggestedTemperature : temperatureArg;

    const defaultPrompt = 'In roughly 40 words, answer the following:';
    const openAIPrompt = `${defaultPrompt} ${userPrompt}`;
    let completionText = '';

    try {
      const response = await openai.createCompletion({
        model: 'text-davinci-003',
        prompt: openAIPrompt,
        temperature,
        max_tokens: 70,
      });
      completionText = response.data.choices[0].text;
    } catch (error: any) {
      if (error?.response) {
        message.channel.send(`🙀 Error: ${error.response.status}, ${error.response.data} 🙀`);
      } else {
        message.channel.send(`🙀 Error: ${error.message} 🙀`);
      }
      return;
    }

    message.channel.send(completionText);
  },
};

// valid:
// '30%' -> 30
//   '3' -> 0.03
// '0.3' -> 0.3
// invalid:
// see response codes
function parseValidTemperature(str: string) {
  const percent = parseFloat(str.replace(/%/g, ''));

  if (isNaN(percent)) return invalidTempCodes.default;
  if (percent < 0 || percent > 100) return invalidTempCodes.invalid;

  return percent >= 1 ? percent / 100 : percent;
}

export default command;
