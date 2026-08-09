import Anthropic from '@anthropic-ai/sdk';
import { buildScriptSystemPrompt, buildScriptUserPrompt } from './prompts';
import { ComicDirectionDefinition, ComicScript, ComicStagingDefinition, ComicThemeDefinition } from './types';
import { parseComicScript } from './validation';

const client = new Anthropic({ apiKey: process.env.claude });

export async function generateComicScript({
  text,
  imageUrl,
  theme,
  direction,
  staging,
}: {
  text?: string;
  imageUrl?: string;
  theme: ComicThemeDefinition;
  direction: ComicDirectionDefinition;
  staging: ComicStagingDefinition;
}): Promise<ComicScript> {
  const contentBlocks: Anthropic.Messages.ContentBlockParam[] = [];

  if (imageUrl) {
    contentBlocks.push({ type: 'image', source: { type: 'url', url: imageUrl } });
  }

  contentBlocks.push({
    type: 'text',
    text: buildScriptUserPrompt({ text, hasImage: Boolean(imageUrl), theme, direction, staging }),
  });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    system: buildScriptSystemPrompt(theme, direction, staging),
    messages: [{ role: 'user', content: contentBlocks }],
    max_tokens: 1024,
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from script generator.');
  }

  return parseComicScript(textBlock.text);
}
