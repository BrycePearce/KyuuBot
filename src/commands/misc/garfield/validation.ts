import type Anthropic from '@anthropic-ai/sdk';
import { NonRetryableError } from '../../../utils/withRetry';
import {
  CastMapping,
  EDIT_MECHANISMS,
  EditMechanism,
  GarfieldEditPlan,
  GarfieldPitchSet,
  GarfieldSourceBrief,
  PlannedEdit,
  TextChange,
  VisibleText,
} from './types';

export function parseJsonResponse<T>(
  response: Pick<Anthropic.Beta.BetaMessage, 'stop_reason' | 'content'>,
  label: string,
  validate: (value: unknown) => asserts value is T
): T {
  if (response.stop_reason === 'refusal') throw new NonRetryableError(`${label} declined this image.`);
  if (response.stop_reason === 'max_tokens') throw new Error(`${label} hit the output limit before finishing.`);

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error(`${label} returned no text.`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new Error(`${label} did not return JSON. Response began: ${textBlock.text.slice(0, 200)}`);
  }

  validate(parsed);
  return parsed;
}

export function assertSourceBrief(value: unknown): asserts value is GarfieldSourceBrief {
  if (!isRecord(value)) throw new Error('Garfield source analyst must return an object.');
  for (const field of ['format', 'artStyle', 'existingJoke'] as const) {
    if (!isNonEmptyString(value[field])) throw new Error(`Garfield source brief must have a non-empty ${field}.`);
  }
  assertStringArray(value.literalFacts, 'Source brief literalFacts', 1);
  assertStringArray(value.characters, 'Source brief characters', 0);
  assertStringArray(value.editableSlots, 'Source brief editableSlots', 1);
  assertStringArray(value.mustPreserve, 'Source brief mustPreserve', 1);
  assertStringArray(value.jokeAnchors, 'Source brief jokeAnchors', 0);
  if (!Array.isArray(value.visibleText) || !value.visibleText.every(isVisibleText)) {
    throw new Error('Garfield source brief visibleText must be an array of { location, text }.');
  }
}

export function assertPitchSet(value: unknown): asserts value is GarfieldPitchSet {
  if (!isRecord(value) || !Array.isArray(value.pitches) || value.pitches.length !== 3) {
    throw new Error('Garfield pitch writer must return exactly three pitches.');
  }
  value.pitches.forEach((pitch, index) => {
    const label = `Garfield pitch ${index + 1}`;
    if (!isRecord(pitch) || !isNonEmptyString(pitch.title)) throw new Error(`${label} must have a non-empty title.`);
    assertTransformation(pitch, label);
  });
}

export function assertEditPlan(value: unknown): asserts value is GarfieldEditPlan {
  if (!isRecord(value)) throw new Error('Garfield editor must return an object.');
  if (!isNonEmptyString(value.sourceHook)) throw new Error('Garfield edit plan must have a non-empty sourceHook.');
  assertTransformation(value, 'Garfield edit plan');
  if (typeof value.caption !== 'string') throw new Error('Garfield edit plan caption must be a string.');
  assertStringArray(value.preserve, 'Garfield edit plan preserve', 0);
}

/** The editor's validator for one image: a plan must also leave the source's joke-carrying words intact. */
export function assertEditPlanFor(
  sourceBrief: GarfieldSourceBrief
): (value: unknown) => asserts value is GarfieldEditPlan {
  return (value: unknown): asserts value is GarfieldEditPlan => {
    assertEditPlan(value);
    assertKeepsJokeAnchors(value, sourceBrief.jokeAnchors);
  };
}

/** Rejects text changes that delete a word or phrase the original joke depends on. */
export function assertKeepsJokeAnchors(plan: GarfieldEditPlan, jokeAnchors: string[]): void {
  for (const anchor of jokeAnchors.map(normalizeText).filter(Boolean)) {
    for (const { original, replacement } of plan.textChanges) {
      if (containsPhrase(original, anchor) && !containsPhrase(replacement, anchor)) {
        throw new Error(`Garfield edit plan rewrote the joke anchor "${anchor}" in "${original}".`);
      }
    }
  }
}

/** Whole-word match, so an anchor like "dated" does not match "outdated". */
function containsPhrase(text: string, normalizedPhrase: string): boolean {
  return ` ${normalizeText(text)} `.includes(` ${normalizedPhrase} `);
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Fields shared by pitches and the final plan. */
function assertTransformation(value: Record<string, unknown>, label: string): void {
  for (const field of ['premise', 'characterHint', 'coherenceCheck'] as const) {
    if (!isNonEmptyString(value[field])) throw new Error(`${label} must have a non-empty ${field}.`);
  }
  if (!isMechanism(value.mechanism)) throw new Error(`${label} has an unknown mechanism.`);
  if (!Array.isArray(value.castMapping) || !value.castMapping.every(isCastMapping)) {
    throw new Error(`${label} castMapping must be an array of { original, becomes }.`);
  }
  if (!Array.isArray(value.edits) || !value.edits.every(isPlannedEdit)) {
    throw new Error(`${label} edits must be an array of { target, change }.`);
  }
  if (!Array.isArray(value.textChanges) || !value.textChanges.every(isTextChange)) {
    throw new Error(`${label} textChanges must be an array of { location, original, replacement }.`);
  }
  if (!value.castMapping.length && !value.edits.length && !value.textChanges.length) {
    throw new Error(`${label} must change something.`);
  }
}

function isMechanism(value: unknown): value is EditMechanism {
  return typeof value === 'string' && (EDIT_MECHANISMS as readonly string[]).includes(value);
}

function isVisibleText(value: unknown): value is VisibleText {
  return isRecord(value) && isNonEmptyString(value.location) && isNonEmptyString(value.text);
}

function isCastMapping(value: unknown): value is CastMapping {
  return isRecord(value) && isNonEmptyString(value.original) && isNonEmptyString(value.becomes);
}

function isPlannedEdit(value: unknown): value is PlannedEdit {
  return isRecord(value) && isNonEmptyString(value.target) && isNonEmptyString(value.change);
}

function isTextChange(value: unknown): value is TextChange {
  return (
    isRecord(value) &&
    isNonEmptyString(value.location) &&
    typeof value.original === 'string' &&
    isNonEmptyString(value.replacement)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertStringArray(value: unknown, label: string, min: number): asserts value is string[] {
  if (!Array.isArray(value) || value.length < min || !value.every(isNonEmptyString)) {
    throw new Error(`${label} must contain at least ${min} non-empty strings.`);
  }
}
