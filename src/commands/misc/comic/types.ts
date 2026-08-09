export type ComicPanel = {
  description: string; // Visual description for the image generator
  caption: string; // Garfield's internal monologue (caption bar)
  dialogue?: string[]; // Speech bubble lines, e.g. ["Garfield: ...", "Jon: ..."]
};

export type ComicScript = {
  panels: [ComicPanel, ComicPanel, ComicPanel];
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
