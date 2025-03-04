import Anthropic from '@anthropic-ai/sdk';
import { ContentBlock } from '@anthropic-ai/sdk/resources/messages';
import { Command } from '../../../types/Command';

const client = new Anthropic({
  apiKey: process.env.claude,
});

// Helper function to process message content
function processMessageContent(content: ContentBlock[]): string {
  const processedContent: string[] = [];

  for (const block of content) {
    switch (block.type) {
      case 'text':
        processedContent.push(block.text);
        break;
      case 'thinking':
        // Optionally include Claude's thinking process
        processedContent.push(`💭 ${block.thinking}`);
        break;
      case 'redacted_thinking':
        console.log('Redacted thinking detected');
        break;
      default:
        console.warn(`Unknown content type: ${(block as any).type}`);
    }
  }

  return processedContent.join('\n');
}
const command: Command = {
  name: 'Claude',
  description: 'Implements Claude AI',
  invocations: ['c', 'claude'],
  args: true,
  enabled: true,
  usage: '[invocation]',
  async execute(message, args) {
    const channel = message.channel;
    if (!channel.isSendable()) return;

    const userPrompt = args.join(' ');
    const role =
      'You are a helpful assistant. Your response should be 80 words or less, unless necessary for a full answer.';

    try {
      const model = await client.messages.create({
        model: 'claude-3-5-sonnet-latest',
        system: role,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        max_tokens: 100,
      });

      const response = processMessageContent(model.content);

      if (!response) {
        return channel.send('🙀 Sorry, I received an empty response from Claude.');
      }

      return channel.send(response);
    } catch (error) {
      console.error('Claude API Error:', error);
      return channel.send(`🙀 An error occurred while processing your request. Please try again later.`);
    }
  },
};

export default command;
