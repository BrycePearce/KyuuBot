import { GoogleGenerativeAI } from '@google/generative-ai';
import { Command } from '../../../types/Command';

const genAI = new GoogleGenerativeAI(process.env.geminiApi);

const command: Command = {
  name: 'Gemini',
  description: 'Generates an answer to a question',
  invocations: ['g', 'gemini'],
  args: true,
  enabled: true,
  usage: '[invocation]',
  async execute(message, args) {
    const userPrompt = args.join(' ');
    const role =
      'You are a helpful assistant. Your response should be 80 words or less, unless necessary for a full answer.';
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const result = await model.generateContent(`${role} ${userPrompt}`);
    const response = await result.response;
    const text = response.text();
    message.channel.send(text);
  },
};

export default command;
