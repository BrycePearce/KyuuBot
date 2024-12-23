import OpenAI from 'openai';

if (!process.env.gptChatCompletion) {
  throw new Error('Missing OpenAI API key in environment variable gptChatCompletion');
}

const openaiClient = new OpenAI({
  apiKey: process.env.gptChatCompletion,
});

export default openaiClient;
