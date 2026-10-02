export const SUPPORTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

export const DEFAULT_IMAGE_TYPE = 'image/png';
export const MAX_TEXT_REPLY_LENGTH = 1800;
export const MAX_EMBED_DESCRIPTION_LENGTH = 3500;
export const MAX_EMBED_TITLE_LENGTH = 200;
export const GARFIELD_ORANGE = 0xf28c28;
export const MAX_IMAGE_DIMENSION = 2048;

export const GARFIELD_MESSAGES = {
  noInput: 'Give `.garfield` some text or an image, or reply to a message. Even I need raw material.',
  unreadableReply: 'I tried to read that reply. Regrettably, it fought back.',
  nothingUsable: 'That message has no snackable text and no image worth improving against its will.',
  improveFailed: 'I looked at it and decided not to grow as a person.',
  genericError: 'Something broke. I blame Monday.',
  oversizedText: 'I had too much to say. That alone is upsetting.',
  failedEmbed: 'That embed had problems even I did not want.',
  imageBlocked: 'The art department refused to draw my idea. Cowards.',
} as const;

export type ImproveSource = {
  imageUrl?: string;
  imageFilename?: string;
  text?: string;
  cameFromEmbed: boolean;
  embedTitle?: string;
};

export type ExtractedEmbedSource = {
  imageUrl?: string;
  imageFilename?: string;
  text?: string;
  hasUsefulEmbedContent: boolean;
  embedTitle?: string;
};

export type CharacterVariant = 'garfield' | 'nermal' | 'jon' | 'odie' | 'garfula' | 'himbo';

export const CHARACTER_WEIGHTS: Array<[CharacterVariant, number]> = [
  ['garfield', 0.85],
  ['nermal', 0.03],
  ['jon', 0.03],
  ['odie', 0.03],
  ['garfula', 0.03],
  ['himbo', 0.03],
];

export type CaptionStyle = 'bitter-one-liner' | 'lazy-complaint' | 'smug-reaction' | 'anti-effort';

/** How the image gets translated into Garfield's world. */
export type EditMechanism =
  | 'character-hybrid' // Characters become hybrids of themselves and their Garfield-universe counterpart
  | 'subject-transformation' // The main non-human subject is Garfield-ified, keeping its form and function
  | 'world-translation' // Names, props, references, and setting recast as their Garfield-world equivalents
  | 'text-translation'; // Text-led images: the text is lightly translated into Garfield's world

export const EDIT_MECHANISMS: readonly EditMechanism[] = [
  'character-hybrid',
  'subject-transformation',
  'world-translation',
  'text-translation',
];

export type VisibleText = {
  location: string;
  text: string;
};

export type GarfieldSourceBrief = {
  format: string;
  artStyle: string;
  literalFacts: string[];
  characters: string[];
  visibleText: VisibleText[];
  existingJoke: string;
  jokeAnchors: string[];
  editableSlots: string[];
  mustPreserve: string[];
};

export type CastMapping = {
  original: string;
  becomes: string;
};

export type TextChange = {
  location: string;
  original: string;
  replacement: string;
};

export type PlannedEdit = {
  target: string;
  change: string;
};

export type GarfieldPitch = {
  title: string;
  mechanism: EditMechanism;
  premise: string;
  castMapping: CastMapping[];
  edits: PlannedEdit[];
  textChanges: TextChange[];
  characterHint: string;
  coherenceCheck: string;
};

export type GarfieldPitchSet = {
  pitches: GarfieldPitch[];
};

export type GarfieldEditPlan = Omit<GarfieldPitch, 'title'> & {
  sourceHook: string;
  preserve: string[];
  caption: string;
};
