import Anthropic from '@anthropic-ai/sdk';
import { NonRetryableError, withRetry } from '../../../utils/withRetry';
import { buildScriptSystemPrompt, buildScriptUserPrompt } from './prompts';
import { ComicDirectionDefinition, ComicScript, ComicStagingDefinition, ComicThemeDefinition } from './types';
import { assertComicScript, parseComicScript } from './validation';

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

  const system = buildScriptSystemPrompt(theme, direction, staging);

  // A rejected script is usually just an unlucky sample, so re-roll it. The
  // theme, direction, and staging stay fixed; only the generation changes.
  return withRetry(
    async () => {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        system,
        messages: [{ role: 'user', content: contentBlocks }],
        // Three detailed panel descriptions plus captions and dialogue can run
        // long as tool-call JSON; 1024 truncated them into an invalid tool input.
        max_tokens: 4096,
        tools: [SCRIPT_TOOL],
        // Force the tool so the model can't answer with prose instead of a script.
        tool_choice: { type: 'tool', name: SCRIPT_TOOL.name },
      });

      return readComicScript(response);
    },
    {
      attempts: 3,
      onRetry: (error, nextAttempt) =>
        console.warn(`Comic script attempt failed, retrying (attempt ${nextAttempt}):`, describeError(error)),
    }
  );
}

export function readComicScript(response: Anthropic.Messages.Message): ComicScript {
  // Retrying a refusal re-sends an identical prompt, so the answer won't change.
  if (response.stop_reason === 'refusal') {
    throw new NonRetryableError('Script generator declined to write this comic.');
  }

  if (response.stop_reason === 'max_tokens') {
    throw new Error('Script generator hit the output limit before finishing the script.');
  }

  const toolBlock = response.content.find((block) => block.type === 'tool_use');
  if (toolBlock?.type === 'tool_use') {
    assertComicScript(toolBlock.input);
    return toolBlock.input;
  }

  // Shouldn't happen with a forced tool, but fall back to parsing prose.
  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error(`No script returned by the model (stop_reason: ${response.stop_reason}).`);
  }

  return parseComicScript(textBlock.text);
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const SCRIPT_TOOL: Anthropic.Messages.Tool = {
  name: 'emit_comic_script',
  description: 'Return the finished three-panel comic script.',
  input_schema: {
    type: 'object',
    properties: {
      panels: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        description: 'Exactly three panels, in order.',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string', description: 'Visual description for the image generator.' },
            caption: { type: 'string', description: "The character's caption-bar line." },
            dialogue: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional speech bubble lines, e.g. "Garfield: ...".',
            },
          },
          required: ['description', 'caption'],
        },
      },
    },
    required: ['panels'],
  },
};
