import assert from 'node:assert/strict';
import test from 'node:test';
import { NonRetryableError } from '../../../utils/withRetry';
import { variantFromDirection } from './character';
import { getLens, getRecentLenses, LENSES, pickLens, recordLens } from './lenses';
import {
  buildEditorSystemPrompt,
  buildEditorUserPrompt,
  buildImageEditPrompt,
  buildPitchSystemPrompt,
  buildPitchUserPrompt,
} from './prompts';
import { GarfieldEditPlan, GarfieldPitchSet, GarfieldSourceBrief, LensId } from './types';
import { describeModerationBlock, isModerationBlocked, pickEditSize } from './utils';
import {
  assertEditPlan,
  assertEditPlanFor,
  assertKeepsJokeAnchors,
  assertPitchSet,
  assertSourceBrief,
  parseJsonResponse,
} from './validation';

const BRIEF: GarfieldSourceBrief = {
  sourceKind: 'meme-or-comic',
  format: 'three-beat tsundere reaction meme fan art',
  artStyle: 'clean anime cel shading, thin black linework, white background',
  literalFacts: ['A blonde girl in a Slytherin uniform appears three times.'],
  characters: ['The blonde Slytherin girl, drawn three times', 'Potter, addressed but not shown'],
  visibleText: [
    { location: 'top-left speech', text: "YOU'RE WITH A WEASLEY, POTTER?" },
    { location: 'right thought bubble', text: 'W-WHY DID I JUST SAY THAT?!' },
  ],
  existingJoke: 'She accidentally confesses she would date Potter, then panics.',
  jokeAnchors: ['dated'],
  editableSlots: ['each drawing of the girl', 'each speech bubble', 'the Slytherin crest'],
  mustPreserve: ['the Slytherin uniform', 'the three-beat structure'],
};

const SCENERY: GarfieldSourceBrief = {
  ...BRIEF,
  sourceKind: 'scenery',
  format: 'phone photo of a mountain lake at sunset',
  characters: [],
  visibleText: [],
  jokeAnchors: [],
};

const SCREENSHOT: GarfieldSourceBrief = {
  ...BRIEF,
  sourceKind: 'screenshot-or-text',
  format: 'screenshot of a tweet',
  characters: [],
};

// Modeled on the version the user preferred: a committed hybrid with lightly translated dialogue.
const PLAN: GarfieldEditPlan = {
  sourceHook: 'The tsundere slip: a haughty jab, an accidental confession, then panic.',
  lens: 'character-hybrid',
  premise: 'The tsundere girl becomes a Garfield hybrid who is jealous that Jon has a dog.',
  castMapping: [
    {
      original: 'the blonde Slytherin girl, all three drawings',
      becomes: 'a Garfield hybrid: orange striped fur, cat ears, whiskers; same hair, uniform, and pose',
    },
    { original: 'Potter (addressed)', becomes: 'Jon' },
  ],
  edits: [],
  textPolicy: 'adapt',
  textChanges: [
    {
      location: 'top-left speech',
      original: "YOU'RE WITH A WEASLEY, POTTER?",
      replacement: "YOU'RE WITH A DOG, JON?",
    },
  ],
  characterHint: 'Garfield secretly cares about Jon and is too proud to admit it.',
  coherenceCheck: 'Every line is still hers, and the panic still follows the slip.',
  preserve: ['the panic thought bubble', 'the signature'],
  caption: '',
};

function pitchSet(count = 3): GarfieldPitchSet {
  return {
    pitches: Array.from({ length: count }, (_, index) => ({
      title: `Pitch ${index + 1}`,
      lens: 'character-hybrid' as const,
      premise: 'A premise.',
      castMapping: [{ original: 'the girl', becomes: 'a Garfield hybrid' }],
      edits: [],
      textPolicy: 'keep' as const,
      textChanges: [],
      characterHint: 'A hint.',
      coherenceCheck: 'Coherent.',
    })),
  };
}

/** Every lens pickLens can return for a brief, sampled across the whole random range. */
function lensDistribution(brief: GarfieldSourceBrief, recent: LensId[] = []): Map<LensId, number> {
  const counts = new Map<LensId, number>();
  for (let i = 0; i < 1000; i++) {
    const lens = pickLens(brief, recent, () => i / 1000);
    counts.set(lens, (counts.get(lens) ?? 0) + 1);
  }
  return counts;
}

test('source brief validation accepts a complete brief and rejects missing fields', () => {
  assert.doesNotThrow(() => assertSourceBrief(BRIEF));
  assert.doesNotThrow(() => assertSourceBrief({ ...BRIEF, characters: [] }));
  assert.throws(() => assertSourceBrief({ ...BRIEF, existingJoke: '' }), /existingJoke/);
  assert.throws(() => assertSourceBrief({ ...BRIEF, characters: undefined }), /characters/);
  assert.throws(() => assertSourceBrief({ ...BRIEF, sourceKind: 'selfie' }), /sourceKind/);
});

test('pitch validation requires exactly three pitches and allows a repeated lens', () => {
  assert.doesNotThrow(() => assertPitchSet(pitchSet()));
  assert.throws(() => assertPitchSet(pitchSet(4)), /exactly three/);
  const [first, ...rest] = pitchSet().pitches;
  assert.throws(() => assertPitchSet({ pitches: [{ ...first, title: '' }, ...rest] }), /title/);
});

test('edit plan validation checks lens, text policy, and that something changes', () => {
  assert.doesNotThrow(() => assertEditPlan(PLAN));
  assert.throws(() => assertEditPlan({ ...PLAN, lens: 'deadpan-intrusion' }), /unknown lens/);
  assert.throws(() => assertEditPlan({ ...PLAN, textPolicy: 'keep' }), /keeps the text but lists text changes/);
  assert.throws(() => assertEditPlan({ ...PLAN, textPolicy: 'rewrite' }), /textPolicy/);
  assert.throws(() => assertEditPlan({ ...PLAN, castMapping: [], edits: [], textChanges: [] }), /change something/);
  assert.throws(() => assertEditPlan({ ...PLAN, coherenceCheck: '' }), /coherenceCheck/);
  assert.doesNotThrow(() => assertEditPlan({ ...PLAN, textPolicy: 'keep', textChanges: [] }));
});

test('parseJsonResponse validates JSON text and treats refusals as non-retryable', () => {
  const ok = parseJsonResponse(
    { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(PLAN), citations: null }] },
    'editor',
    assertEditPlan
  );
  assert.equal(ok.lens, 'character-hybrid');

  assert.throws(
    () => parseJsonResponse({ stop_reason: 'refusal', content: [] }, 'editor', assertEditPlan),
    NonRetryableError
  );
  assert.throws(
    () =>
      parseJsonResponse(
        { stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json', citations: null }] },
        'editor',
        assertEditPlan
      ),
    /did not return JSON/
  );
});

test('lens roll only offers lenses that fit the source', () => {
  const meme = lensDistribution(BRIEF);
  assert.ok(meme.has('character-hybrid') && meme.has('cast-swap') && meme.has('bad-disguise'));
  assert.ok(meme.has('davis-restyle') && meme.has('prop-swap'));
  assert.ok(!meme.has('subject-transformation'), 'memes have no non-human focal subject lens');

  const scenery = lensDistribution(SCENERY);
  for (const lens of ['character-hybrid', 'cast-swap', 'bad-disguise', 'text-translation'] as const) {
    assert.ok(!scenery.has(lens), `${lens} needs characters or text`);
  }
  assert.ok(scenery.has('subject-transformation') && scenery.has('davis-restyle'));

  const screenshot = lensDistribution(SCREENSHOT);
  assert.ok(!screenshot.has('davis-restyle'));
  const textShare = (screenshot.get('text-translation') ?? 0) / 1000;
  assert.ok(textShare > 0.5, `screenshots should usually be text-translated (got ${textShare})`);
});

test('recently used lenses become less likely but stay possible', () => {
  const fresh = lensDistribution(BRIEF).get('character-hybrid') ?? 0;
  const penalized = lensDistribution(BRIEF, ['character-hybrid']).get('character-hybrid') ?? 0;
  assert.ok(penalized > 0 && penalized < fresh / 2, `expected a penalty (fresh ${fresh}, penalized ${penalized})`);
});

test('recent lens memory is per scope, newest first, deduped, and capped', () => {
  recordLens('guild-a', 'cast-swap');
  recordLens('guild-a', 'prop-swap');
  recordLens('guild-a', 'davis-restyle');
  recordLens('guild-a', 'cast-swap');
  recordLens('guild-a', 'bad-disguise');
  assert.deepEqual(getRecentLenses('guild-a'), ['bad-disguise', 'cast-swap', 'davis-restyle']);
  assert.deepEqual(getRecentLenses('guild-b'), []);
});

test('every lens has guidance and getLens rejects unknown ids', () => {
  for (const lens of LENSES) assert.ok(lens.guidance.length > 40, lens.id);
  assert.throws(() => getLens('one-trait' as LensId), /Unknown Garfield lens/);
});

test('a named character in the direction picks the variant', () => {
  assert.equal(variantFromDirection('make it odie'), 'odie');
  assert.equal(variantFromDirection('Nermal but smug'), 'nermal');
  assert.equal(variantFromDirection('jon arbuckle energy'), 'jon');
  assert.equal(variantFromDirection('dracula version'), 'garfula');
  assert.equal(variantFromDirection('make garfield buff'), 'himbo');
  assert.equal(variantFromDirection('garfield in a disguise'), 'garfield');
  assert.equal(variantFromDirection('in a disguise'), undefined);
  assert.equal(variantFromDirection(undefined), undefined);
  assert.equal(variantFromDirection('the jonquil flowers'), undefined, 'matches whole words only');
});

test('planning prompts assign the rolled lens and keep the Garfield-ification rules', () => {
  const lens = getLens('bad-disguise');
  for (const prompt of [buildPitchSystemPrompt('garfield', lens), buildEditorSystemPrompt('garfield', lens)]) {
    assert.match(prompt, /Assigned lens for this run: bad-disguise/);
    assert.match(prompt, /Commit to it; do not drift back/);
    assert.match(prompt, /absurdity of the conversion itself/);
    assert.match(prompt, /small Discord thumbnail/);
    assert.match(prompt, /Text stays exactly as it is by default/);
    assert.match(prompt, /translate the context, never the joke/);
    assert.match(prompt, /Personality is a hint, not the punchline/);
    assert.match(prompt, /Never use Mondays, lasagna, naps/);
    assert.match(prompt, /Never add the featured character as a separate commentator or cameo/);
    assert.match(prompt, /speech-bubble tails keep their owners/);
    assert.match(prompt, /affectionate roast/);
    assert.match(prompt, /<user_direction>/);
  }
  assert.match(
    buildPitchSystemPrompt('garfield', lens),
    /three genuinely different interpretations of the assigned lens/
  );

  const editor = buildEditorSystemPrompt('garfield', lens);
  assert.match(editor, /Switch to another lens only when/);
  assert.match(editor, /cast-swap: The actual Garfield cast/);
  assert.doesNotMatch(editor, /bad-disguise: The featured character/);
  assert.match(editor, /text changes that do not earn their place/);
  assert.match(editor, /any change to a jokeAnchor/);
});

test('user direction reaches the pitch and editor prompts only when supplied', () => {
  const direction = 'make her odie wearing sunglasses';
  assert.match(buildPitchUserPrompt({ sourceBrief: BRIEF, direction }), /<user_direction>make her odie/);
  assert.match(
    buildEditorUserPrompt({ sourceBrief: BRIEF, pitches: pitchSet(), direction }),
    /<user_direction>make her odie/
  );
  assert.doesNotMatch(buildPitchUserPrompt({ sourceBrief: BRIEF }), /<user_direction>/);
});

test('editor prompt tells the replan which premises were blocked', () => {
  const prompt = buildEditorUserPrompt({
    sourceBrief: BRIEF,
    pitches: pitchSet(),
    blockedPremises: ['Garfield casts the Imperius Curse on her.'],
  });
  assert.match(prompt, /<blocked_plan>Garfield casts the Imperius Curse on her\.<\/blocked_plan>/);
  assert.match(prompt, /materially different, safer plan/);
  assert.doesNotMatch(buildEditorUserPrompt({ sourceBrief: BRIEF, pitches: pitchSet() }), /blocked_plan/);
});

test('hybrid image prompt lists cast transformations and keeps characters consistent', () => {
  const prompt = buildImageEditPrompt({
    variant: 'garfield',
    lens: getLens(PLAN.lens),
    plan: PLAN,
    sourceBrief: BRIEF,
  });
  assert.match(prompt, /Approach: The image’s people or characters become hybrids/);
  assert.match(prompt, /the blonde Slytherin girl, all three drawings becomes a Garfield hybrid/);
  assert.match(prompt, /Every transformed character keeps their hair, outfit/);
  assert.match(prompt, /replace "YOU'RE WITH A WEASLEY, POTTER\?" with "YOU'RE WITH A DOG, JON\?"/);
  assert.match(prompt, /clean anime cel shading/);
  assert.match(prompt, /overall composition, palette, and mood/);
  assert.match(prompt, /Do not add extra characters, props, or food/);
});

test('davis restyle redraws the whole image and does not pin the palette', () => {
  const plan: GarfieldEditPlan = {
    ...PLAN,
    lens: 'davis-restyle',
    castMapping: [],
    edits: [{ target: 'whole image', change: 'Sunday-strip linework and flat colors' }],
    textPolicy: 'keep',
    textChanges: [],
  };
  const prompt = buildImageEditPrompt({
    variant: 'garfield',
    lens: getLens('davis-restyle'),
    plan,
    sourceBrief: BRIEF,
  });
  assert.match(prompt, /Redraw the entire image in Jim Davis’s Garfield newspaper-strip style/);
  assert.doesNotMatch(prompt, /palette/);
  assert.doesNotMatch(prompt, /Transformations:/);
  assert.match(prompt, /Leave every existing piece of text exactly as it is/);
});

test('a keep text policy leaves text alone even if stray changes are present', () => {
  const plan = { ...PLAN, lens: 'prop-swap' as const, textPolicy: 'keep' as const };
  const prompt = buildImageEditPrompt({ variant: 'odie', lens: getLens('prop-swap'), plan, sourceBrief: BRIEF });
  assert.match(prompt, /Leave every existing piece of text exactly as it is/);
  assert.doesNotMatch(prompt, /replace "/);
  assert.match(prompt, /Each transformation keeps the original pose, framing, and placement/);
  assert.match(prompt, /Odie: a yellow dog/);
});

test('joke anchors must survive text changes word for word', () => {
  const datedLine = "HONESTLY! I'D HAVE DATED YOU JUST TO SAVE YOU FROM THAT MISTAKE!";
  const withLine = (replacement: string): GarfieldEditPlan => ({
    ...PLAN,
    textChanges: [...PLAN.textChanges, { location: 'right speech', original: datedLine, replacement }],
  });

  assert.throws(
    () =>
      assertKeepsJokeAnchors(withLine("HONESTLY! I'D HAVE FETCHED FOR YOU JUST TO SAVE YOU FROM THAT MISTAKE!"), [
        'dated',
      ]),
    /rewrote the joke anchor "dated"/
  );
  assert.doesNotThrow(() => assertKeepsJokeAnchors(withLine(datedLine.replace('YOU', 'YOU, JON,')), ['dated']));
  assert.doesNotThrow(() => assertKeepsJokeAnchors(PLAN, ['dated']));
  assert.doesNotThrow(() => assertKeepsJokeAnchors(PLAN, []));
  assert.throws(() => assertKeepsJokeAnchors(withLine("I'D HAVE OUTDATED YOU"), ['dated']), /joke anchor/);
});

test('the editor validator applies the source brief joke anchors', () => {
  const validate = assertEditPlanFor(BRIEF);
  assert.doesNotThrow(() => validate(PLAN));
  assert.throws(
    () =>
      validate({
        ...PLAN,
        textChanges: [
          { location: 'right speech', original: "I'D HAVE DATED YOU", replacement: "I'D HAVE PLAYED WITH YOU" },
        ],
      }),
    /joke anchor/
  );
});

test('moderation helpers recognize OpenAI moderation blocks and surface their details', () => {
  const blocked = {
    code: 'moderation_blocked',
    requestID: 'req_123',
    error: { moderation_details: { moderation_stage: 'output', categories: ['sexual'] } },
  };
  assert.equal(isModerationBlocked(blocked), true);
  assert.equal(isModerationBlocked({ code: 'rate_limit_exceeded' }), false);
  assert.equal(isModerationBlocked(new Error('boom')), false);
  assert.equal(
    describeModerationBlock(blocked),
    '{"moderation_stage":"output","categories":["sexual"]} (request req_123)'
  );
});

test('edit size follows the source aspect ratio', () => {
  assert.equal(pickEditSize(1996, 2048), '1024x1024');
  assert.equal(pickEditSize(1920, 1080), '1536x1024');
  assert.equal(pickEditSize(1080, 1920), '1024x1536');
});
