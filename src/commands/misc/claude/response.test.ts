import assert from 'node:assert/strict';
import test from 'node:test';
import Anthropic from '@anthropic-ai/sdk';
import { readClaudeError, readClaudeResponse } from './response';

test('gives actionable replies for API and connection failures without exposing raw errors', () => {
  for (const [status, expected] of [
    [429, /too many requests/],
    [500, /temporarily unavailable/],
    [529, /temporarily unavailable/],
    [400, /shorter question/],
    [413, /shorter question/],
    [401, /couldn’t complete/],
  ] as const) {
    const response = readClaudeError(new Anthropic.APIError(status, undefined, 'private details', undefined));
    assert.match(response, expected);
    assert.doesNotMatch(response, /private details/);
  }
  assert.match(readClaudeError(new Anthropic.APIConnectionTimeoutError()), /too long/);
  assert.match(readClaudeError(new Anthropic.APIConnectionError({})), /couldn’t connect/);
  assert.match(readClaudeError(new Error('local file failure')), /Please try again/);
});

test('reports a refusal with no content instead of an empty response', () => {
  assert.match(readClaudeResponse({ content: [], stop_reason: 'refusal' }), /Claude declined/);
});

test('preserves explanation text returned with a refusal', () => {
  assert.equal(
    readClaudeResponse({
      content: [{ type: 'text', text: 'An explanation.', citations: [] }],
      stop_reason: 'refusal',
    }),
    'An explanation.'
  );
});

test('extracts answer text without posting thinking', () => {
  assert.equal(
    readClaudeResponse({
      content: [
        { type: 'thinking', thinking: 'Internal reasoning', signature: 'signature' },
        { type: 'text', text: ' First paragraph.', citations: [] },
        { type: 'text', text: 'Second paragraph. ', citations: [] },
      ],
      stop_reason: 'end_turn',
    }),
    'First paragraph.\nSecond paragraph.'
  );
});

test('recognizes whitespace and thinking-only responses as empty', () => {
  assert.equal(
    readClaudeResponse({
      content: [
        { type: 'redacted_thinking', data: 'redacted' },
        { type: 'text', text: '   ', citations: [] },
      ],
      stop_reason: 'max_tokens',
    }),
    ''
  );
});
