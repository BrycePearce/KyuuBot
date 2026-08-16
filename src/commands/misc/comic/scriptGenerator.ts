import Anthropic from '@anthropic-ai/sdk';
import { NonRetryableError, withRetry } from '../../../utils/withRetry';
import {
  buildConceptSystemPrompt,
  buildConceptUserPrompt,
  buildScriptSystemPrompt,
  buildScriptUserPrompt,
} from './prompts';
import {
  ComicDirectionDefinition,
  ComicPlan,
  ComicScript,
  ComicStagingDefinition,
  ComicThemeDefinition,
  PlannedComic,
} from './types';
import { assertComicPlan, assertComicScript, parseComicScript } from './validation';

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
}): Promise<PlannedComic> {
  const plan = await withRetry(
    async () => {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        system: buildConceptSystemPrompt(theme, direction, staging),
        messages: [
          {
            role: 'user',
            content: buildContentBlocks(imageUrl, buildConceptUserPrompt({ text, hasImage: Boolean(imageUrl) })),
          },
        ],
        max_tokens: 2048,
        tools: [PLAN_TOOL],
        tool_choice: { type: 'tool', name: PLAN_TOOL.name },
      });

      return readComicPlan(response);
    },
    {
      attempts: 3,
      onRetry: (error, nextAttempt) =>
        console.warn(`Comic plan attempt failed, retrying (attempt ${nextAttempt}):`, describeError(error)),
    }
  );

  const script = await withRetry(
    async () => {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        system: buildScriptSystemPrompt(theme),
        messages: [
          {
            role: 'user',
            content: buildContentBlocks(imageUrl, buildScriptUserPrompt({ text, hasImage: Boolean(imageUrl), plan })),
          },
        ],
        max_tokens: 4096,
        tools: [SCRIPT_TOOL],
        tool_choice: { type: 'tool', name: SCRIPT_TOOL.name },
      });

      const candidate = readComicScript(response);
      if (candidate.textMode !== plan.textMode) {
        throw new Error(`Script changed text mode from ${plan.textMode} to ${candidate.textMode}.`);
      }
      return candidate;
    },
    {
      attempts: 3,
      onRetry: (error, nextAttempt) =>
        console.warn(`Comic script attempt failed, retrying (attempt ${nextAttempt}):`, describeError(error)),
    }
  );

  return { plan, script };
}

export function readComicPlan(response: Anthropic.Messages.Message): ComicPlan {
  rejectIncompleteResponse(response, 'Comic planner');
  const toolBlock = response.content.find((block) => block.type === 'tool_use' && block.name === PLAN_TOOL.name);
  if (!toolBlock || toolBlock.type !== 'tool_use') throw new Error('Comic planner did not return a plan tool call.');

  assertComicPlan(toolBlock.input);
  return toolBlock.input;
}

export function readComicScript(response: Anthropic.Messages.Message): ComicScript {
  rejectIncompleteResponse(response, 'Script generator');
  const toolBlock = response.content.find((block) => block.type === 'tool_use' && block.name === SCRIPT_TOOL.name);
  if (toolBlock?.type === 'tool_use') {
    assertComicScript(toolBlock.input);
    return toolBlock.input;
  }

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error(`No script returned by the model (stop_reason: ${response.stop_reason}).`);
  }
  return parseComicScript(textBlock.text);
}

function buildContentBlocks(imageUrl: string | undefined, prompt: string): Anthropic.Messages.ContentBlockParam[] {
  const blocks: Anthropic.Messages.ContentBlockParam[] = [];
  if (imageUrl) blocks.push({ type: 'image', source: { type: 'url', url: imageUrl } });
  blocks.push({ type: 'text', text: prompt });
  return blocks;
}

function rejectIncompleteResponse(response: Anthropic.Messages.Message, label: string): void {
  if (response.stop_reason === 'refusal') {
    throw new NonRetryableError(`${label} declined this comic.`);
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error(`${label} hit the output limit before finishing.`);
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const PLAN_TOOL: Anthropic.Messages.Tool = {
  name: 'plan_comic',
  description: 'Return one coherent, source-rooted comic concept before any final lines are written.',
  input_schema: {
    type: 'object',
    properties: {
      sourceAnchor: { type: 'string', description: 'The exact source detail that makes this comic recognizable.' },
      premise: { type: 'string', description: 'The single joke premise in one sentence.' },
      characterMotivation: { type: 'string', description: 'What the featured character wants and why.' },
      themeLogic: { type: 'string', description: 'How the premise obeys the selected character theme and its rules.' },
      setup: { type: 'string', description: 'The fact and situation established in panel one.' },
      turn: { type: 'string', description: 'The cause-and-effect complication in panel two.' },
      payoff: { type: 'string', description: 'The punchline that follows from and reinterprets the first two beats.' },
      visualThroughline: {
        type: 'string',
        description: 'The source-rooted visual element carried through all panels.',
      },
      continuityFacts: {
        type: 'array',
        minItems: 2,
        maxItems: 6,
        items: { type: 'string' },
        description: 'Plain facts that cannot change or contradict one another during the strip.',
      },
      textMode: {
        type: 'string',
        enum: ['captions', 'dialogue'],
        description: 'The one text system used throughout the strip.',
      },
    },
    required: [
      'sourceAnchor',
      'premise',
      'characterMotivation',
      'themeLogic',
      'setup',
      'turn',
      'payoff',
      'visualThroughline',
      'continuityFacts',
      'textMode',
    ],
  },
};

const SCRIPT_TOOL: Anthropic.Messages.Tool = {
  name: 'emit_comic_script',
  description: 'Return the final continuity-checked three-panel comic script.',
  input_schema: {
    type: 'object',
    properties: {
      textMode: { type: 'string', enum: ['captions', 'dialogue'] },
      panels: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        description: 'Exactly three panels, in order.',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string', description: 'Detailed visible action for the image generator.' },
            caption: { type: 'string', description: 'Caption text; present only in captions mode.' },
            dialogue: {
              type: 'array',
              maxItems: 2,
              description: 'Speech bubbles; present only in dialogue mode.',
              items: {
                type: 'object',
                properties: {
                  speaker: { type: 'string', description: 'Speaker metadata; not printed in the bubble.' },
                  text: { type: 'string', description: 'Only the words printed inside the bubble.' },
                },
                required: ['speaker', 'text'],
              },
            },
          },
          required: ['description'],
        },
      },
    },
    required: ['textMode', 'panels'],
  },
};
