import { Message } from 'discord.js';

export interface ReplySource {
  text?: string;
  imageUrls: string[];
}

/**
 * If the message is a reply, fetches the referenced message and extracts
 * its text content and image URLs (from attachments and embeds).
 * Returns null if the message is not a reply or the reference can't be fetched.
 */
export async function extractReplySource(message: Message): Promise<ReplySource | null> {
  if (!message.reference?.messageId) return null;

  let referenced: Message;
  try {
    referenced = await message.fetchReference();
  } catch {
    return null;
  }

  const text = referenced.content?.trim() || undefined;

  const imageUrls: string[] = [];

  referenced.attachments.forEach((attachment) => {
    if (attachment.contentType?.startsWith('image/')) {
      imageUrls.push(attachment.url);
    }
  });

  for (const embed of referenced.embeds) {
    const url = embed.data.image?.url ?? embed.data.thumbnail?.url;
    if (url && !imageUrls.includes(url)) {
      imageUrls.push(url);
    }
  }

  return { text, imageUrls };
}
