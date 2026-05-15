import Anthropic from '@anthropic-ai/sdk';
import { ComicScript } from './types';

const client = new Anthropic({ apiKey: process.env.claude });

const SYSTEM_PROMPT = [
  'You are a comedy writer for Garfield newspaper comics.',
  'Garfield is a lazy, food-obsessed, smug, selfish, deadpan orange tabby cat who is chronically unimpressed by everything.',
  'Write punchy 3-panel comic scripts with a clear setup → development → punchline structure.',
  'Panel descriptions must be visual and specific: who is in frame, what they are doing, where they are, what expressions they have.',
  'Panel descriptions should be written for an image generator — describe the scene as if painting it, not narrating it.',
  "Captions are Garfield's internal monologue in the caption bar — dry, lazy, blunt, deadpan, mildly mean, food-obsessed, unimpressed.",
  'Keep captions short — one or two punchy lines at most. No internet meme humor.',
  'Dialogue is optional spoken text between characters rendered as speech bubbles.',
  'Use dialogue when it makes the joke land better — e.g. Jon says something, Garfield responds.',
  'Format each dialogue line as "Character: text". Keep it short. Omit dialogue if the panel works better without it.',
  'Return only valid JSON. No markdown fences, no extra text.',
].join(' ');

export async function generateComicScript({
  text,
  imageUrl,
}: {
  text?: string;
  imageUrl?: string;
}): Promise<ComicScript> {
  const contentBlocks: Anthropic.Messages.ContentBlockParam[] = [];

  if (imageUrl) {
    contentBlocks.push({ type: 'image', source: { type: 'url', url: imageUrl } });
  }

  const promptParts: string[] = ['Write a 3-panel Garfield newspaper comic strip script.'];

  if (imageUrl && text) {
    promptParts.push(
      `Base the comic on this image and incorporate this context: "${text}".`,
      'Garfield should react to, interact with, or comment on what is shown.'
    );
  } else if (imageUrl) {
    promptParts.push(
      'Base the comic on what is shown in this image.',
      'Garfield should react to, interact with, or comment on it in some way.'
    );
  } else if (text) {
    promptParts.push(
      `Base the comic on this: "${text}".`,
      'Garfield should react to it, be involved in it, or use it as a jumping-off point.'
    );
  }

  promptParts.push(
    '',
    'Return JSON with exactly this shape:',
    '{ "panels": [ { "description": "...", "caption": "...", "dialogue": ["Character: text"] }, ... ] }',
    '',
    'description: detailed visual description of the panel for an image generator (what characters are present, what they are doing, expressions, setting)',
    'caption: short Garfield-voiced internal monologue for the caption bar (1-2 short lines, his voice, no quotes)',
    'dialogue: optional array of spoken lines as "Character: text" strings. Omit the field entirely if the panel has no dialogue.'
  );

  contentBlocks.push({ type: 'text', text: promptParts.join('\n') });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: contentBlocks }],
    max_tokens: 1024,
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from script generator.');
  }

  // Strip any accidental markdown fences
  const json = textBlock.text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  return JSON.parse(json) as ComicScript;
}
