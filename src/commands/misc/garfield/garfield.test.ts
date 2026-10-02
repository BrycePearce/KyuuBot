import assert from 'node:assert/strict';
import test from 'node:test';
import { NonRetryableError } from '../../../utils/withRetry';
import {
  buildEditorSystemPrompt,
  buildEditorUserPrompt,
  buildImageEditPrompt,
  buildPitchSystemPrompt,
  buildPitchUserPrompt,
} from './prompts';
import { GarfieldEditPlan, GarfieldPitchSet, GarfieldSourceBrief } from './types';
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
  editableSlots: ['each drawing of the girl', 'each speech bubble'],
  mustPreserve: ['the Slytherin uniform', 'the three-beat structure'],
};

// Modeled on the version the user preferred: a committed hybrid with lightly translated dialogue.
const PLAN: GarfieldEditPlan = {
  sourceHook: 'The tsundere slip: a haughty jab, an accidental confession, then panic.',
  mechanism: 'character-hybrid',
  premise: 'The tsundere girl becomes a Garfield hybrid who is jealous that Jon has a dog.',
  castMapping: [
    {
      original: 'the blonde Slytherin girl, all three drawings',
      becomes: 'a Garfield hybrid: orange striped fur, cat ears, whiskers; same hair, uniform, and pose',
    },
    { original: 'Potter (addressed)', becomes: 'Jon' },
    { original: 'a Weasley (referenced)', becomes: 'a dog, i.e. Odie' },
  ],
  edits: [],
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
      mechanism: 'character-hybrid' as const,
      premise: 'A premise.',
      castMapping: [{ original: 'the girl', becomes: 'a Garfield hybrid' }],
      edits: [],
      textChanges: [],
      characterHint: 'A hint.',
      coherenceCheck: 'Coherent.',
    })),
  };
}

test('source brief validation accepts a complete brief and rejects missing fields', () => {
  assert.doesNotThrow(() => assertSourceBrief(BRIEF));
  assert.doesNotThrow(() => assertSourceBrief({ ...BRIEF, characters: [] }));
  assert.throws(() => assertSourceBrief({ ...BRIEF, existingJoke: '' }), /existingJoke/);
  assert.throws(() => assertSourceBrief({ ...BRIEF, characters: undefined }), /characters/);
});

test('pitch validation requires exactly three pitches and allows a repeated approach', () => {
  assert.doesNotThrow(() => assertPitchSet(pitchSet()));
  assert.throws(() => assertPitchSet(pitchSet(4)), /exactly three/);
  const [first, ...rest] = pitchSet().pitches;
  assert.throws(() => assertPitchSet({ pitches: [{ ...first, title: '' }, ...rest] }), /title/);
});

test('edit plan validation rejects retired mechanisms and plans that change nothing', () => {
  assert.doesNotThrow(() => assertEditPlan(PLAN));
  assert.throws(() => assertEditPlan({ ...PLAN, mechanism: 'deadpan-intrusion' }), /mechanism/);
  assert.throws(() => assertEditPlan({ ...PLAN, castMapping: [], edits: [], textChanges: [] }), /change something/);
  assert.throws(() => assertEditPlan({ ...PLAN, coherenceCheck: '' }), /coherenceCheck/);
});

test('parseJsonResponse validates JSON text and treats refusals as non-retryable', () => {
  const ok = parseJsonResponse(
    { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(PLAN), citations: null }] },
    'editor',
    assertEditPlan
  );
  assert.equal(ok.mechanism, 'character-hybrid');

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

test('planning prompts aim for committed, coherent Garfield-ification instead of punchlines', () => {
  for (const prompt of [buildPitchSystemPrompt('garfield'), buildEditorSystemPrompt('garfield')]) {
    assert.match(prompt, /Garfield-ify the image/);
    assert.match(prompt, /absurdity of the conversion itself/);
    assert.match(prompt, /Personality is a hint, not the punchline/);
    assert.match(prompt, /Never use Mondays, lasagna, naps/);
    assert.match(prompt, /Never add the featured character as a separate commentator or cameo/);
    assert.match(prompt, /speech-bubble tails keep their owners/);
    assert.match(prompt, /Map roles, not words/);
    assert.match(prompt, /Translate the context, never the joke/);
  }
  assert.match(buildPitchSystemPrompt('garfield'), /exactly three genuinely different interpretations/);
  assert.match(buildEditorSystemPrompt('garfield'), /Judge by: how complete and committed/);
  assert.match(buildPitchUserPrompt({ sourceBrief: BRIEF }), /tsundere/);
  assert.match(buildPitchUserPrompt({ sourceBrief: BRIEF }), /rewritten jokeAnchors/);
  assert.match(buildEditorSystemPrompt('garfield'), /any change to a jokeAnchor/);
});

test('planning prompts warn about the image safety filter for people who could read as young', () => {
  for (const prompt of [buildPitchSystemPrompt('garfield'), buildEditorSystemPrompt('garfield')]) {
    assert.match(prompt, /strict automated safety filter/);
    assert.match(prompt, /never plan mind control, hypnosis, coercion/);
    assert.match(prompt, /Hybrid features stay on the head, face, and hands/);
  }
});

test('image prompt lists every cast transformation and keeps characters consistent', () => {
  const prompt = buildImageEditPrompt({ variant: 'garfield', plan: PLAN, sourceBrief: BRIEF });
  assert.match(prompt, /the blonde Slytherin girl, all three drawings becomes a Garfield hybrid/);
  assert.match(prompt, /Potter \(addressed\) becomes Jon/);
  assert.match(prompt, /change everywhere that character appears/);
  assert.match(prompt, /replace "YOU'RE WITH A WEASLEY, POTTER\?" with "YOU'RE WITH A DOG, JON\?"/);
  assert.match(prompt, /clean anime cel shading/);
  assert.match(prompt, /Do not add extra characters, props, or food/);
  assert.doesNotMatch(prompt, /Other visual changes/);
});

test('image prompt includes extra edits and added text when planned', () => {
  const prompt = buildImageEditPrompt({
    variant: 'odie',
    plan: {
      ...PLAN,
      edits: [{ target: 'house crest', change: 'snake becomes a dog bone' }],
      textChanges: [{ location: 'bottom margin', original: '', replacement: 'BORK' }],
    },
    sourceBrief: BRIEF,
  });
  assert.match(prompt, /Other visual changes:\n- house crest: snake becomes a dog bone/);
  assert.match(prompt, /add the text "BORK"/);
  assert.match(prompt, /Odie: yellow fur/);
});

test('image prompt leaves text alone when the plan has no text changes', () => {
  const prompt = buildImageEditPrompt({ variant: 'garfield', plan: { ...PLAN, textChanges: [] }, sourceBrief: BRIEF });
  assert.match(prompt, /Leave every existing piece of text exactly as it is/);
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
  // Context-only changes elsewhere, and lines without the anchor, are fine.
  assert.doesNotThrow(() => assertKeepsJokeAnchors(PLAN, ['dated']));
  assert.doesNotThrow(() => assertKeepsJokeAnchors(PLAN, []));
  // Whole-word matching: "outdated" does not satisfy the anchor.
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
