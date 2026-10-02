import { AttachmentBuilder } from 'discord.js';
import sharp from 'sharp';
import openaiClient from '../../../utils/clients/openaiClient';
import { withRetry } from '../../../utils/withRetry';
import { characterifiedFilename } from './character';
import { buildImageEditPrompt } from './prompts';
import {
  CharacterVariant,
  DEFAULT_IMAGE_TYPE,
  GarfieldEditPlan,
  GarfieldSourceBrief,
  MAX_IMAGE_DIMENSION,
} from './types';
import { ensureExtension, pickEditSize } from './utils';

export async function renderGarfieldEdit({
  imageUrl,
  originalFilename = 'source.png',
  variant,
  plan,
  sourceBrief,
}: {
  imageUrl: string;
  originalFilename?: string;
  variant: CharacterVariant;
  plan: GarfieldEditPlan;
  sourceBrief: GarfieldSourceBrief;
}): Promise<AttachmentBuilder> {
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    throw new Error(`Failed to fetch source image: ${imageRes.status} ${imageRes.statusText}`);
  }

  const { buffer, width, height } = await normalizeSourceImage(Buffer.from(await imageRes.arrayBuffer()));
  const inputFilename = ensureExtension(originalFilename, DEFAULT_IMAGE_TYPE);
  const prompt = buildImageEditPrompt({ variant, plan, sourceBrief });

  const outputBuffer = await withRetry(
    async () => {
      const response = await openaiClient.images.edit({
        model: 'gpt-image-2',
        image: new File([buffer], inputFilename, { type: DEFAULT_IMAGE_TYPE }),
        prompt,
        size: pickEditSize(width, height),
        output_format: 'png',
        quality: 'high',
      });

      const base64Image = response.data?.[0]?.b64_json;
      if (!base64Image) throw new Error('No edited image returned from image model.');
      return Buffer.from(base64Image, 'base64');
    },
    {
      attempts: 2,
      onRetry: (error, nextAttempt) =>
        console.warn(
          `Garfield image edit failed, retrying (attempt ${nextAttempt}):`,
          error instanceof Error ? error.message : String(error)
        ),
    }
  );

  return new AttachmentBuilder(outputBuffer, { name: `${characterifiedFilename(variant)}.png` });
}

async function normalizeSourceImage(sourceBuffer: Buffer): Promise<{ buffer: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(sourceBuffer)
    .rotate()
    .resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png()
    .toBuffer({ resolveWithObject: true });

  return { buffer: data, width: info.width, height: info.height };
}
