import assert from 'node:assert/strict';
import test from 'node:test';
import Anthropic from '@anthropic-ai/sdk';
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages';
import { CHAT_MODELS } from '../../../utils/chatModels';
import { buildClaudeRequest, CLAUDE_REQUEST_TIMEOUT_MS } from './request';
import { readClaudeResponse } from './response';

test('Claude requests preserve multimodal context and support adaptive reasoning with concise answers', () => {
  const content: ContentBlockParam[] = [
    { type: 'image', source: { type: 'url', url: 'https://example.com/cat.png' } },
    { type: 'text', text: 'Replied-to message: "A sleepy cat"' },
    { type: 'text', text: 'What is happening?' },
  ];
  const request = buildClaudeRequest(content);
  assert.equal(request.model, CHAT_MODELS.claude);
  assert.deepEqual(request.messages, [{ role: 'user', content }]);
  assert.deepEqual(request.thinking, { type: 'adaptive', display: 'omitted' });
  assert.deepEqual(request.output_config, { effort: 'high' });
  assert.equal(request.max_tokens, 32768);
  assert.match(request.system as string, /80 words or less/);
  for (const unsupported of ['temperature', 'top_p', 'top_k', 'stop_sequences']) {
    assert.equal(unsupported in request, false);
  }
});

test('the SDK serializes the request and only answer text is extracted from its response', async () => {
  let posted: Record<string, unknown> | undefined;
  const client = new Anthropic({
    apiKey: 'offline-test-key',
    maxRetries: 0,
    timeout: CLAUDE_REQUEST_TIMEOUT_MS,
    fetch: async (_url, init) => {
      posted = JSON.parse(init!.body as string);
      return new Response(
        JSON.stringify({
          id: 'msg_test',
          type: 'message',
          role: 'assistant',
          model: CHAT_MODELS.claude,
          content: [
            { type: 'thinking', thinking: '', signature: 'private-signature' },
            { type: 'redacted_thinking', data: 'private-redacted-data' },
            { type: 'text', text: 'The cat is sleeping.', citations: [] },
          ],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 30 },
        }),
        { headers: { 'content-type': 'application/json' } }
      );
    },
  });
  const request = buildClaudeRequest([{ type: 'text', text: 'Describe the cat.' }]);
  const response = await client.messages.create(request);
  assert.deepEqual(posted, request);
  assert.equal(readClaudeResponse(response), 'The cat is sleeping.');
});
