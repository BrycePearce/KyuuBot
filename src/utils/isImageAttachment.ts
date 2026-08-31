import { Attachment } from 'discord.js';

const supportedImageExtension = /\.(?:gif|jpe?g|png|webp)(?:$|[?#])/i;

type AttachmentImageMetadata = Pick<Attachment, 'contentType' | 'name' | 'url'>;

/**
 * Discord does not always populate an attachment's contentType. Fall back to
 * the uploaded filename and CDN URL so ordinary image uploads still reach the
 * multimodal model.
 */
export function isImageAttachment(attachment: AttachmentImageMetadata): boolean {
  if (attachment.contentType?.toLowerCase().startsWith('image/')) return true;

  return supportedImageExtension.test(attachment.name ?? '') || supportedImageExtension.test(attachment.url);
}
