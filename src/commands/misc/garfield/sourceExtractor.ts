import { Attachment, Collection, Embed, Message } from 'discord.js';
import { ExtractedEmbedSource, ImproveSource, SUPPORTED_IMAGE_TYPES } from './types';
import { getFilenameFromUrl, normalizeExtractedText } from './utils';

export function extractImproveSource(repliedToMessage: Message): ImproveSource {
  const attachmentImage = findFirstSupportedImageAttachment(repliedToMessage.attachments);
  const messageText = normalizeExtractedText(repliedToMessage.content ?? '');
  const embedSource = extractFromEmbeds(repliedToMessage.embeds);

  const finalText = normalizeExtractedText([messageText, embedSource.text].filter(Boolean).join('\n\n'));

  return {
    imageUrl: attachmentImage?.url ?? embedSource.imageUrl,
    imageFilename: attachmentImage?.name ?? embedSource.imageFilename,
    text: finalText,
    cameFromEmbed: embedSource.hasUsefulEmbedContent,
    embedTitle: embedSource.embedTitle,
  };
}

function findFirstSupportedImageAttachment(attachments: Collection<string, Attachment>): Attachment | undefined {
  return attachments.find((attachment) => {
    return Boolean(attachment.contentType && SUPPORTED_IMAGE_TYPES.has(attachment.contentType.toLowerCase()));
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
