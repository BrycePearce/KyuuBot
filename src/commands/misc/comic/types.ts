export type ComicPanel = {
  description: string; // Visual description for the image generator
  cast: string[]; // Binding visible character roster; each named character appears once
  caption?: string; // Caption-bar narration; only used in caption mode
  dialogue?: ComicDialogue[]; // Speech bubbles; only used in dialogue mode
};

export type ComicDialogue = {
  speaker: string;
  text: string;
};

export type ComicTextMode = 'captions' | 'dialogue';

export type ComicCharacterRole = {
  name: string;
  function: string;
};

export type ComicSourceBrief = {
  literalFacts: string[];
  centralHook: string;
  mustPreserve: string[];
  semanticRoles: string[];
  scopeBoundaries: string[];
  unknowns: string[];
  prohibitedMisreadings: string[];
};

export type ComicPitch = {
  title: string;
  premise: string;
  characterMotivation: string;
  comedyMechanism: string;
  setup: string;
  turn: string;
  payoff: string;
  visualThroughline: string;
  textMode: ComicTextMode;
};

export type ComicPitchSet = {
  sourceAnchor: string;
  creativeLiberty: string;
  pitches: [ComicPitch, ComicPitch, ComicPitch, ComicPitch];
};

export type ComicScript = {
  textMode: ComicTextMode;
  panels: [ComicPanel, ComicPanel, ComicPanel];
};

export type ComicPlan = {
  sourceAnchor: string;
  comicTarget: string;
  premise: string;
  characterMotivation: string;
  themeLogic: string;
  essentialCast: ComicCharacterRole[];
  setup: string;
  turn: string;
  panelTwoGoal: string;
  turnCausality: string;
  payoff: string;
  payoffLogic: string;
  visualThroughline: string;
  continuityFacts: string[];
  textMode: ComicTextMode;
};

export type PlannedComic = {
  sourceBrief: ComicSourceBrief;
  plan: ComicPlan;
  script: ComicScript;
};

export type ComicTheme = 'classic' | 'himbo' | 'vampire' | 'zeus' | 'odie' | 'nermal' | 'noir' | 'kaiju';

export type ComicDirection =
  | 'dry-observation'
  | 'escalating-consequences'
  | 'misunderstanding'
  | 'petty-backfire'
  | 'character-reversal'
  | 'surreal-logic'
  | 'visual-transformation'
  | 'food-fixation';

export type ComicStaging =
  | 'source-native-action'
  | 'location-transplant'
  | 'prop-domino'
  | 'foreground-background'
  | 'scale-shift'
  | 'public-spectacle'
  | 'theatrical-tableau';

export type ComicThemeDefinition = {
  id: ComicTheme;
  label: string;
  weight: number;
  writingGuidance: string;
  imageGuidance: string;
  visualRequirements: string[];
  resultMessage?: string;
};

export type ComicDirectionDefinition = {
  id: ComicDirection;
  label: string;
  weight: number;
  writingGuidance: string;
  imageGuidance: string;
};

export type ComicStagingDefinition = {
  id: ComicStaging;
  label: string;
  weight: number;
  writingGuidance: string;
  imageGuidance: string;
};

export const COMIC_MESSAGES = {
  noInput: "Reply to something or give me something to work with. I don't do improv.",
  scriptFailed: 'I tried writing this comic and immediately fell asleep.',
  scriptRefused: 'I read that and decided I want no part of it.',
  imageFailed: 'The art department had a catastrophic failure. Not my department.',
  genericError: "Something broke. I was going to fix it but then I didn't.",
} as const;

// Generated image dimensions (matching .i command — confirmed working)
export const STRIP_WIDTH = 1024;
export const STRIP_HEIGHT = 1024;
