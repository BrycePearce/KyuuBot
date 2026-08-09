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

  const textParts: string[] = [];
  if (referenced.content?.trim()) textParts.push(referenced.content.trim());

  const imageUrls: string[] = [];

  referenced.attachments.forEach((attachment) => {
    if (attachment.contentType?.startsWith('image/')) {
      imageUrls.push(attachment.url);
    }
  });

  for (const embed of referenced.embeds) {
    const embedText = [
      embed.data.author?.name,
      embed.data.title,
      embed.data.description,
      ...(embed.data.fields ?? []).flatMap((field) => [field.name, field.value]),
      embed.data.footer?.text,
    ].filter((value): value is string => Boolean(value?.trim()));

    textParts.push(...embedText);

    const url = embed.data.image?.url ?? embed.data.thumbnail?.url;
    if (url && !imageUrls.includes(url)) {
      imageUrls.push(url);
    }
  }

  const text = textParts.join('\n').trim().slice(0, 12_000) || undefined;
  return { text, imageUrls };
}
