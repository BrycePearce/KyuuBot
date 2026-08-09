import { ComicPanel, ComicScript } from './types';

export function parseComicScript(rawText: string): ComicScript {
  const json = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  const parsed: unknown = JSON.parse(json);
  assertComicScript(parsed);
  return parsed;
}

export function assertComicScript(value: unknown): asserts value is ComicScript {
  if (!isRecord(value) || !Array.isArray(value.panels) || value.panels.length !== 3) {
    throw new Error('Comic script must contain exactly three panels.');
  }

  value.panels.forEach((panel, index) => assertComicPanel(panel, index));
}

function assertComicPanel(value: unknown, index: number): asserts value is ComicPanel {
  if (!isRecord(value)) throw new Error(`Comic panel ${index + 1} must be an object.`);
  if (typeof value.description !== 'string' || value.description.trim().length === 0) {
    throw new Error(`Comic panel ${index + 1} must have a non-empty description.`);
  }
  if (typeof value.caption !== 'string' || value.caption.trim().length === 0) {
    throw new Error(`Comic panel ${index + 1} must have a non-empty caption.`);
  }
  if (value.dialogue !== undefined && (!Array.isArray(value.dialogue) || !value.dialogue.every(isNonEmptyString))) {
    throw new Error(`Comic panel ${index + 1} dialogue must contain only non-empty strings.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
