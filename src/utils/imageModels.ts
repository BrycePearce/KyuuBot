/** Premium settings for .i/.image/.generate. */
export const PREMIUM_IMAGE_SETTINGS = {
  model: 'gpt-image-2.5-sunburst',
  quality: 'max',
  output_format: 'png',
} as const;

/** Lower-cost generation tier for .fi/.fastimage; keep quality below premium's max. */
export const BUDGET_IMAGE_SETTINGS = {
  model: 'gpt-image-2.5-flare',
  quality: 'high',
  output_format: 'png',
} as const;
