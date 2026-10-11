import Anthropic from '@anthropic-ai/sdk';
import { readClaudeError, readClaudeResponse } from './response';
import { buildClaudeRequest, CLAUDE_REQUEST_TIMEOUT_MS } from './request';
import { sendClaudeFailure } from './failure';
import { Command } from '../../../types/Command';
import { extractMessageImageUrls, waitForMessageUnfurl } from '../../../utils/messageImages';
import { extractReplySource } from '../../../utils/replySource';
import { startTypingKeepalive } from '../comic/typingKeepalive';

const client = new Anthropic({
  apiKey: process.env.claude,
  timeout: CLAUDE_REQUEST_TIMEOUT_MS,
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
    const stopTyping = startTypingKeepalive(
      async () => {
        await channel.sendTyping();
      },
      undefined,
      (error) => console.warn('Failed to refresh Claude typing indicator:', error)
    );

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
        return await sendClaudeFailure(
          (options) => channel.send(options),
          'Please provide a question or image for Claude.'
        );
      }

      const model = await client.messages.create(buildClaudeRequest(contentBlocks));

      const response = readClaudeResponse(model);

      if (model.stop_reason === 'refusal') {
        return await sendClaudeFailure((options) => channel.send(options), response);
      }

      if (!response) {
        console.warn('Claude returned no answer text:', {
          id: model.id,
          model: model.model,
          stopReason: model.stop_reason,
          usage: model.usage,
          contentTypes: model.content.map((block) => block.type),
        });
        return await sendClaudeFailure(
          (options) => channel.send(options),
          model.stop_reason === 'max_tokens'
            ? '🙀 Claude reached its response limit before producing an answer. Please try a shorter question.'
            : '🙀 Claude returned no answer. Please try again.'
        );
      }

      // Claude's token limit can still produce more than Discord's 2,000 characters.
      for (let offset = 0; offset < response.length; offset += 2000) {
        await channel.send({ content: response.slice(offset, offset + 2000), allowedMentions: { parse: [] } });
      }
    } catch (error) {
      console.error('Claude command error:', error);
      await sendClaudeFailure((options) => channel.send(options), readClaudeError(error));
    } finally {
      stopTyping();
    }
  },
};

export default command;
