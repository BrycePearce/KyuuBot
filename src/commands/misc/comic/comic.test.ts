import type Anthropic from '@anthropic-ai/sdk';
import assert from 'node:assert/strict';
import test from 'node:test';
import { extractReplySource } from '../../../utils/replySource';
import { NonRetryableError, withRetry } from '../../../utils/withRetry';
import { readComicPlan, readComicScript } from './scriptGenerator';
import {
  COMIC_DIRECTIONS,
  COMIC_STAGINGS,
  COMIC_THEMES,
  getComicDirection,
  getComicStaging,
  getComicTheme,
  getComicVariantMessage,
  pickComicDirection,
  pickComicStaging,
  pickComicTheme,
} from './creativeDirection';
import {
  buildConceptSystemPrompt,
  buildConceptUserPrompt,
  buildImagePrompt,
  buildScriptSystemPrompt,
  buildScriptUserPrompt,
} from './prompts';
import { buildComicImageEditRequest } from './imageGenerator';
import { ComicPlan, ComicScript } from './types';
import { startTypingKeepalive } from './typingKeepalive';
import { parseComicScript } from './validation';

const PLAN: ComicPlan = {
  sourceAnchor: 'A mysterious cardboard box',
  premise: 'Garfield refuses responsibility until the box solves its own problem.',
  characterMotivation: 'Garfield wants the box gone without standing up.',
  themeLogic: 'Garfield stays lazy, dry, and selfish.',
  setup: 'Garfield is expected to open the box.',
  turn: 'The box grows legs before Garfield acts.',
  payoff: 'Garfield claims success after the box leaves.',
  visualThroughline: 'The same labeled cardboard box changes position in every panel.',
  continuityFacts: ['Garfield never opens the box.', 'The box leaves under its own power.'],
  textMode: 'captions',
};

const SCRIPT: ComicScript = {
  textMode: 'captions',
  panels: [
    { description: 'Garfield stares at a mysterious box without touching it.', caption: 'This seems ambitious.' },
    { description: 'The box grows legs and runs.', caption: 'I preferred cardboard.' },
    { description: 'Garfield watches it leave town.', caption: 'Problem solved.' },
  ],
};

const DIALOGUE_SCRIPT: ComicScript = {
  textMode: 'dialogue',
  panels: [
    { description: 'Jon points at a mysterious box.', dialogue: [{ speaker: 'Jon', text: 'Open it.' }] },
    { description: 'The box grows legs and runs away.' },
    { description: 'Garfield watches it leave.', dialogue: [{ speaker: 'Garfield', text: 'Done.' }] },
  ],
};

function toolUseBlock(input: unknown, name = 'emit_comic_script'): Anthropic.Messages.ContentBlock {
  return { type: 'tool_use', id: 'toolu_1', name, input, caller: { type: 'direct' } };
}

function buildMessage(overrides: Partial<Anthropic.Messages.Message>): Anthropic.Messages.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-6',
    content: [],
    stop_reason: 'tool_use',
    stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0 },
    ...overrides,
  } as Anthropic.Messages.Message;
}

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
    const systemPrompt = buildConceptSystemPrompt(theme, direction, staging);
    const imagePrompt = buildImagePrompt(SCRIPT, theme, PLAN);
    assert.ok(systemPrompt.includes(theme.label));
    assert.ok(systemPrompt.includes(theme.writingGuidance));
    assert.ok(imagePrompt.includes(theme.label));
    assert.ok(imagePrompt.includes(theme.imageGuidance));
  }
});

test('rare variants have dominant visual requirements and an accompanying result message', () => {
  assert.equal(getComicVariantMessage(getComicTheme('classic')), undefined);

  const expectedMessages = {
    himbo: "You've been Himbofied! Looking INCREDIBLE out there!",
    vampire: "You've been Garf-ula'd!",
    zeus: "You've been Zeusified!",
    odie: "BORK! You've been Odie'd!",
    nermal: "Oh no, you've been Nermal'd!",
    noir: "You've been Noirfield'd!",
    kaiju: "You've been Kaiju'd!",
  } as const;

  for (const [id, expectedMessage] of Object.entries(expectedMessages)) {
    const theme = getComicTheme(id as keyof typeof expectedMessages);
    const imagePrompt = buildImagePrompt(SCRIPT, theme, PLAN);
    const scriptPrompt = buildScriptSystemPrompt(theme);

    assert.ok(theme.visualRequirements.length >= 3);
    assert.equal(getComicVariantMessage(theme), expectedMessage);
    assert.match(imagePrompt, /RARE VARIANT LOCK/i);
    assert.match(imagePrompt, /immediately obvious at thumbnail size/i);
    assert.match(imagePrompt, /Do not drift toward ordinary Garfield/i);
    assert.match(scriptPrompt, /rare variant, not normal Garfield in a costume/i);
    for (const marker of theme.visualRequirements) assert.ok(imagePrompt.includes(marker));
  }
});

test('prompts enforce source fidelity, named characters, novelty, and readable three-panel text', () => {
  const theme = getComicTheme('classic');
  const direction = getComicDirection('misunderstanding');
  const staging = getComicStaging('prop-domino');
  const systemPrompt = buildConceptSystemPrompt(theme, direction, staging);
  const userPrompt = buildConceptUserPrompt({ text: 'a haunted printer', hasImage: false });
  const scriptPrompt = buildScriptSystemPrompt(theme);
  const scriptUserPrompt = buildScriptUserPrompt({ text: 'a haunted printer', hasImage: false, plan: PLAN });
  const imagePrompt = buildImagePrompt(SCRIPT, theme, PLAN);

  assert.match(systemPrompt, /comic subject/i);
  assert.match(systemPrompt, /three genuinely different jokes/i);
  assert.match(systemPrompt, /contradictory facts/i);
  assert.match(systemPrompt, /Mondays.*lasagna/i);
  assert.match(scriptPrompt, /same setup, turn, and payoff/i);
  assert.match(scriptPrompt, /silent continuity pass/i);
  assert.match(scriptUserPrompt, /binding plan/i);
  assert.match(scriptUserPrompt, /continuityFacts/i);
  assert.match(userPrompt, /<source_text>a haunted printer<\/source_text>/);
  assert.match(imagePrompt, /exactly three equal vertical panels/i);
  assert.match(imagePrompt, /caption-only strip/i);
  assert.match(imagePrompt, /Do not substitute generic animals/i);
});

test('vampire theme preserves garlic as a character constraint', () => {
  const prompt = buildConceptSystemPrompt(
    getComicTheme('vampire'),
    getComicDirection('dry-observation'),
    getComicStaging('source-native-action')
  );

  assert.match(prompt, /Garlic is dangerous or repellent/i);
  assert.match(prompt, /never make him desire, eat, buy, or protect garlic/i);
});

test('concept prompts include comedy-direction guidance without making it mandatory', () => {
  const theme = getComicTheme('kaiju');
  const staging = getComicStaging('public-spectacle');
  for (const direction of COMIC_DIRECTIONS) {
    const conceptPrompt = buildConceptSystemPrompt(theme, direction, staging);
    assert.ok(conceptPrompt.includes(direction.label));
    assert.ok(conceptPrompt.includes(direction.writingGuidance));
    assert.match(conceptPrompt, /suggestions, not obligations/i);
  }
});

test('every staging contributes writing and image guidance to prompts', () => {
  const theme = getComicTheme('classic');
  const direction = getComicDirection('dry-observation');

  for (const staging of COMIC_STAGINGS) {
    const systemPrompt = buildConceptSystemPrompt(theme, direction, staging);
    assert.ok(systemPrompt.includes(staging.label));
    assert.ok(systemPrompt.includes(staging.writingGuidance));
  }
});

test('reference-image prompt requires identifiable source details', () => {
  const prompt = buildImagePrompt(SCRIPT, getComicTheme('vampire'), PLAN, true);

  assert.match(prompt, /reference image is the comic source/i);
  assert.match(prompt, /Preserve its recognizable people, objects, clothing, colors/i);
  assert.match(prompt, /visibly identifiable/i);
  assert.match(prompt, /three genuinely different sequential panels/i);

  const conceptPrompt = buildConceptUserPrompt({
    text: undefined,
    hasImage: true,
  });
  assert.match(conceptPrompt, /concrete visual anchors/i);
});

test('dialogue image prompts omit caption bars and speaker labels from rendered text', () => {
  const prompt = buildImagePrompt(DIALOGUE_SCRIPT, getComicTheme('classic'), { ...PLAN, textMode: 'dialogue' });

  assert.match(prompt, /dialogue-only strip/i);
  assert.match(prompt, /Do not create bottom caption bars/i);
  assert.match(prompt, /spoken by Garfield/i);
  assert.match(prompt, /render only these words.*"Done\."/i);
  assert.doesNotMatch(prompt, /"Garfield: Done\."/);
});

test('GPT Image 2 edit requests omit unsupported input_fidelity', () => {
  const request = buildComicImageEditRequest({} as any, 'make a comic');

  assert.equal(request.model, 'gpt-image-2');
  assert.equal('input_fidelity' in request, false);
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
    { ...SCRIPT, panels: [{ description: '', caption: 'x' }, SCRIPT.panels[1], SCRIPT.panels[2]] },
    { ...SCRIPT, panels: [{ description: 'x', caption: '' }, SCRIPT.panels[1], SCRIPT.panels[2]] },
    {
      ...SCRIPT,
      panels: [
        { description: 'x', caption: 'y', dialogue: [{ speaker: 'Garfield', text: 'No.' }] },
        SCRIPT.panels[1],
        SCRIPT.panels[2],
      ],
    },
    {
      ...DIALOGUE_SCRIPT,
      panels: [
        { description: 'x', dialogue: [{ speaker: 'Garfield', text: '' }] },
        DIALOGUE_SCRIPT.panels[1],
        DIALOGUE_SCRIPT.panels[2],
      ],
    },
    {
      ...DIALOGUE_SCRIPT,
      panels: [
        { description: 'x', dialogue: [{ speaker: 'Garfield', text: 'Garfield: No.' }] },
        DIALOGUE_SCRIPT.panels[1],
        DIALOGUE_SCRIPT.panels[2],
      ],
    },
  ];

  for (const value of cases) {
    assert.throws(() => parseComicScript(JSON.stringify(value)));
  }
});

test('script parse failure reports what the model actually said', () => {
  assert.throws(
    () => parseComicScript('I need to see the image before I can write this.'),
    (error: unknown) => {
      const message = error instanceof Error ? error.message : '';
      return /did not return JSON/.test(message) && message.includes('I need to see the image');
    }
  );
});

test('plan and script tool-call responses are read from their named tool blocks', () => {
  const plan = readComicPlan(buildMessage({ content: [toolUseBlock(PLAN, 'plan_comic')] }));
  const script = readComicScript(buildMessage({ content: [toolUseBlock(SCRIPT)] }));

  assert.deepEqual(plan, PLAN);
  assert.deepEqual(script, SCRIPT);
});

test('refusals are non-retryable and truncation is reported as such', () => {
  assert.throws(
    () => readComicScript(buildMessage({ content: [], stop_reason: 'refusal' })),
    (error: unknown) => error instanceof NonRetryableError
  );

  assert.throws(
    () => readComicScript(buildMessage({ content: [toolUseBlock({ panels: [] })], stop_reason: 'max_tokens' })),
    /output limit/
  );
});

test('retry re-rolls malformed scripts but gives up on refusals', async () => {
  const delays: number[] = [];
  const sleep = async (ms: number) => {
    delays.push(ms);
  };

  let attempts = 0;
  const script = await withRetry(
    async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('Comic script must contain exactly three panels.');
      return SCRIPT;
    },
    { attempts: 3, baseDelayMs: 10, sleep }
  );

  assert.deepEqual(script, SCRIPT);
  assert.equal(attempts, 3);
  assert.equal(delays.length, 2);

  let refusalAttempts = 0;
  await assert.rejects(
    withRetry(
      async () => {
        refusalAttempts += 1;
        throw new NonRetryableError('declined');
      },
      { attempts: 3, baseDelayMs: 10, sleep }
    ),
    (error: unknown) => error instanceof NonRetryableError
  );
  assert.equal(refusalAttempts, 1);
});

test('retry distinguishes transient failures from bad requests', async () => {
  const sleep = async () => {};

  let rateLimited = 0;
  await assert.rejects(
    withRetry(
      async () => {
        rateLimited += 1;
        throw Object.assign(new Error('rate limited'), { status: 429 });
      },
      { attempts: 3, baseDelayMs: 1, sleep }
    )
  );
  assert.equal(rateLimited, 3);

  let badRequests = 0;
  await assert.rejects(
    withRetry(
      async () => {
        badRequests += 1;
        throw Object.assign(new Error('bad request'), { status: 400 });
      },
      { attempts: 3, baseDelayMs: 1, sleep }
    )
  );
  assert.equal(badRequests, 1, 'a 400 will fail identically every time');
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
