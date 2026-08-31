import { Message } from 'discord.js';
import { isImageAttachment } from './isImageAttachment';

const directImageUrlPattern = /\.(?:gif|jpe?g|png|webp)(?:$|[?#])/i;
const webUrlPattern = /https?:\/\/[^\s<>]+/gi;
const defaultUnfurlWaitMs = 1_000;

function isSafeRemoteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Extracts image URLs Discord has already exposed; it never fetches arbitrary links. */
export function extractMessageImageUrls(message: Message): string[] {
  const imageUrls: string[] = [];
  const addUrl = (url?: string) => {
    if (url && isSafeRemoteUrl(url) && !imageUrls.includes(url)) imageUrls.push(url);
  };

  message.attachments.forEach((attachment) => {
    if (isImageAttachment(attachment)) addUrl(attachment.url);
  });

  for (const embed of message.embeds) {
    // Prefer the full embed image. A thumbnail is often a lower-resolution copy.
    addUrl(embed.data.image?.url ?? embed.data.thumbnail?.url);
  }

  for (const match of message.content.matchAll(webUrlPattern)) {
    if (directImageUrlPattern.test(match[0])) addUrl(match[0]);
  }

  return imageUrls;
}

/**
 * Social previews can be added just after messageCreate. If a message contains
 * a web link but no usable image yet, wait once and refetch it from Discord.
 */
export async function waitForMessageUnfurl(message: Message, waitMs = defaultUnfurlWaitMs): Promise<Message> {
  if (extractMessageImageUrls(message).length > 0 || !message.content.match(webUrlPattern)) return message;

  if (waitMs > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
  }

  try {
    return await message.fetch();
  } catch {
    return message;
  }
}
