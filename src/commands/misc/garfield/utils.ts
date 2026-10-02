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

/** Closest supported output shape, so wide memes and tall screenshots are not squashed into a square. */
export function pickEditSize(width: number, height: number): '1024x1024' | '1536x1024' | '1024x1536' {
  const ratio = width / height;
  if (ratio >= 1.25) return '1536x1024';
  if (ratio <= 0.8) return '1024x1536';
  return '1024x1024';
}

/** True when OpenAI's image safety system rejected the request or the generated image. */
export function isModerationBlocked(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'moderation_blocked';
}

/** The useful part of a moderation rejection; the default error log collapses the categories array. */
export function describeModerationBlock(error: unknown): string {
  const details = (error as { error?: { moderation_details?: unknown } }).error?.moderation_details;
  const requestId = (error as { requestID?: unknown }).requestID;
  return `${JSON.stringify(details ?? null)} (request ${String(requestId ?? 'unknown')})`;
}
