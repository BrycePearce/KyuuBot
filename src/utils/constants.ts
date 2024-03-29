import { ButtonStyle } from 'discord.js';
import type { SdDefaultModels } from '../types/Constants';

export const kyuuChanComixId = '5b2c7a03-ca53-43f0-abc8-031c0c136ae6';
export const whiteTigerAndBlackTigerComixId = 'ce23a691-9041-43d7-a2cb-5607281b0e79';
export const initializedComix = [kyuuChanComixId, whiteTigerAndBlackTigerComixId];
export const sdModels: SdDefaultModels[] = [
  {
    model: 'dynavision',
    modelAlts: ['d'],
    description: 'Everything',
    url: 'https://modelslab.com/models/dynavision',
    buttonStyle: ButtonStyle.Primary,
  },
  {
    model: 'anything-v3',
    modelAlts: ['a'],
    description: 'Anime for simple prompts',
    url: 'https://modelslab.com/models/anything-v3',
    buttonStyle: ButtonStyle.Secondary,
  },
  {
    model: 'realistic-vision-v13',
    modelAlts: ['r'],
    description: 'Realism',
    url: 'https://modelslab.com/models/realistic-vision-v13',
    buttonStyle: ButtonStyle.Danger,
  },
  {
    model: 'sdxl-turbo',
    modelAlts: ['sdxlt'],
    description: 'sdxl-turbo, apparently good',
    url: 'https://modelslab.com/models/sdxl-turbo',
    buttonStyle: ButtonStyle.Success,
  },
  {
    model: 'juggernaut-xl-v5',
    modelAlts: ['s'],
    description: 'Cartoon!',
    url: 'https://modelslab.com/models/juggernaut-xl-v5',
    buttonStyle: ButtonStyle.Primary,
  },
  {
    model: 'dark-sushi-25d',
    modelAlts: ['ac'],
    description: 'Anime for complex prompts',
    url: 'https://modelslab.com/models/dynavision',
    buttonStyle: ButtonStyle.Secondary,
  },
  {
    model: 'inkmix',
    modelAlts: ['i'],
    description: 'Ink',
    url: 'https://modelslab.com/models/inkmix',
    buttonStyle: ButtonStyle.Danger,
  },
  {
    model: 'dream-shaper-8797',
    modelAlts: ['ds'],
    description: 'Ultra realistic',
    url: 'https://modelslab.com/models/dream-shaper-8797',
    buttonStyle: ButtonStyle.Success,
  },
  {
    model: 'wand-ducstyle',
    modelAlts: ['w'],
    description: 'Artistic and surreal',
    url: 'https://modelslab.com/models/wand-ducstyle',
    buttonStyle: ButtonStyle.Primary,
  },
  {
    model: 'sdxl',
    modelAlts: ['sd', 'xl'],
    description: 'Randomly selects a model listed here',
    buttonStyle: ButtonStyle.Secondary,
  },
  {
    model: 'mdjrny-v4 style',
    modelAlts: ['mdjry', 'midjourney'],
    description: 'Looks like midjourney',
    buttonStyle: ButtonStyle.Danger,
  },
  {
    model: 'random',
    modelAlts: ['r'],
    description: 'Randomly selects a model listed here',
    buttonStyle: ButtonStyle.Success,
  },
  {
    model: 'custom',
    modelAlts: ['c'],
    description: 'Custom text prompt model',
    buttonStyle: ButtonStyle.Primary,
  },
];
