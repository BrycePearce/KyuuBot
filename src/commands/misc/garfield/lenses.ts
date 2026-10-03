import { GarfieldSourceBrief, LensId } from './types';

export type LensDefinition = {
  id: LensId;
  /** Prompt-ready description of what this lens does to an image. */
  guidance: string;
  /** Relative odds for this source; 0 means the lens does not fit. */
  weight: (brief: GarfieldSourceBrief) => number;
  /** True when the whole image is redrawn in a new style rather than edited in its own. */
  restyles?: boolean;
};

const hasCharacters = (brief: GarfieldSourceBrief) => brief.characters.length > 0;

export const LENSES: readonly LensDefinition[] = [
  {
    id: 'character-hybrid',
    guidance:
      'The image’s people or characters become hybrids of themselves and the Garfield-universe figure matching their role. They keep their hair, outfit, accessories, pose, expression, and art style, and gain the counterpart’s identifying head, face, and hand features.',
    weight: (brief) => (hasCharacters(brief) ? 25 : 0),
  },
  {
    id: 'cast-swap',
    guidance:
      'The actual Garfield cast take over the roles and perform the scene exactly as staged: same poses, outfits, expressions, framing, and art style. No hybrids; each person is fully replaced by the cast member matching their role. The absurdity is the casting itself (Jon delivering the dramatic line, Odie as the brooding hero).',
    weight: (brief) => (hasCharacters(brief) ? 15 : 0),
  },
  {
    id: 'bad-disguise',
    guidance:
      'The featured character replaces one person as themselves, wearing that person’s outfit plus an obviously cheap disguise (a wig, glasses, a fake mustache), in every place that person appears. The image plays it completely straight and everyone else acts as if nothing is wrong.',
    weight: (brief) => (hasCharacters(brief) ? 15 : 0),
  },
  {
    id: 'davis-restyle',
    guidance:
      'The image is redrawn as a Jim Davis Garfield newspaper strip: thick even ink lines, flat Sunday-comics colors, round bulbous noses, heavy-lidded eyes, simplified backgrounds. The people, objects, composition, and text stay the same; the style is the transformation.',
    weight: (brief) => (brief.sourceKind === 'screenshot-or-text' ? 0 : 15),
    restyles: true,
  },
  {
    id: 'prop-swap',
    guidance:
      'Every person and the composition stay untouched. Two to four of the scene’s most prominent objects, logos, signs, emblems, or decorations become Garfield-world versions featuring the featured character (a house crest becomes a lazy orange cat, a team logo becomes Odie, a statue becomes Garfield). Each swap must be big and legible enough to notice in a small thumbnail.',
    weight: () => 15,
  },
  {
    id: 'subject-transformation',
    guidance:
      'The main non-human subject is Garfield-ified while keeping its form, material, lighting, and realism: a cat becomes Garfield, a dog becomes Odie, a mountain takes on Garfield’s silhouette, a sunset becomes a heavy-lidded orange sun, a car gets his stripes and half-closed headlight eyes.',
    weight: (brief) => {
      if (brief.sourceKind === 'animal' || brief.sourceKind === 'food') return 30;
      return ['scenery', 'artwork', 'other'].includes(brief.sourceKind) ? 20 : 0;
    },
  },
  {
    id: 'text-translation',
    guidance:
      'For text-led images (tweets, chats, screenshots, charts, signs, UI), the text is translated into Garfield’s world with minimal word changes; avatars, names, and small visual details are Garfield-ified to match.',
    weight: (brief) => {
      if (!brief.visibleText.length) return 0;
      return brief.sourceKind === 'screenshot-or-text' ? 40 : 5;
    },
  },
];

const RECENT_LENS_PENALTY = 0.25;

export function getLens(id: LensId): LensDefinition {
  const lens = LENSES.find((candidate) => candidate.id === id);
  if (!lens) throw new Error(`Unknown Garfield lens: ${id}`);
  return lens;
}

/** Rolls a lens that fits the source, making recently used ones less likely. */
export function pickLens(brief: GarfieldSourceBrief, recentLenses: LensId[] = [], random = Math.random): LensId {
  const candidates = LENSES.map((lens) => ({
    id: lens.id,
    weight: lens.weight(brief) * (recentLenses.includes(lens.id) ? RECENT_LENS_PENALTY : 1),
  })).filter(({ weight }) => weight > 0);

  if (!candidates.length) return 'prop-swap';

  const total = candidates.reduce((sum, { weight }) => sum + weight, 0);
  let roll = random() * total;
  for (const { id, weight } of candidates) {
    roll -= weight;
    if (roll < 0) return id;
  }
  return candidates[candidates.length - 1].id;
}

const RECENT_LENS_LIMIT = 3;
const recentLensesByScope = new Map<string, LensId[]>();

/** Lenses recently used in a server or DM, newest first. In-memory only; resets on restart. */
export function getRecentLenses(scope: string): LensId[] {
  return recentLensesByScope.get(scope) ?? [];
}

export function recordLens(scope: string, lens: LensId): void {
  const recent = [lens, ...getRecentLenses(scope).filter((id) => id !== lens)].slice(0, RECENT_LENS_LIMIT);
  recentLensesByScope.set(scope, recent);
}
