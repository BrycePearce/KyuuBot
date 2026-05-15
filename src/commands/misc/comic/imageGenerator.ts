import OpenAI from 'openai';
import { ComicScript, STRIP_HEIGHT, STRIP_WIDTH } from './types';

const imageClient = new OpenAI({ apiKey: process.env.gptImageGen });

export async function generateComicStrip(script: ComicScript): Promise<Buffer> {
  const prompt = buildPrompt(script);

  const response = await imageClient.images.generate({
    model: 'gpt-image-2',
    prompt,
    n: 1,
    size: `${STRIP_WIDTH}x${STRIP_HEIGHT}` as any,
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image data returned from image generator.');

  return Buffer.from(b64, 'base64');
}

function buildPrompt(script: ComicScript): string {
  const [p1, p2, p3] = script.panels;

  return [
    'Create a three-panel comic strip featuring Garfield.',
    '',
    'Art style: classic American newspaper comic — bold black ink outlines, flat cel-colored fills, clean white backgrounds, expressive rubbery cartoon faces, no gradients or shading.',
    '',
    'Layout: three equal vertical panels arranged left to right, separated by thick black vertical divider lines. Each panel has a white caption bar at the very bottom with the caption text in black. Speech bubbles appear inside the panel art when characters speak.',
    '',
    `Panel 1 (left): ${p1.description}`,
    `  Caption bar text: "${p1.caption}"`,
    ...(p1.dialogue?.length ? [`  Speech bubbles: ${p1.dialogue.join(' / ')}`] : []),
    '',
    `Panel 2 (center): ${p2.description}`,
    `  Caption bar text: "${p2.caption}"`,
    ...(p2.dialogue?.length ? [`  Speech bubbles: ${p2.dialogue.join(' / ')}`] : []),
    '',
    `Panel 3 (right): ${p3.description}`,
    `  Caption bar text: "${p3.caption}"`,
    ...(p3.dialogue?.length ? [`  Speech bubbles: ${p3.dialogue.join(' / ')}`] : []),
    '',
    'Render all caption bar text and speech bubble text accurately and legibly.',
    'Garfield must be visually consistent across all three panels.',
    'The three panels read left to right as a single coherent comic strip sequence.',
  ].join('\n');
}
