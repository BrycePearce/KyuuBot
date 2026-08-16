import { ComicDialogue, ComicPanel, ComicPlan, ComicScript } from './types';

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
  }
}

export function assertComicPlan(value: unknown): asserts value is ComicPlan {
  if (!isRecord(value)) throw new Error('Comic planner must return an object.');

  const requiredStrings: Array<keyof ComicPlan> = [
    'sourceAnchor',
    'premise',
    'characterMotivation',
    'themeLogic',
    'setup',
    'turn',
    'payoff',
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
    !Array.isArray(value.continuityFacts) ||
    value.continuityFacts.length < 2 ||
    !value.continuityFacts.every(isNonEmptyString)
  ) {
    throw new Error('Comic plan must contain at least two non-empty continuity facts.');
  }
}

function assertComicPanel(value: unknown, index: number): asserts value is ComicPanel {
  if (!isRecord(value)) throw new Error(`Comic panel ${index + 1} must be an object.`);
  if (typeof value.description !== 'string' || value.description.trim().length === 0) {
    throw new Error(`Comic panel ${index + 1} must have a non-empty description.`);
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
