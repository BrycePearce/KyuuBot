import { Command } from '../../../../types/Command';
import openaiClient from '../../../../utils/clients/openaiClient';
import { getRandomEmotePath } from '../../../../utils/files';
import { waitForMessageUnfurl } from '../../../../utils/messageImages';
import { extractReplySource } from '../../../../utils/replySource';
import { startTypingKeepalive } from '../../comic/typingKeepalive';
import { buildContentArray } from './buildContentArray';
import { extractImageUrls } from './extractImages';
import { readChatError, requestChatAnswer } from './request';

const command: Command = {
  name: 'KyuuPT',
  description: 'Answers text and image questions with OpenAI.',
  invocations: ['kyuupt', 'ask', 'askJeeves', 'chat', 'write'],
  args: true,
  enabled: true,
  usage: '[invocation] [query]',
  async execute(message, args) {
    const channel = message.channel;
    if (!channel.isSendable()) return;
    const stopTyping = startTypingKeepalive(
      () => channel.sendTyping(),
      undefined,
      (error) => console.warn('Unable to refresh OpenAI typing indicator:', error)
    );
    try {
      const userPrompt = args.join(' ');
      const sourceMessage = await waitForMessageUnfurl(message);
      const imageUrls = extractImageUrls(sourceMessage);
      const replySource = await extractReplySource(message);
      for (const url of replySource?.imageUrls ?? []) {
        if (!imageUrls.includes(url)) imageUrls.push(url);
      }
      const fullPrompt = replySource?.text ? `Replied-to message: "${replySource.text}"\n\n${userPrompt}` : userPrompt;
      const content = buildContentArray(fullPrompt, imageUrls);
      if (!content.length) {
        await channel.send({
          content: 'Please provide a question or image, or reply to a message with .ask.',
          allowedMentions: { parse: [] },
        });
        return;
      }
      const answer = await requestChatAnswer(openaiClient, content);
      await channel.send(
        answer.length <= 2000
          ? { content: answer, allowedMentions: { parse: [] } }
          : {
              content: "The response was too long, so I've attached it as a file:",
              files: [{ attachment: Buffer.from(answer, 'utf8'), name: 'response.txt' }],
              allowedMentions: { parse: [] },
            }
      );
    } catch (error) {
      console.error('OpenAI chat command failed:', error);
      const response = { content: readChatError(error), allowedMentions: { parse: [] as const } };
      try {
        await channel.send({ ...response, files: [await getRandomEmotePath()] });
      } catch (sendError) {
        console.error('Unable to send OpenAI error image:', sendError);
        try {
          await channel.send(response);
        } catch (fallbackError) {
          console.error('Unable to send OpenAI failure reply:', fallbackError);
        }
      }
    } finally {
      stopTyping();
    }
  },
};

export default command;
