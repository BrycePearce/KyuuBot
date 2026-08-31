import { AttachmentBuilder, Message } from 'discord.js';
import { Command } from '../../../types/Command';
import { extractMessageImageUrls, waitForMessageUnfurl } from '../../../utils/messageImages';
import { extractReplySource } from '../../../utils/replySource';
import { NonRetryableError } from '../../../utils/withRetry';
import { getComicVariantMessage, pickComicDirection, pickComicStaging, pickComicTheme } from './creativeDirection';
import { generateComicStrip } from './imageGenerator';
import { generateComicScript } from './scriptGenerator';
import { COMIC_MESSAGES } from './types';
import { startTypingKeepalive } from './typingKeepalive';

const command: Command = {
  name: 'Comic',
  description: 'Generates a three-panel Garfield comic strip from text or an image.',
  invocations: ['comic'],
  args: false,
  enabled: true,
  usage: '.comic [text] — or reply to a message with .comic',

  async execute(message: Message, args: string[]) {
    const channel = message.channel;
    if (!channel.isSendable()) return;

    // Collect own text args and image attachments
    const ownText = args.join(' ').trim() || undefined;
    const sourceMessage = await waitForMessageUnfurl(message);
    const ownImageUrl = extractMessageImageUrls(sourceMessage)[0];

    // Collect reply source
    let replyText: string | undefined;
    let replyImageUrl: string | undefined;

    if (message.reference?.messageId) {
      try {
        const replySource = await extractReplySource(message);
        replyText = replySource?.text;
        replyImageUrl = replySource?.imageUrls[0];
      } catch {
        // Non-fatal — proceed with whatever we have from own message
      }
    }

    // Merge: own content takes priority for text, images from either source
    const text = [replyText, ownText].filter(Boolean).join('\n') || undefined;
    const imageUrl = ownImageUrl ?? replyImageUrl;

    if (!text && !imageUrl) {
      await message.reply(COMIC_MESSAGES.noInput);
      return;
    }

    const theme = pickComicTheme();
    const direction = pickComicDirection();
    const staging = pickComicStaging();
    const selection = { theme: theme.id, direction: direction.id, staging: staging.id };
    const stopTyping = startTypingKeepalive(() => channel.sendTyping());

    try {
      let plannedComic;
      try {
        plannedComic = await generateComicScript({ text, imageUrl, theme, direction, staging });
      } catch (error) {
        console.error('Comic script generation failed:', selection, error);
        const refused = error instanceof NonRetryableError;
        await message.reply(refused ? COMIC_MESSAGES.scriptRefused : COMIC_MESSAGES.scriptFailed);
        return;
      }

      let stripBuffer;
      try {
        stripBuffer = await generateComicStrip(plannedComic.script, theme, plannedComic.plan, imageUrl);
      } catch (error) {
        console.error('Comic image generation failed:', selection, error);
        await message.reply(COMIC_MESSAGES.imageFailed);
        return;
      }

      const attachment = new AttachmentBuilder(stripBuffer, { name: `comic-${theme.id}.png` });
      const variantMessage = getComicVariantMessage(theme);

      await message.reply({ ...(variantMessage ? { content: variantMessage } : {}), files: [attachment] });
    } catch (error) {
      console.error('Error running .comic:', selection, error);
      await message.reply(COMIC_MESSAGES.genericError);
    } finally {
      stopTyping();
    }
  },
};

export default command;
