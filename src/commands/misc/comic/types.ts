export type ComicPanel = {
  description: string; // Visual description for the image generator
  caption: string; // Garfield's internal monologue (caption bar)
  dialogue?: string[]; // Speech bubble lines, e.g. ["Garfield: ...", "Jon: ..."]
};

export type ComicScript = {
  panels: [ComicPanel, ComicPanel, ComicPanel];
};

export const COMIC_MESSAGES = {
  noInput: "Reply to something or give me something to work with. I don't do improv.",
  scriptFailed: 'I tried writing this comic and immediately fell asleep.',
  imageFailed: 'The art department had a catastrophic failure. Not my department.',
  genericError: "Something broke. I was going to fix it but then I didn't.",
} as const;

// Generated image dimensions (matching .i command — confirmed working)
export const STRIP_WIDTH = 1024;
export const STRIP_HEIGHT = 1024;

// Caption bar overlaid at the bottom of each panel
export const CAPTION_HEIGHT = 90;

// Panel layout: 1024px wide, 3 panels + 2 dividers
// 340 + 4 + 336 + 4 + 340 = 1024
export const DIVIDER_WIDTH = 4;
export const PANEL_1_START = 0;
export const PANEL_1_WIDTH = 340;
export const PANEL_1_CENTER = 170;
export const DIVIDER_1_X = 340;
export const PANEL_2_START = 344;
export const PANEL_2_WIDTH = 336;
export const PANEL_2_CENTER = 512;
export const DIVIDER_2_X = 680;
export const PANEL_3_START = 684;
export const PANEL_3_WIDTH = 340;
export const PANEL_3_CENTER = 854;
