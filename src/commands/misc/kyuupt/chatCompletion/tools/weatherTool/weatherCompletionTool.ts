import { ChatCompletionTool } from 'openai/resources/chat/completions';

export const weatherTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Gets current weather for a given location.',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'The city or place name to look up.',
        },
      },
      required: ['location'],
    },
  },
};
