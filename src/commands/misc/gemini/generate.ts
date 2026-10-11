import {
  GoogleGenAI,
  ThinkingLevel,
  type GenerateContentParameters,
  type GenerateContentResponse,
  type Part,
} from '@google/genai';
import sharp from 'sharp';
import { CHAT_MODELS } from '../../../utils/chatModels';
import { fetchBuffer } from '../../../utils/http';

export const MAX_GEMINI_IMAGES = 4;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

interface GeminiDependencies {
  generateContent?: (request: GenerateContentParameters) => Promise<GenerateContentResponse>;
  download?: typeof fetchBuffer;
}

/** Return visible answer text only; thought parts must never reach Discord. */
export function extractGeminiAnswer(response: GenerateContentResponse): string {
  if (response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
    throw new Error('Gemini reached its output limit before finishing the answer');
  }
  const text = (response.candidates?.[0]?.content?.parts ?? [])
    .filter((part) => !part.thought && typeof part.text === 'string')
    .map((part) => part.text)
    .join('')
    .trim();
  if (!text) throw new Error('Gemini returned no answer text');
  return text;
}

export async function generateGeminiAnswer(
  prompt: string,
  imageUrls: string[],
  dependencies: GeminiDependencies = {}
): Promise<string> {
  const urls = [...new Set(imageUrls)];
  if (urls.length > MAX_GEMINI_IMAGES) throw new Error(`Use at most ${MAX_GEMINI_IMAGES} images`);
  if (!prompt.trim() && !urls.length) throw new Error('Provide a question or image');
  const parts: Part[] = prompt.trim() ? [{ text: prompt }] : [];
  // Sequential downloads bound memory and avoid starting work after a failure.
  for (const url of urls) {
    const image = await (dependencies.download ?? fetchBuffer)(url, { maxBytes: MAX_IMAGE_BYTES, timeoutMs: 20_000 });
    const metadata = await sharp(image, { limitInputPixels: 32_000_000 }).metadata();
    const mimeType = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }[metadata.format];
    if (!mimeType) throw new Error('Use a PNG, JPEG, or WebP image');
    parts.push({ inlineData: { mimeType, data: image.toString('base64') } });
  }
  const request: GenerateContentParameters = {
    model: CHAT_MODELS.gemini,
    contents: [{ role: 'user', parts }],
    config: {
      systemInstruction:
        'You are a helpful assistant. Your response should be 80 words or less, unless necessary for a full answer.',
      maxOutputTokens: 32768,
      thinkingConfig: { includeThoughts: false, thinkingLevel: ThinkingLevel.HIGH },
      httpOptions: { timeout: 180_000 },
    },
  };
  // Lazy construction allows missing credentials to use the command error path.
  const generate =
    dependencies.generateContent ??
    ((parameters: GenerateContentParameters) => {
      const client = new GoogleGenAI({ apiKey: process.env.geminiApi });
      return client.models.generateContent(parameters);
    });
  return extractGeminiAnswer(await generate(request));
}
