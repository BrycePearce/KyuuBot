import assert from 'node:assert/strict';
import test from 'node:test';
import { extractReplySource } from '../../../utils/replySource';
import {
  COMIC_DIRECTIONS,
  COMIC_STAGINGS,
  COMIC_THEMES,
  getComicDirection,
  getComicStaging,
  getComicTheme,
  pickComicDirection,
  pickComicStaging,
  pickComicTheme,
} from './creativeDirection';
import { buildImagePrompt, buildScriptSystemPrompt, buildScriptUserPrompt } from './prompts';
import { ComicScript } from './types';
import { startTypingKeepalive } from './typingKeepalive';
import { parseComicScript } from './validation';

const SCRIPT: ComicScript = {
  panels: [
    { description: 'Garfield opens a mysterious box.', caption: 'This seems ambitious.' },
    { description: 'The box grows legs and runs.', caption: 'I preferred cardboard.' },
    { description: 'Garfield watches it leave town.', caption: 'Problem solved.', dialogue: ['Garfield: Keep it.'] },
  ],
};

test('theme registry has the planned weights and boundary selection', () => {
  assert.equal(
    COMIC_THEMES.reduce((sum, theme) => sum + theme.weight, 0),
    100
  );
  assert.deepEqual(
    COMIC_THEMES.map(({ id, weight }) => [id, weight]),
    [
      ['classic', 70],
      ['himbo', 5],
      ['vampire', 5],
      ['zeus', 5],
      ['odie', 5],
      ['nermal', 5],
      ['noir', 2.5],
      ['kaiju', 2.5],
    ]
  );

  assert.equal(pickComicTheme(() => 0).id, 'classic');
  assert.equal(pickComicTheme(() => 0.699999).id, 'classic');
  assert.equal(pickComicTheme(() => 0.7).id, 'himbo');
  assert.equal(pickComicTheme(() => 0.949999).id, 'nermal');
  assert.equal(pickComicTheme(() => 0.95).id, 'noir');
  assert.equal(pickComicTheme(() => 0.975).id, 'kaiju');
  assert.equal(pickComicTheme(() => 0.999999).id, 'kaiju');
});

test('comedy direction registry has the planned weights and boundary selection', () => {
  assert.equal(
    COMIC_DIRECTIONS.reduce((sum, direction) => sum + direction.weight, 0),
    100
  );
  assert.deepEqual(
    COMIC_DIRECTIONS.map(({ id, weight }) => [id, weight]),
    [
      ['dry-observation', 20],
      ['escalating-consequences', 15],
      ['misunderstanding', 15],
      ['petty-backfire', 15],
      ['character-reversal', 15],
      ['surreal-logic', 10],
      ['visual-transformation', 5],
      ['food-fixation', 5],
    ]
  );

  assert.equal(pickComicDirection(() => 0).id, 'dry-observation');
  assert.equal(pickComicDirection(() => 0.2).id, 'escalating-consequences');
  assert.equal(pickComicDirection(() => 0.95).id, 'food-fixation');
  assert.equal(pickComicDirection(() => 0.999999).id, 'food-fixation');
});

test('visual staging registry adds a third weighted variety axis', () => {
  assert.equal(
    COMIC_STAGINGS.reduce((sum, staging) => sum + staging.weight, 0),
    100
  );
  assert.deepEqual(
    COMIC_STAGINGS.map(({ id, weight }) => [id, weight]),
    [
      ['source-native-action', 30],
      ['location-transplant', 15],
      ['prop-domino', 15],
      ['foreground-background', 15],
      ['scale-shift', 10],
      ['public-spectacle', 10],
      ['theatrical-tableau', 5],
    ]
  );

  assert.equal(pickComicStaging(() => 0).id, 'source-native-action');
  assert.equal(pickComicStaging(() => 0.3).id, 'location-transplant');
  assert.equal(pickComicStaging(() => 0.95).id, 'theatrical-tableau');
  assert.equal(pickComicStaging(() => 0.999999).id, 'theatrical-tableau');
});

test('every theme contributes writing and image guidance to prompts', () => {
  const direction = getComicDirection('dry-observation');
  const staging = getComicStaging('source-native-action');

  for (const theme of COMIC_THEMES) {
    const systemPrompt = buildScriptSystemPrompt(theme, direction, staging);
    const imagePrompt = buildImagePrompt(SCRIPT, theme, direction, staging);
    assert.ok(systemPrompt.includes(theme.label));
    assert.ok(systemPrompt.includes(theme.writingGuidance));
    assert.ok(imagePrompt.includes(theme.label));
    assert.ok(imagePrompt.includes(theme.imageGuidance));
  }
});

test('prompts enforce source fidelity, named characters, novelty, and readable three-panel text', () => {
  const theme = getComicTheme('classic');
  const direction = getComicDirection('misunderstanding');
  const staging = getComicStaging('prop-domino');
  const systemPrompt = buildScriptSystemPrompt(theme, direction, staging);
  const userPrompt = buildScriptUserPrompt({ text: 'a haunted printer', hasImage: false, theme, direction, staging });
  const imagePrompt = buildImagePrompt(SCRIPT, theme, direction, staging);

  assert.match(systemPrompt, /primary subject/i);
  assert.match(systemPrompt, /three materially different joke premises/i);
  assert.match(systemPrompt, /reject the most obvious Garfield clich/i);
  assert.match(systemPrompt, /Never introduce lasagna/i);
  assert.match(systemPrompt, /actual names Garfield, Odie, and Nermal/i);
  assert.match(systemPrompt, /one short sentence/i);
  assert.match(userPrompt, /<source_text>a haunted printer<\/source_text>/);
  assert.match(userPrompt, /exactly three panels/i);
  assert.match(imagePrompt, /exactly three equal vertical panels/i);
  assert.match(imagePrompt, /copy exactly/i);
  assert.match(imagePrompt, /Do not substitute a generic orange cat/i);
});

test('image prompts include comedy-direction visual guidance', () => {
  const theme = getComicTheme('kaiju');
  const staging = getComicStaging('public-spectacle');
  for (const direction of COMIC_DIRECTIONS) {
    const imagePrompt = buildImagePrompt(SCRIPT, theme, direction, staging);
    assert.ok(imagePrompt.includes(direction.label));
    assert.ok(imagePrompt.includes(direction.imageGuidance));
  }
});

test('every staging contributes writing and image guidance to prompts', () => {
  const theme = getComicTheme('classic');
  const direction = getComicDirection('dry-observation');

  for (const staging of COMIC_STAGINGS) {
    const systemPrompt = buildScriptSystemPrompt(theme, direction, staging);
    const imagePrompt = buildImagePrompt(SCRIPT, theme, direction, staging);
    assert.ok(systemPrompt.includes(staging.label));
    assert.ok(systemPrompt.includes(staging.writingGuidance));
    assert.ok(imagePrompt.includes(staging.label));
    assert.ok(imagePrompt.includes(staging.imageGuidance));
  }
});

test('reference-image prompt requires identifiable source details', () => {
  const prompt = buildImagePrompt(
    SCRIPT,
    getComicTheme('vampire'),
    getComicDirection('escalating-consequences'),
    getComicStaging('source-native-action'),
    true
  );

  assert.match(prompt, /reference image is the comic source/i);
  assert.match(prompt, /Preserve its recognizable people, objects, clothing, colors/i);
  assert.match(prompt, /visibly identifiable/i);
  assert.match(prompt, /three genuinely different sequential panels/i);

  const scriptPrompt = buildScriptUserPrompt({
    hasImage: true,
    theme: getComicTheme('vampire'),
    direction: getComicDirection('escalating-consequences'),
    staging: getComicStaging('source-native-action'),
  });
  assert.match(scriptPrompt, /one to three distinctive visual anchors/i);
});

test('reply extraction includes message text, embed text, and embed images', async () => {
  const source = await extractReplySource({
    reference: { messageId: 'reply-id' },
    fetchReference: async () => ({
      content: 'ordinary message text',
      attachments: new Map(),
      embeds: [
        {
          data: {
            title: 'Embedded headline',
            description: 'Embedded description',
            fields: [{ name: 'Result', value: 'A surprising value' }],
            image: { url: 'https://example.com/source.png' },
          },
        },
      ],
    }),
  } as any);

  assert.match(source?.text ?? '', /ordinary message text/);
  assert.match(source?.text ?? '', /Embedded headline/);
  assert.match(source?.text ?? '', /Embedded description/);
  assert.match(source?.text ?? '', /A surprising value/);
  assert.deepEqual(source?.imageUrls, ['https://example.com/source.png']);
});

test('script parsing accepts valid JSON and accidental markdown fences', () => {
  const parsed = parseComicScript(`\`\`\`json\n${JSON.stringify(SCRIPT)}\n\`\`\``);
  assert.deepEqual(parsed, SCRIPT);
});

test('script validation rejects malformed panels and dialogue', () => {
  const cases = [
    {},
    { panels: SCRIPT.panels.slice(0, 2) },
    { panels: [{ description: '', caption: 'x' }, SCRIPT.panels[1], SCRIPT.panels[2]] },
    { panels: [{ description: 'x', caption: '' }, SCRIPT.panels[1], SCRIPT.panels[2]] },
    { panels: [{ description: 'x', caption: 'y', dialogue: ['okay', 42] }, SCRIPT.panels[1], SCRIPT.panels[2]] },
  ];

  for (const value of cases) {
    assert.throws(() => parseComicScript(JSON.stringify(value)));
  }
});

test('typing keepalive refreshes until stopped and tolerates refresh failures', async () => {
  let calls = 0;
  const errors: unknown[] = [];
  const stop = startTypingKeepalive(
    async () => {
      calls += 1;
      if (calls === 2) throw new Error('temporary typing failure');
    },
    5,
    (error) => errors.push(error)
  );

  await new Promise((resolve) => setTimeout(resolve, 24));
  stop();
  const callsWhenStopped = calls;
  await new Promise((resolve) => setTimeout(resolve, 15));

  assert.ok(callsWhenStopped >= 3);
  assert.equal(calls, callsWhenStopped);
  assert.equal(errors.length, 1);
});
