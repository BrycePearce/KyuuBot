import { Attachment, Collection, Embed, Message } from 'discord.js';
import { isImageAttachment } from '../../../utils/isImageAttachment';
import { extractMessageImageUrls } from '../../../utils/messageImages';
import { ExtractedEmbedSource, ImproveSource, SUPPORTED_IMAGE_TYPES } from './types';
import { getFilenameFromUrl, normalizeExtractedText } from './utils';

export function extractImproveSource(sourceMessage: Message, textOverride?: string): ImproveSource {
  const attachmentImage = findFirstSupportedImageAttachment(sourceMessage.attachments);
  const messageText = normalizeExtractedText(textOverride ?? sourceMessage.content ?? '');
  const embedSource = extractFromEmbeds(sourceMessage.embeds);
  const safeImageUrl = attachmentImage?.url ?? extractMessageImageUrls(sourceMessage)[0];

  const finalText = normalizeExtractedText([messageText, embedSource.text].filter(Boolean).join('\n\n'));

  return {
    imageUrl: safeImageUrl,
    imageFilename:
      attachmentImage?.name ??
      (safeImageUrl ? (getFilenameFromUrl(safeImageUrl) ?? embedSource.imageFilename) : undefined),
    text: finalText,
    cameFromEmbed: embedSource.hasUsefulEmbedContent,
    embedTitle: embedSource.embedTitle,
  };
}

/** Combines direct command input with optional reply context. */
export function mergeImproveSources(ownSource: ImproveSource, replySource?: ImproveSource): ImproveSource {
  const ownText = normalizeExtractedText(ownSource.text ?? '');
  const replyText = normalizeExtractedText(replySource?.text ?? '');

  return {
    imageUrl: ownSource.imageUrl ?? replySource?.imageUrl,
    imageFilename: ownSource.imageFilename ?? replySource?.imageFilename,
    text: normalizeExtractedText([replyText, ownText].filter(Boolean).join('\n\n')),
    cameFromEmbed: ownSource.cameFromEmbed || Boolean(replySource?.cameFromEmbed),
    embedTitle: ownSource.embedTitle ?? replySource?.embedTitle,
  };
}

function findFirstSupportedImageAttachment(attachments: Collection<string, Attachment>): Attachment | undefined {
  return attachments.find((attachment) => {
    const contentType = attachment.contentType?.toLowerCase();
    if (contentType?.startsWith('image/')) return SUPPORTED_IMAGE_TYPES.has(contentType);

    return isImageAttachment(attachment);
  });
}

function extractFromEmbeds(embeds: readonly Embed[]): ExtractedEmbedSource {
  let imageUrl: string | undefined;
  let imageFilename: string | undefined;
  let embedTitle: string | undefined;
  const textParts: string[] = [];
  let hasUsefulEmbedContent = false;

  for (const embed of embeds) {
    if (!imageUrl) {
      imageUrl = embed.data.image?.url ?? embed.data.thumbnail?.url;

      if (imageUrl) {
        imageFilename = getFilenameFromUrl(imageUrl) ?? 'embed-image.png';
        hasUsefulEmbedContent = true;
      }
    }

    if (!embedTitle && embed.data.title) {
      embedTitle = embed.data.title;
    }

    if (embed.data.title) {
      textParts.push(embed.data.title);
      hasUsefulEmbedContent = true;
    }

    if (embed.data.description) {
      textParts.push(embed.data.description);
      hasUsefulEmbedContent = true;
    }

    if (embed.data.author?.name) {
      textParts.push(`Author: ${embed.data.author.name}`);
      hasUsefulEmbedContent = true;
    }

    if (embed.data.footer?.text) {
      textParts.push(`Footer: ${embed.data.footer.text}`);
      hasUsefulEmbedContent = true;
    }

    if (embed.data.fields?.length) {
      for (const field of embed.data.fields) {
        if (field.name) {
          textParts.push(field.name);
          hasUsefulEmbedContent = true;
        }

        if (field.value) {
          textParts.push(field.value);
          hasUsefulEmbedContent = true;
        }
      }
    }
  }

  return {
    imageUrl,
    imageFilename,
    text: normalizeExtractedText(textParts.join('\n')),
    hasUsefulEmbedContent,
    embedTitle,
  };
}
