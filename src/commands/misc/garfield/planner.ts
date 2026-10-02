import Anthropic from '@anthropic-ai/sdk';
import { withRetry } from '../../../utils/withRetry';
import {
  buildEditorSystemPrompt,
  buildEditorUserPrompt,
  buildPitchSystemPrompt,
  buildPitchUserPrompt,
  buildSourceSystemPrompt,
  buildSourceUserPrompt,
} from './prompts';
import { CharacterVariant, EDIT_MECHANISMS, GarfieldEditPlan, GarfieldPitchSet, GarfieldSourceBrief } from './types';
import { assertEditPlanFor, assertPitchSet, assertSourceBrief, parseJsonResponse } from './validation';

const client = new Anthropic({ apiKey: process.env.claude });

const MODEL = 'claude-opus-5-5';
// Re-runs a request on another model server-side if Opus declines it, instead of failing the command.
const FALLBACK_BETA = 'server-side-fallback-2026-06-01';
const FALLBACK_MODEL = 'claude-opus-4-8';

type Effort = 'low' | 'medium' | 'high';

export type PlannedGarfieldEdit = {
  sourceBrief: GarfieldSourceBrief;
  pitches: GarfieldPitchSet;
  plan: GarfieldEditPlan;
};

export async function planGarfieldEdit({
  imageUrl,
  text,
  variant,
}: {
  imageUrl: string;
  text?: string;
  variant: CharacterVariant;
}): Promise<PlannedGarfieldEdit> {
  const sourceBrief = await requestJson({
    label: 'Garfield source analyst',
    system: buildSourceSystemPrompt(),
    prompt: buildSourceUserPrompt(text),
    imageUrl,
    schema: SOURCE_SCHEMA,
    effort: 'low',
    validate: assertSourceBrief,
  });

  const pitches = await requestJson({
    label: 'Garfield pitch writer',
    system: buildPitchSystemPrompt(variant),
    prompt: buildPitchUserPrompt({ text, sourceBrief }),
    imageUrl,
    schema: PITCH_SCHEMA,
    effort: 'high',
    validate: assertPitchSet,
  });

  const plan = await editGarfieldPlan({ imageUrl, text, variant, sourceBrief, pitches });

  return { sourceBrief, pitches, plan };
}

/** The editor stage alone, so a plan whose render was blocked can be replaced without re-reading the image. */
export async function editGarfieldPlan({
  imageUrl,
  text,
  variant,
  sourceBrief,
  pitches,
  blockedPremises,
}: {
  imageUrl: string;
  text?: string;
  variant: CharacterVariant;
  sourceBrief: GarfieldSourceBrief;
  pitches: GarfieldPitchSet;
  blockedPremises?: string[];
}): Promise<GarfieldEditPlan> {
  return requestJson({
    label: 'Garfield comedy editor',
    system: buildEditorSystemPrompt(variant),
    prompt: buildEditorUserPrompt({ text, sourceBrief, pitches, blockedPremises }),
    imageUrl,
    schema: PLAN_SCHEMA,
    effort: 'high',
    validate: assertEditPlanFor(sourceBrief),
  });
}

async function requestJson<T>({
  label,
  system,
  prompt,
  imageUrl,
  schema,
  effort,
  validate,
}: {
  label: string;
  system: string;
  prompt: string;
  imageUrl: string;
  schema: Record<string, unknown>;
  effort: Effort;
  validate: (value: unknown) => asserts value is T;
}): Promise<T> {
  return withRetry(
    async () => {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: [FALLBACK_BETA],
        fallbacks: [{ model: FALLBACK_MODEL }],
        system,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'url', url: imageUrl } },
              { type: 'text', text: prompt },
            ],
          },
        ],
        output_config: { effort, format: { type: 'json_schema', schema } },
      });

      return parseJsonResponse(response, label, validate);
    },
    {
      attempts: 3,
      onRetry: (error, nextAttempt) =>
        console.warn(`${label} failed, retrying (attempt ${nextAttempt}):`, describeError(error)),
    }
  );
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const stringArray = { type: 'array', items: { type: 'string' } } as const;

const CAST_MAPPING_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    properties: {
      original: { type: 'string', description: 'The source person, character, or element, and where it appears.' },
      becomes: { type: 'string', description: 'Its Garfield-universe counterpart, with visual traits spelled out.' },
    },
    required: ['original', 'becomes'],
  },
} as const;

const EDITS_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    properties: { target: { type: 'string' }, change: { type: 'string' } },
    required: ['target', 'change'],
  },
} as const;

const TEXT_CHANGES_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    properties: {
      location: {
        type: 'string',
        description: 'Where the text is, e.g. "speech bubble top-left, spoken by the blonde girl".',
      },
      original: { type: 'string', description: 'The exact original text, or an empty string for newly added text.' },
      replacement: { type: 'string', description: 'The new text.' },
    },
    required: ['location', 'original', 'replacement'],
  },
} as const;

const TRANSFORMATION_PROPERTIES = {
  mechanism: { type: 'string', enum: [...EDIT_MECHANISMS] },
  premise: { type: 'string' },
  castMapping: CAST_MAPPING_SCHEMA,
  edits: EDITS_SCHEMA,
  textChanges: TEXT_CHANGES_SCHEMA,
  characterHint: { type: 'string' },
  coherenceCheck: { type: 'string' },
} as const;

const SOURCE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    format: { type: 'string' },
    artStyle: { type: 'string' },
    literalFacts: stringArray,
    characters: stringArray,
    visibleText: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { location: { type: 'string' }, text: { type: 'string' } },
        required: ['location', 'text'],
      },
    },
    existingJoke: { type: 'string' },
    jokeAnchors: stringArray,
    editableSlots: stringArray,
    mustPreserve: stringArray,
  },
  required: [
    'format',
    'artStyle',
    'literalFacts',
    'characters',
    'visibleText',
    'existingJoke',
    'jokeAnchors',
    'editableSlots',
    'mustPreserve',
  ],
};

const PITCH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pitches: {
      type: 'array',
      description: 'Exactly three genuinely different Garfield-ifications.',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { title: { type: 'string' }, ...TRANSFORMATION_PROPERTIES },
        required: ['title', ...Object.keys(TRANSFORMATION_PROPERTIES)],
      },
    },
  },
  required: ['pitches'],
};

const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sourceHook: { type: 'string' },
    ...TRANSFORMATION_PROPERTIES,
    preserve: stringArray,
    caption: { type: 'string' },
  },
  required: ['sourceHook', ...Object.keys(TRANSFORMATION_PROPERTIES), 'preserve', 'caption'],
};
