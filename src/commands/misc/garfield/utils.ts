import { MAX_EMBED_DESCRIPTION_LENGTH, MAX_EMBED_TITLE_LENGTH, MAX_TEXT_REPLY_LENGTH } from './types';

export function truncateTextReply(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_TEXT_REPLY_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_TEXT_REPLY_LENGTH - 3).trimEnd()}...`;
}

export function truncateEmbedDescription(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_EMBED_DESCRIPTION_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_EMBED_DESCRIPTION_LENGTH - 3).trimEnd()}...`;
}

export function truncateEmbedTitle(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_EMBED_TITLE_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_EMBED_TITLE_LENGTH - 3).trimEnd()}...`;
}

export function normalizeExtractedText(text: string): string | undefined {
  const normalized = text
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return normalized.length ? normalized : undefined;
}

export function ensureExtension(filename: string, contentType: string): string {
  const hasExtension = /\.[a-z0-9]+$/i.test(filename);
  if (hasExtension) return filename;

  switch (contentType) {
    case 'image/jpeg':
    case 'image/jpg':
      return `${filename}.jpg`;
    case 'image/webp':
      return `${filename}.webp`;
    case 'image/png':
    default:
      return `${filename}.png`;
  }
}

export function getFilenameFromUrl(url: string): string | undefined {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split('/');
    return parts[parts.length - 1] || undefined;
  } catch {
    return undefined;
  }
}

export function isShortInput(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  return trimmed.length <= 25 || wordCount <= 4;
}
