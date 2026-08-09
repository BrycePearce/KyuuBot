import OpenAI, { toFile, type Uploadable } from 'openai';
import sharp from 'sharp';
import { buildImagePrompt } from './prompts';
import {
  ComicDirectionDefinition,
  ComicScript,
  ComicStagingDefinition,
  ComicThemeDefinition,
  STRIP_HEIGHT,
  STRIP_WIDTH,
} from './types';

export async function generateComicStrip(
  script: ComicScript,
  theme: ComicThemeDefinition,
  direction: ComicDirectionDefinition,
  staging: ComicStagingDefinition,
  imageUrl?: string
): Promise<Buffer> {
  const imageClient = new OpenAI({ apiKey: process.env.gptImageGen });
  const hasReferenceImage = Boolean(imageUrl);
  const prompt = buildImagePrompt(script, theme, direction, staging, hasReferenceImage);

  const response = imageUrl
    ? await imageClient.images.edit(buildComicImageEditRequest(await downloadReferenceImage(imageUrl), prompt))
    : await imageClient.images.generate({
        model: 'gpt-image-2',
        prompt,
        n: 1,
        output_format: 'png',
        size: `${STRIP_WIDTH}x${STRIP_HEIGHT}` as any,
      });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image data returned from image generator.');

  return Buffer.from(b64, 'base64');
}

export function buildComicImageEditRequest(image: Uploadable, prompt: string) {
  return {
    model: 'gpt-image-2',
    image,
    prompt,
    n: 1,
    output_format: 'png' as const,
    size: `${STRIP_WIDTH}x${STRIP_HEIGHT}` as '1024x1024',
  };
}

async function downloadReferenceImage(imageUrl: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch comic reference image: ${response.status} ${response.statusText}`);
  }

  const sourceBuffer = Buffer.from(await response.arrayBuffer());
  const normalizedBuffer = await sharp(sourceBuffer)
    .rotate()
    .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .png()
    .toBuffer();

  return toFile(normalizedBuffer, 'comic-reference.png', { type: 'image/png' });
}
