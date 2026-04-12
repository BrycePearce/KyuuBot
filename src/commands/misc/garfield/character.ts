import { CaptionStyle, CHARACTER_WEIGHTS, CharacterVariant } from './types';

export function pickCharacterVariant(): CharacterVariant {
  return weightedRandom<CharacterVariant>(CHARACTER_WEIGHTS);
}

export function pickCaptionStyle(): CaptionStyle {
  return weightedRandom<CaptionStyle>([
    ['bitter-one-liner', 0.34],
    ['lazy-complaint', 0.24],
    ['smug-reaction', 0.22],
    ['anti-effort', 0.14],
    ['food-driven', 0.06],
  ]);
}

export function weightedRandom<T>(entries: Array<[T, number]>): T {
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const roll = Math.random() * totalWeight;

  let runningWeight = 0;
  for (const [value, weight] of entries) {
    runningWeight += weight;
    if (roll <= runningWeight) return value;
  }

  return entries[entries.length - 1][0];
}

export function getCharacterName(variant: CharacterVariant): string {
  switch (variant) {
    case 'nermal':
      return 'Nermal';
    case 'jon':
      return 'Jon';
    case 'odie':
      return 'Odie';
    case 'garfula':
      return 'Garf-ula';
    case 'himbo':
      return 'Himbo Garfield';
    default:
      return 'Garfield';
  }
}

export function describeCaptionStyle(captionStyle: CaptionStyle): string {
  switch (captionStyle) {
    case 'bitter-one-liner':
      return 'a blunt bitter one-liner';
    case 'lazy-complaint':
      return 'a lazy complaint';
    case 'smug-reaction':
      return 'a smug reaction';
    case 'anti-effort':
      return 'an anti-effort observation';
    case 'food-driven':
      return 'a food-motivated reaction';
    default:
      return 'a short deadpan caption';
  }
}

export function characterifiedFilename(variant: CharacterVariant): string {
  switch (variant) {
    case 'nermal':
      return 'nermalfied';
    case 'jon':
      return 'jon-d';
    case 'odie':
      return 'odie-d';
    case 'garfula':
      return 'garf-ulad';
    case 'himbo':
      return 'himbofied';
    default:
      return 'garfieldified';
  }
}

export function getCharacterImageOnlyMessage(variant: CharacterVariant): string {
  switch (variant) {
    case 'nermal':
      return "Oh no, you've been Nermified!";
    case 'jon':
      return "You've been Jon'd! ...I think it went pretty well.";
    case 'odie':
      return 'BORK! You have been Odie-d!';
    case 'garfula':
      return "You have been Garf-ula'd!";
    case 'himbo':
      return "You've been Himbofied!! Looking INCREDIBLE out there!!";
    default:
      return "Oh yeah, that's beautiful...";
  }
}

export function getCharacterOversizedTextWithImageMessage(variant: CharacterVariant): string {
  switch (variant) {
    case 'nermal':
      return "Oh no, you've been Nermified! My commentary was too powerful, so I attached it.";
    case 'jon':
      return "You've been Jon'd! I had a lot to say, sorry. I attached it.";
    case 'odie':
      return 'BORK! I had too much to say. I attached it. BORK.';
    case 'garfula':
      return "You have been Garf-ula'd! My commentary rose from the crypt, so I attached it.";
    case 'himbo':
      return "You've been Himbofied!! I had SO much to say because everything was SO GOOD. I attached it!!";
    default:
      return 'The image is ready. My commentary exceeded my comfort level, so I attached it.';
  }
}

export function getEmbedFooterText(variant: CharacterVariant): string {
  switch (variant) {
    case 'nermal':
      return 'Approved by Nermal';
    case 'jon':
      return 'Approved by Jon';
    case 'odie':
      return 'Approved by Odie';
    case 'garfula':
      return 'Approved by Garf-ula';
    case 'himbo':
      return 'Approved by Himbo Garfield';
    default:
      return 'Approved by Garfield';
  }
}

export function getEmbedPrefix(variant: CharacterVariant): string {
  switch (variant) {
    case 'nermal':
      return 'Nermified';
    case 'jon':
      return "Jon'd";
    case 'odie':
      return "Odie'd";
    case 'garfula':
      return "Garf-ula'd";
    case 'himbo':
      return 'Himbofied';
    default:
      return 'Garfieldified';
  }
}
