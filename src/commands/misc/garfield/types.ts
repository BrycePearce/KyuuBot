export const SUPPORTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

export const DEFAULT_IMAGE_TYPE = 'image/png';
export const MAX_TEXT_REPLY_LENGTH = 1800;
export const MAX_EMBED_DESCRIPTION_LENGTH = 3500;
export const MAX_EMBED_TITLE_LENGTH = 200;
export const GARFIELD_ORANGE = 0xf28c28;
export const MAX_IMAGE_DIMENSION = 2048;

export const GARFIELD_MESSAGES = {
  noReplyTarget: "Reply to a message with `.garfield`. I'm not doing free-range effort.",
  unreadableReply: 'I tried to read that reply. Regrettably, it fought back.',
  nothingUsable: 'That message has no snackable text and no image worth improving against its will.',
  improveFailed: 'I looked at it and decided not to grow as a person.',
  genericError: 'Something broke. I blame Monday.',
  oversizedText: 'I had too much to say. That alone is upsetting.',
  failedEmbed: 'That embed had problems even I did not want.',
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

export type CharacterVariant = 'garfield' | 'nermal' | 'jon' | 'odie' | 'garfula';

export const CHARACTER_WEIGHTS: Array<[CharacterVariant, number]> = [
  ['garfield', 0.9],
  ['nermal', 0.025],
  ['jon', 0.025],
  ['odie', 0.025],
  ['garfula', 0.025],
];

export type CaptionStyle = 'bitter-one-liner' | 'lazy-complaint' | 'smug-reaction' | 'anti-effort' | 'food-driven';

export type ImageInsertionMode =
  | 'face-on-object' // Character's face on/as an inanimate object (meteor, moon, sign, ball)
  | 'eating' // Character eating or fixated on food in the scene
  | 'reinterpret-subject' // The main subject itself becomes the character
  | 'sitting-on' // Character lounging on a prominent object or surface
  | 'add-to-scene' // Character added in a funny contextually-fitting way
  | 'observer'; // Character watching/judging from the side or background

export type ComedyIntensity = 'subtle' | 'moderate' | 'unhinged';

export type ImagePlan = {
  comedyConcept: string; // The specific funny idea in one sentence
  comedyIntensity: ComedyIntensity;
  insertionMode: ImageInsertionMode;
  targetElement: string; // What in the image the character interacts with, replaces, or reacts to
  placement: string;
  pose: string;
  expression: string;
  medium: string;
  material: string;
  abstractionLevel: string;
  styleNotes: string[];
  executionNotes: string[]; // Specific instructions for pulling off this edit
};
