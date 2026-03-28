import { AttachmentBuilder, EmbedBuilder, Message } from 'discord.js';
import { Readable } from 'stream';
import {
  getCharacterImageOnlyMessage,
  getCharacterOversizedTextWithImageMessage,
  getEmbedFooterText,
  getEmbedPrefix,
} from './character';
import { CharacterVariant, GARFIELD_MESSAGES, GARFIELD_ORANGE, MAX_TEXT_REPLY_LENGTH } from './types';
import { truncateEmbedDescription, truncateEmbedTitle, truncateTextReply } from './utils';

export async function replyWithStandardMode(
  message: Message,
  payload: {
    garfieldText?: string;
    garfieldImage?: AttachmentBuilder;
    variant: CharacterVariant;
  }
): Promise<void> {
  const { garfieldText, garfieldImage, variant } = payload;

  if (garfieldText && garfieldImage) {
    const content = truncateTextReply(garfieldText);

    if (content.length <= MAX_TEXT_REPLY_LENGTH) {
      await message.reply({ content, files: [garfieldImage] });
      return;
    }

    const stream = new Readable();
    stream.push(content);
    stream.push(null);

    await message.reply({
      content: getCharacterOversizedTextWithImageMessage(variant),
      files: [garfieldImage, { attachment: stream, name: 'garfield-response.txt' }],
    });
    return;
  }

  if (garfieldImage) {
    await message.reply({
      content: getCharacterImageOnlyMessage(variant),
      files: [garfieldImage],
    });
    return;
  }

  if (garfieldText) {
    await replyWithPossiblyLargeText(message, garfieldText);
    return;
  }

  await message.reply(GARFIELD_MESSAGES.improveFailed);
}

export async function replyWithEmbedMode(
  message: Message,
  payload: {
    garfieldText?: string;
    garfieldImage?: AttachmentBuilder;
    embedTitle?: string;
    variant: CharacterVariant;
  }
): Promise<void> {
  const { garfieldText, garfieldImage, embedTitle, variant } = payload;

  const embeds: EmbedBuilder[] = [];
  const files: AttachmentBuilder[] = [];

  if (garfieldText) {
    embeds.push(buildGarfieldEmbed(garfieldText, embedTitle, variant));
  }

  if (garfieldImage) {
    files.push(garfieldImage);
  }

  if (!embeds.length && !files.length) {
    await message.reply(GARFIELD_MESSAGES.failedEmbed);
    return;
  }

  if (!embeds.length && files.length) {
    await message.reply({
      content: getCharacterImageOnlyMessage(variant),
      files,
    });
    return;
  }

  await message.reply({ embeds, files });
}

function buildGarfieldEmbed(text: string, title: string | undefined, variant: CharacterVariant): EmbedBuilder {
  const prefix = getEmbedPrefix(variant);
  const safeTitle = title ? truncateEmbedTitle(`${prefix}: ${title}`) : prefix;
  const safeDescription = truncateEmbedDescription(text);

  return new EmbedBuilder()
    .setTitle(safeTitle)
    .setDescription(safeDescription)
    .setColor(GARFIELD_ORANGE)
    .setFooter({ text: getEmbedFooterText(variant) });
}

async function replyWithPossiblyLargeText(message: Message, text: string): Promise<void> {
  const trimmedText = truncateTextReply(text);

  if (trimmedText.length <= MAX_TEXT_REPLY_LENGTH) {
    await message.reply(trimmedText);
    return;
  }

  const stream = new Readable();
  stream.push(trimmedText);
  stream.push(null);

  await message.reply({
    content: GARFIELD_MESSAGES.oversizedText,
    files: [{ attachment: stream, name: 'response.txt' }],
  });
}
