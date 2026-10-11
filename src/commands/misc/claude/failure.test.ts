import assert from 'node:assert/strict';
import test from 'node:test';
import type { MessageCreateOptions } from 'discord.js';
import { sendClaudeFailure } from './failure';

test('Claude errors send their safe message with a Kyuu image', async () => {
  const sent: MessageCreateOptions[] = [];
  await sendClaudeFailure(
    async (options) => {
      sent.push(options);
    },
    'Please try again.',
    {
      getEmotePath: async () => 'kyuu.png',
    }
  );
  assert.deepEqual(sent, [{ content: 'Please try again.', files: ['kyuu.png'], allowedMentions: { parse: [] } }]);
});

test('Claude errors fall back to text when an emote cannot be read', async () => {
  const sent: MessageCreateOptions[] = [];
  const errors: unknown[] = [];
  await sendClaudeFailure(
    async (options) => {
      sent.push(options);
    },
    'Please try again.',
    {
      getEmotePath: async () => {
        throw new Error('missing emote');
      },
      logError: (_message, error) => {
        errors.push(error);
      },
    }
  );
  assert.equal(sent.length, 1);
  assert.equal(sent[0].files, undefined);
  assert.equal(sent[0].content, 'Please try again.');
  assert.equal(errors.length, 1);
});

test('long refusal explanations preserve all text within Discord message limits', async () => {
  const content = 'A long explanation. '.repeat(220);
  const sent: MessageCreateOptions[] = [];
  await sendClaudeFailure(
    async (options) => {
      sent.push(options);
    },
    content,
    {
      getEmotePath: async () => 'kyuu.png',
    }
  );
  assert.equal(sent.map((options) => options.content).join(''), content);
  assert.ok(sent.every((options) => options.content!.length <= 2000));
  assert.deepEqual(sent[0].files, ['kyuu.png']);
  assert.ok(sent.slice(1).every((options) => options.files === undefined));
});

test('Claude errors try text after failed attachment delivery and contain Discord failures', async () => {
  const sent: MessageCreateOptions[] = [];
  const errors: unknown[] = [];
  await assert.doesNotReject(() =>
    sendClaudeFailure(
      async (options) => {
        sent.push(options);
        throw new Error('Discord unavailable');
      },
      'Please try again.',
      {
        getEmotePath: async () => 'kyuu.png',
        logError: (_message, error) => {
          errors.push(error);
        },
      }
    )
  );
  assert.equal(sent.length, 2);
  assert.deepEqual(sent[0].files, ['kyuu.png']);
  assert.equal(sent[1].files, undefined);
  assert.equal(errors.length, 2);
});
