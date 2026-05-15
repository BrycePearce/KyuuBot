import { AttachmentBuilder, Message } from 'discord.js';
import { Command } from '../../../types/Command';
import { extractReplySource } from '../../../utils/replySource';
import { generateComicStrip } from './imageGenerator';
import { generateComicScript } from './scriptGenerator';
import { COMIC_MESSAGES } from './types';

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
    const ownImageUrl = [...message.attachments.values()].find((a) => a.contentType?.startsWith('image/'))?.url;

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

    try {
      await channel.sendTyping();

      let script;
      try {
        script = await generateComicScript({ text, imageUrl });
      } catch (error) {
        console.error('Comic script generation failed:', error);
        await message.reply(COMIC_MESSAGES.scriptFailed);
        return;
      }

      let stripBuffer;
      try {
        stripBuffer = await generateComicStrip(script);
      } catch (error) {
        console.error('Comic image generation failed:', error);
        await message.reply(COMIC_MESSAGES.imageFailed);
        return;
      }

      const attachment = new AttachmentBuilder(stripBuffer, { name: 'comic.png' });

      await message.reply({ files: [attachment] });
    } catch (error) {
      console.error('Error running .comic:', error);
      await message.reply(COMIC_MESSAGES.genericError);
    }
  },
};

export default command;
