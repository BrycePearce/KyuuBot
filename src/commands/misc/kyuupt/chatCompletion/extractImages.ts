import { Message } from 'discord.js';

export function extractImageUrls(message: Message): string[] {
  const imageUrls: string[] = [];

  // Collect from message attachments
  message.attachments.forEach((attachment) => {
    if (attachment.contentType?.startsWith('image/')) {
      imageUrls.push(attachment.url);
    }
  });

  // Collect from embedded URLs that look like images
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urlsInMessage = message.content.match(urlRegex);
  if (urlsInMessage) {
    urlsInMessage.forEach((url) => {
      if (url.match(/\.(jpeg|jpg|gif|png)$/i)) {
        imageUrls.push(url);
      }
    });
  }

  return imageUrls;
}
