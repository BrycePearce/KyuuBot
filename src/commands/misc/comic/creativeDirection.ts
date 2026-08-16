import {
  ComicDirection,
  ComicDirectionDefinition,
  ComicStaging,
  ComicStagingDefinition,
  ComicTheme,
  ComicThemeDefinition,
} from './types';

export const COMIC_THEMES: readonly ComicThemeDefinition[] = [
  {
    id: 'classic',
    label: 'Classic Garfield',
    weight: 70,
    writingGuidance:
      'Garfield is the lead: lazy, smug, selfish, dry, petty, and chronically unimpressed. Food may appear when relevant, but it is only one possible interest and must not be the automatic subject.',
    imageGuidance:
      'Feature the actual character Garfield as the unmistakable lead in a colorful classic newspaper-comic world. Use expressive poses and varied locations appropriate to the source.',
    visualRequirements: [],
  },
  {
    id: 'himbo',
    label: 'Himbo Garfield',
    weight: 5,
    writingGuidance:
      'Himbo Garfield is the lead: recognizably Garfield but extremely muscular, sweet, enthusiastic, earnest, and not very bright. He sincerely believes everything is going amazingly and is never cynical or lazy.',
    imageGuidance:
      'Feature the actual character Garfield with an enormous heroic bodybuilder physique, wide friendly eyes, a huge sincere grin, and exuberant gym-bro energy. Carry the source into an intensely upbeat fitness aesthetic.',
    visualRequirements: [
      'Himbo Garfield has a huge bodybuilder physique in every panel',
      'his wide friendly eyes and enormous sincere grin remain visible',
      'fitness, gym, or heroic strongman details shape the entire scene',
    ],
    resultMessage: "You've been Himbofied! Looking INCREDIBLE out there!",
  },
  {
    id: 'vampire',
    label: 'Vampire Garfield / Garf-ula',
    weight: 5,
    writingGuidance:
      'Vampire Garfield, also called Garf-ula, is the lead. Keep Garfield dry, lazy, entitled, and unimpressed while giving the premise nocturnal gothic vampire logic. Garlic is dangerous or repellent to him; never make him desire, eat, buy, or protect garlic unless the setup explicitly establishes a funny exception that drives the payoff.',
    imageGuidance:
      'Feature the actual character Garfield as an unmistakable Dracula-like vampire with fangs, cape, gothic castle atmosphere, moonlight, bats, deep crimson accents, and extreme spooky theatricality.',
    visualRequirements: [
      'Garf-ula has prominent fangs and a dramatic high-collared black-and-red cape in every panel',
      'gothic stonework, moonlight, bats, candles, or crimson shadows dominate the environment',
      'the palette and lighting feel intensely vampiric rather than like normal Garfield at night',
    ],
    resultMessage: "You've been Garf-ula'd!",
  },
  {
    id: 'zeus',
    label: 'Zeus Garfield',
    weight: 5,
    writingGuidance:
      'Zeus Garfield is the lead: Garfield as the entitled ruler of Mount Olympus, wielding divine power for petty, lazy, self-serving reasons. Use mythic grandeur contrasted with Garfield-level concerns.',
    imageGuidance:
      'Feature the actual character Garfield as Zeus on Mount Olympus with a toga, laurel details, storm clouds, marble temples, lightning bolts, and absurdly grand divine authority.',
    visualRequirements: [
      'Zeus Garfield wears a white toga and gold laurel crown in every panel',
      'lightning, storm clouds, marble columns, and Mount Olympus dominate the setting',
      'Garfield visibly wields oversized divine power for petty purposes',
    ],
    resultMessage: "You've been Zeusified!",
  },
  {
    id: 'odie',
    label: "Odie'd",
    weight: 5,
    writingGuidance:
      'Odie is the featured lead. Build the joke around his joyful, physical, chaotic dog logic; he communicates mostly through action, expression, panting, and very short barks. Garfield may support or react but must not take over.',
    imageGuidance:
      'Feature the actual character Odie as the clear star, with huge physical movement, tongue-out enthusiasm, elastic expressions, and joyful chaos. Garfield may appear only as a supporting reaction character.',
    visualRequirements: [
      'Odie is the largest or clearest focal character in every panel',
      'his long tongue, floppy ears, and explosive physical energy are unmistakable',
      'Garfield is absent or visibly secondary and never takes over the composition',
    ],
    resultMessage: "BORK! You've been Odie'd!",
  },
  {
    id: 'nermal',
    label: "Nermal'd",
    weight: 5,
    writingGuidance:
      'Nermal is the featured lead: cute, vain, smug, effortlessly self-satisfied, and mildly infuriating. Garfield may support or react but must not take over the comic.',
    imageGuidance:
      'Feature the actual character Nermal as the clear star, emphasizing polished cuteness, camera-ready poses, smug confidence, and an adorably irritating atmosphere. Garfield may be a supporting reaction character.',
    visualRequirements: [
      'Nermal is the largest or clearest focal character in every panel',
      'his small gray body, polished cuteness, and smug camera-ready poses are unmistakable',
      'Garfield is absent or visibly secondary and never takes over the composition',
    ],
    resultMessage: "Oh no, you've been Nermal'd!",
  },
  {
    id: 'noir',
    label: 'Noir Garfield',
    weight: 2.5,
    writingGuidance:
      'Garfield is a hard-boiled noir detective narrating the source like a seedy case. Keep his voice terse, suspicious, lazy, and deadpan rather than writing flowery parody prose.',
    imageGuidance:
      'Feature the actual character Garfield as a trench-coated noir detective in a rain-soaked, high-contrast black-and-white city with blinds, desk lamps, long shadows, and one restrained orange accent.',
    visualRequirements: [
      'detective Garfield wears a trench coat and fedora in every panel',
      'the entire strip uses high-contrast black-and-white noir lighting with at most one orange accent',
      'rain, venetian-blind shadows, smoke, or hard-boiled city details dominate every composition',
    ],
    resultMessage: "You've been Noirfield'd!",
  },
  {
    id: 'kaiju',
    label: 'Kaiju Garfield',
    weight: 2.5,
    writingGuidance:
      'Garfield is a city-sized kaiju. Treat the source as an enormous disaster-movie event while Garfield remains casually petty, bored, and concerned with something comically small.',
    imageGuidance:
      'Feature the actual character Garfield as a colossal kaiju towering over a detailed miniature city, with dramatic scale, emergency spectacle, cinematic low angles, and Garfield remaining unmistakably himself.',
    visualRequirements: [
      'Kaiju Garfield is colossal relative to buildings, vehicles, or crowds in every panel',
      'low camera angles and miniature city details make his scale immediately obvious',
      'disaster-movie spectacle fills the environment while Garfield stays recognizable',
    ],
    resultMessage: "You've been Kaiju'd!",
  },
];

export function getComicVariantMessage(theme: ComicThemeDefinition): string | undefined {
  return theme.id === 'classic' ? undefined : theme.resultMessage;
}

export const COMIC_DIRECTIONS: readonly ComicDirectionDefinition[] = [
  {
    id: 'dry-observation',
    label: 'Dry observation',
    weight: 20,
    writingGuidance:
      'Find one specific absurd or irritating detail in the source and build toward a blunt deadpan observation.',
    imageGuidance:
      'Use precise visual reaction beats and environmental details that make the final deadpan observation land.',
  },
  {
    id: 'escalating-consequences',
    label: 'Escalating consequences',
    weight: 15,
    writingGuidance:
      'Begin with the source, make its consequences visibly worse or larger in panel two, and reach an unexpected extreme in panel three.',
    imageGuidance:
      'Make each panel visibly escalate in action, scale, or consequences rather than only changing expressions.',
  },
  {
    id: 'misunderstanding',
    label: 'Misunderstanding',
    weight: 15,
    writingGuidance:
      'Build the joke around a character confidently misunderstanding one concrete part of the source and acting on it.',
    imageGuidance:
      'Show the mistaken interpretation through clear actions and props so the joke is readable even without narration.',
  },
  {
    id: 'petty-backfire',
    label: 'Petty scheme or backfire',
    weight: 15,
    writingGuidance:
      'Turn the source into a small selfish scheme that succeeds in the wrong way or backfires on its instigator.',
    imageGuidance:
      'Show the scheme being attempted and its visually distinct consequence, with strong cause-and-effect between panels.',
  },
  {
    id: 'character-reversal',
    label: 'Character reversal',
    weight: 15,
    writingGuidance:
      'Set up an expected role or attitude from the source, then have the least likely character reverse it by the punchline.',
    imageGuidance: 'Make the reversal clear through contrasting poses, roles, and staging across the panels.',
  },
  {
    id: 'surreal-logic',
    label: 'Surreal logic',
    weight: 10,
    writingGuidance:
      'Apply one bizarre but internally consistent rule to the source and let the characters treat it as completely ordinary.',
    imageGuidance:
      'Visualize one bold surreal rule consistently across the sequence while keeping the source recognizable.',
  },
  {
    id: 'visual-transformation',
    label: 'Visual transformation',
    weight: 5,
    writingGuidance:
      'Make a person, object, or setting from the source physically transform across the panels, with the final form delivering the joke.',
    imageGuidance:
      'Show a clear three-stage physical transformation with materially different silhouettes in each panel.',
  },
  {
    id: 'food-fixation',
    label: 'Food fixation',
    weight: 5,
    writingGuidance:
      'Connect the source to a specific food-motivated obsession or scheme. Vary the food; never default to lasagna unless the source itself specifically calls for lasagna.',
    imageGuidance:
      'Use a source-relevant food as an active prop or consequence, varying the cuisine and avoiding generic lasagna imagery.',
  },
];

export const COMIC_STAGINGS: readonly ComicStagingDefinition[] = [
  {
    id: 'source-native-action',
    label: 'Source-native action',
    weight: 30,
    writingGuidance:
      'Keep the source setting, but find a specific physical interaction with its most distinctive person, object, or detail.',
    imageGuidance:
      'Preserve the source setting and build varied physical action around its most recognizable visual detail.',
  },
  {
    id: 'location-transplant',
    label: 'Unexpected location transplant',
    weight: 15,
    writingGuidance:
      'Move the source premise into one surprising location where it creates a new conflict, while keeping the source recognizable.',
    imageGuidance:
      'Place the recognizable source subject in a surprising, visually rich location that materially affects the action.',
  },
  {
    id: 'prop-domino',
    label: 'Prop-driven domino effect',
    weight: 15,
    writingGuidance:
      'Choose one distinctive prop from the source and make it trigger a visible chain reaction across all three panels.',
    imageGuidance:
      'Use one recognizable source prop as the visual through-line, showing a clear physical chain reaction.',
  },
  {
    id: 'foreground-background',
    label: 'Foreground/background contradiction',
    weight: 15,
    writingGuidance:
      'Build the joke from a contradiction between the featured character in the foreground and an escalating event behind them.',
    imageGuidance:
      'Compose each panel with readable foreground acting and a separate background story that escalates toward the punchline.',
  },
  {
    id: 'scale-shift',
    label: 'Scale shift',
    weight: 10,
    writingGuidance:
      'Make one source element absurdly tiny or enormous, and use the practical consequences of that scale change as the joke.',
    imageGuidance:
      'Create an unmistakable size contrast with strong silhouettes, perspective, and environmental interaction.',
  },
  {
    id: 'public-spectacle',
    label: 'Public spectacle',
    weight: 10,
    writingGuidance:
      'Turn the source situation into a public event with witnesses whose reactions or participation increase the embarrassment or absurdity.',
    imageGuidance:
      'Stage the action as a readable public spectacle with varied crowd reactions and a clear focal point.',
  },
  {
    id: 'theatrical-tableau',
    label: 'Theatrical tableau',
    weight: 5,
    writingGuidance:
      'Present the source with deliberately dramatic stagecraft, entrances, reveals, and poses while the characters treat it as real.',
    imageGuidance:
      'Use theatrical lighting, curtains or staged framing, dramatic entrances, and a strong final visual reveal.',
  },
];

export function weightedSelect<T extends { weight: number }>(
  entries: readonly T[],
  rng: () => number = Math.random
): T {
  if (entries.length === 0) throw new Error('Cannot select from an empty weighted registry.');

  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0 || entries.some((entry) => entry.weight < 0)) {
    throw new Error('Weighted registry must contain non-negative weights with a positive total.');
  }

  const randomValue = rng();
  if (randomValue < 0 || randomValue >= 1) throw new Error('RNG must return a value in the range [0, 1).');

  const roll = randomValue * totalWeight;
  let runningWeight = 0;
  for (const entry of entries) {
    runningWeight += entry.weight;
    if (roll < runningWeight) return entry;
  }

  return entries[entries.length - 1];
}

export function pickComicTheme(rng: () => number = Math.random): ComicThemeDefinition {
  return weightedSelect(COMIC_THEMES, rng);
}

export function pickComicDirection(rng: () => number = Math.random): ComicDirectionDefinition {
  return weightedSelect(COMIC_DIRECTIONS, rng);
}

export function pickComicStaging(rng: () => number = Math.random): ComicStagingDefinition {
  return weightedSelect(COMIC_STAGINGS, rng);
}

export function getComicTheme(id: ComicTheme): ComicThemeDefinition {
  const theme = COMIC_THEMES.find((entry) => entry.id === id);
  if (!theme) throw new Error(`Unknown comic theme: ${id}`);
  return theme;
}

export function getComicDirection(id: ComicDirection): ComicDirectionDefinition {
  const direction = COMIC_DIRECTIONS.find((entry) => entry.id === id);
  if (!direction) throw new Error(`Unknown comic direction: ${id}`);
  return direction;
}

export function getComicStaging(id: ComicStaging): ComicStagingDefinition {
  const staging = COMIC_STAGINGS.find((entry) => entry.id === id);
  if (!staging) throw new Error(`Unknown comic staging: ${id}`);
  return staging;
}
