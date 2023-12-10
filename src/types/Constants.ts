import type { ButtonStyle } from 'discord.js';

export type SdDefaultModels = {
  model: string;
  modelAlts: string[];
  description: string;
  url?: string;
  buttonStyle: ButtonStyle;
};
