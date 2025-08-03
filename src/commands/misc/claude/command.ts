import Anthropic from '@anthropic-ai/sdk';
import { ContentBlock } from '@anthropic-ai/sdk/resources/messages';
import { Command } from '../../../types/Command';
import { getRandomEmotePath } from '../../../utils/files';

const client = new Anthropic({
  apiKey: process.env.claude,
});

function processMessageContent(content: ContentBlock[]): string {
  const processedContent: string[] = [];

  for (const block of content) {
    switch (block.type) {
      case 'text':
        processedContent.push(block.text);
        break;
      case 'thinking':
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

    const imageAttachments = [...message.attachments.values()].filter((attachment) =>
      attachment.contentType?.startsWith('image/')
    );

    const contentBlocks: Anthropic.Messages.ContentBlockParam[] = [];

    // Add image blocks first
    for (const attachment of imageAttachments) {
      contentBlocks.push({
        type: 'image',
        source: {
          type: 'url',
          url: attachment.url,
        },
      });
    }

    // Add the text part
    if (userPrompt) {
      contentBlocks.push({
        type: 'text',
        text: userPrompt,
      });
    }

    if (contentBlocks.length === 0) {
      return channel.send('Please provide a question or image for Claude.');
    }

    try {
      const model = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        system: role,
        messages: [
          {
            role: 'user',
            content: contentBlocks,
          },
        ],
        max_tokens: 300,
      });

      const response = processMessageContent(model.content);

      if (!response) {
        return channel.send('🙀 Sorry, I received an empty response from Claude.');
      }

      return channel.send(response);
    } catch (error) {
      console.error('Claude API Error:', error);
      return channel.send({
        content: `🙀 An error occurred while processing your request.`,
        files: [await getRandomEmotePath()],
      });
    }
  },
};

export default command;
