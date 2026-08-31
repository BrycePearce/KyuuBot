import { Message } from 'discord.js';
import { extractMessageImageUrls } from '../../../../utils/messageImages';

export function extractImageUrls(message: Message): string[] {
  return extractMessageImageUrls(message);
}
