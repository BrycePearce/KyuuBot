import type { MessageCreateOptions } from 'discord.js';
import { Command } from '../../../types/Command';
import { getRandomEmotePath } from '../../../utils/files';
import { extractReplySource } from '../../../utils/replySource';
import { startTypingKeepalive } from '../comic/typingKeepalive';
import { generateGeminiAnswer } from './generate';

const command: Command = {
  name: 'Gemini',
  description: 'Generates an answer to a question',
  invocations: ['g', 'gemini'],
  args: true,
  enabled: true,
  usage: '[invocation]',
  async execute(message, args) {
    const channel = message.channel;
    if (!channel.isSendable()) return;
    const stopTyping = startTypingKeepalive(
      async () => channel.sendTyping(),
      8000,
      (error) => console.warn('Gemini typing indicator failed:', error)
    );
    try {
      const replySource = await extractReplySource(message);
      const imageUrls = [...message.attachments.values()]
        .filter((attachment) => attachment.contentType?.startsWith('image/'))
        .map((attachment) => attachment.url);
      imageUrls.push(...(replySource?.imageUrls ?? []));
      const userPrompt = args.join(' ');
      const prompt = replySource?.text ? `Replied-to message: "${replySource.text}"\n\n${userPrompt}` : userPrompt;
      const text = await generateGeminiAnswer(prompt, imageUrls);
      return await channel.send(
        text.length <= 2000
          ? { content: text, allowedMentions: { parse: [] } }
          : {
              content: 'The full response is attached.',
              files: [{ attachment: Buffer.from(text, 'utf8'), name: 'gemini-response.txt' }],
              allowedMentions: { parse: [] },
            }
      );
    } catch (error) {
      console.error('Gemini command error:', error);
      const errorMessage: MessageCreateOptions = {
        content:
          'There was a problem generating your response. Please try again with up to four PNG, JPEG, or WebP images under 3 MB each.',
        allowedMentions: { parse: [] },
      };
      try {
        return await channel.send({ ...errorMessage, files: [await getRandomEmotePath()] });
      } catch (imageError) {
        console.warn('Gemini error image could not be sent:', imageError);
        try {
          return await channel.send(errorMessage);
        } catch (sendError) {
          console.error('Gemini error message could not be sent:', sendError);
        }
      }
    } finally {
      stopTyping();
    }
  },
};

export default command;
