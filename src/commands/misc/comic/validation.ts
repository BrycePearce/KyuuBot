import {
  ComicCharacterRole,
  ComicDialogue,
  ComicPanel,
  ComicPitch,
  ComicPitchSet,
  ComicPlan,
  ComicScript,
  ComicSourceBrief,
} from './types';

export function parseComicScript(rawText: string): ComicScript {
  const json = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(`Script generator did not return JSON. Response began: ${json.slice(0, 200)}`);
  }

  assertComicScript(parsed);
  return parsed;
}

export function assertComicScript(value: unknown): asserts value is ComicScript {
  if (!isRecord(value) || (value.textMode !== 'captions' && value.textMode !== 'dialogue')) {
    throw new Error('Comic script must declare captions or dialogue as its text mode.');
  }
  if (!Array.isArray(value.panels) || value.panels.length !== 3) {
    throw new Error('Comic script must contain exactly three panels.');
  }

  value.panels.forEach((panel, index) => assertComicPanel(panel, index));

  if (value.textMode === 'captions') {
    if (value.panels.some((panel) => !panel.caption?.trim() || panel.dialogue !== undefined)) {
      throw new Error('Caption-mode comics require one caption per panel and cannot contain dialogue.');
    }
  } else {
    if (value.panels.some((panel) => panel.caption !== undefined)) {
      throw new Error('Dialogue-mode comics cannot contain caption-bar text.');
    }
    if (!value.panels.some((panel) => panel.dialogue?.length)) {
      throw new Error('Dialogue-mode comics must contain at least one speech bubble.');
    }
    for (const [index, panel] of value.panels.entries()) {
      const cast = new Set(panel.cast.map((character) => character.trim().toLowerCase()));
      if (panel.dialogue?.some(({ speaker }) => !cast.has(speaker.trim().toLowerCase()))) {
        throw new Error(`Comic panel ${index + 1} dialogue speakers must be present in that panel's cast.`);
      }
    }
  }
}

export function assertComicPlan(value: unknown): asserts value is ComicPlan {
  if (!isRecord(value)) throw new Error('Comic planner must return an object.');

  const requiredStrings: Array<keyof ComicPlan> = [
    'sourceAnchor',
    'comicTarget',
    'premise',
    'characterMotivation',
    'themeLogic',
    'setup',
    'turn',
    'panelTwoGoal',
    'turnCausality',
    'payoff',
    'payoffLogic',
    'visualThroughline',
  ];
  for (const field of requiredStrings) {
    if (typeof value[field] !== 'string' || value[field].trim().length === 0) {
      throw new Error(`Comic plan must have a non-empty ${field}.`);
    }
  }

  if (value.textMode !== 'captions' && value.textMode !== 'dialogue') {
    throw new Error('Comic plan must choose captions or dialogue as its text mode.');
  }
  if (
    !Array.isArray(value.essentialCast) ||
    value.essentialCast.length < 1 ||
    value.essentialCast.length > 4 ||
    !value.essentialCast.every(isComicCharacterRole)
  ) {
    throw new Error('Comic plan must contain one to four valid essential cast roles.');
  }
  const normalizedCast = value.essentialCast.map(({ name }) => name.trim().toLowerCase());
  if (new Set(normalizedCast).size !== normalizedCast.length) {
    throw new Error('Comic plan cannot list the same essential character more than once.');
  }
  if (
    !Array.isArray(value.continuityFacts) ||
    value.continuityFacts.length < 2 ||
    !value.continuityFacts.every(isNonEmptyString)
  ) {
    throw new Error('Comic plan must contain at least two non-empty continuity facts.');
  }
}

export function assertComicSourceBrief(value: unknown): asserts value is ComicSourceBrief {
  if (!isRecord(value)) throw new Error('Comic source analyst must return an object.');
  if (!isNonEmptyString(value.centralHook)) {
    throw new Error('Comic source brief must identify a non-empty centralHook.');
  }
  assertStringArray(value.literalFacts, 'literalFacts', 1, 10);
  assertStringArray(value.mustPreserve, 'mustPreserve', 1, 8);
  assertStringArray(value.semanticRoles, 'semanticRoles', 1, 8);
  assertStringArray(value.scopeBoundaries, 'scopeBoundaries', 1, 8);
  assertStringArray(value.unknowns, 'unknowns', 0, 8);
  assertStringArray(value.prohibitedMisreadings, 'prohibitedMisreadings', 0, 8);
}

export function assertComicScriptMatchesPlan(script: ComicScript, plan: ComicPlan): void {
  const allowedCast = new Set(plan.essentialCast.map(({ name }) => name.trim().toLowerCase()));
  const usedCast = new Set<string>();

  for (const [index, panel] of script.panels.entries()) {
    for (const character of panel.cast) {
      const normalized = character.trim().toLowerCase();
      if (!allowedCast.has(normalized)) {
        throw new Error(`Comic panel ${index + 1} introduced ${character}, who is not in the binding essential cast.`);
      }
      usedCast.add(normalized);
    }
  }

  const omitted = plan.essentialCast.filter(({ name }) => !usedCast.has(name.trim().toLowerCase()));
  if (omitted.length) {
    throw new Error(`Comic script omitted essential cast: ${omitted.map(({ name }) => name).join(', ')}.`);
  }
}

export function assertComicPitchSet(value: unknown): asserts value is ComicPitchSet {
  if (!isRecord(value)) throw new Error('Comic pitch writer must return an object.');
  if (!isNonEmptyString(value.sourceAnchor) || !isNonEmptyString(value.creativeLiberty)) {
    throw new Error('Comic pitches must identify a source anchor and creative-liberty opportunity.');
  }
  if (!Array.isArray(value.pitches) || value.pitches.length !== 4) {
    throw new Error('Comic pitch writer must return exactly four pitches.');
  }
  value.pitches.forEach((pitch, index) => assertComicPitch(pitch, index));
}

function assertComicPitch(value: unknown, index: number): asserts value is ComicPitch {
  if (!isRecord(value)) throw new Error(`Comic pitch ${index + 1} must be an object.`);
  const requiredStrings: Array<keyof ComicPitch> = [
    'title',
    'premise',
    'characterMotivation',
    'comedyMechanism',
    'setup',
    'turn',
    'payoff',
    'visualThroughline',
  ];
  for (const field of requiredStrings) {
    if (!isNonEmptyString(value[field])) throw new Error(`Comic pitch ${index + 1} must have a non-empty ${field}.`);
  }
  if (value.textMode !== 'captions' && value.textMode !== 'dialogue') {
    throw new Error(`Comic pitch ${index + 1} must choose captions or dialogue as its text mode.`);
  }
}

function assertComicPanel(value: unknown, index: number): asserts value is ComicPanel {
  if (!isRecord(value)) throw new Error(`Comic panel ${index + 1} must be an object.`);
  if (typeof value.description !== 'string' || value.description.trim().length === 0) {
    throw new Error(`Comic panel ${index + 1} must have a non-empty description.`);
  }
  if (!Array.isArray(value.cast) || !value.cast.every(isNonEmptyString)) {
    throw new Error(`Comic panel ${index + 1} must have a valid cast array.`);
  }
  const normalizedCast = value.cast.map((character) => character.trim().toLowerCase());
  if (new Set(normalizedCast).size !== normalizedCast.length) {
    throw new Error(`Comic panel ${index + 1} cast cannot list the same character more than once.`);
  }
  if (value.caption !== undefined && (typeof value.caption !== 'string' || value.caption.trim().length === 0)) {
    throw new Error(`Comic panel ${index + 1} caption must be a non-empty string when present.`);
  }
  if (
    value.dialogue !== undefined &&
    (!Array.isArray(value.dialogue) || value.dialogue.length > 2 || !value.dialogue.every(isComicDialogue))
  ) {
    throw new Error(`Comic panel ${index + 1} dialogue must contain at most two valid speech bubbles.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isComicDialogue(value: unknown): value is ComicDialogue {
  if (!isRecord(value) || !isNonEmptyString(value.speaker) || !isNonEmptyString(value.text)) return false;
  const escapedSpeaker = value.speaker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return !new RegExp(`^${escapedSpeaker}\\s*:`, 'i').test(value.text);
}

function isComicCharacterRole(value: unknown): value is ComicCharacterRole {
  return isRecord(value) && isNonEmptyString(value.name) && isNonEmptyString(value.function);
}

function assertStringArray(value: unknown, field: string, min: number, max: number): asserts value is string[] {
  if (!Array.isArray(value) || value.length < min || value.length > max || !value.every(isNonEmptyString)) {
    throw new Error(`Comic source brief ${field} must contain ${min} to ${max} non-empty strings.`);
  }
}
