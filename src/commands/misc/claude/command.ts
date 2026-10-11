import Anthropic from '@anthropic-ai/sdk';
import { readClaudeError, readClaudeResponse } from './response';
import { Command } from '../../../types/Command';
import { extractMessageImageUrls, waitForMessageUnfurl } from '../../../utils/messageImages';
import { extractReplySource } from '../../../utils/replySource';

const client = new Anthropic({
  apiKey: process.env.claude,
});

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
      const sourceMessage = await waitForMessageUnfurl(message);
      const ownImageUrls = extractMessageImageUrls(sourceMessage);

      const replySource = await extractReplySource(message);

      const contentBlocks: Anthropic.Messages.ContentBlockParam[] = [];

      // Add image blocks first (own images/embeds, then any from replied-to message)
      for (const url of ownImageUrls) {
        contentBlocks.push({ type: 'image', source: { type: 'url', url } });
      }
      for (const url of replySource?.imageUrls ?? []) {
        if (!ownImageUrls.includes(url)) {
          contentBlocks.push({ type: 'image', source: { type: 'url', url } });
        }
      }

      // Add the text part — reply context first, then the user's own prompt
      if (replySource?.text) {
        contentBlocks.push({ type: 'text', text: `Replied-to message: "${replySource.text}"` });
      }
      if (userPrompt) {
        contentBlocks.push({ type: 'text', text: userPrompt });
      }

      if (contentBlocks.length === 0) {
        return await channel.send('Please provide a question or image for Claude.');
      }

      const model = await client.messages.create({
        model: 'claude-sonnet-4-6',
        system: role,
        messages: [
          {
            role: 'user',
            content: contentBlocks,
          },
        ],
        max_tokens: 600,
      });

      const response = readClaudeResponse(model);

      if (!response) {
        console.warn('Claude returned no answer text:', {
          id: model.id,
          model: model.model,
          stopReason: model.stop_reason,
          usage: model.usage,
          contentTypes: model.content.map((block) => block.type),
        });
        return await channel.send(
          model.stop_reason === 'max_tokens'
            ? '🙀 Claude reached its response limit before producing an answer. Please try a shorter question.'
            : '🙀 Claude returned no answer. Please try again.'
        );
      }

      // Claude's token limit can still produce more than Discord's 2,000 characters.
      for (let offset = 0; offset < response.length; offset += 2000) {
        await channel.send(response.slice(offset, offset + 2000));
      }
    } catch (error) {
      console.error('Claude command error:', error);
      // Keep failure replies independent of local emote files.
      try {
        return await channel.send(readClaudeError(error));
      } catch (sendError) {
        console.error('Unable to send Claude failure reply:', sendError);
      }
    }
  },
};

export default command;
