import assert from 'node:assert/strict';
import test from 'node:test';
import OpenAI from 'openai';
import { CHAT_MODELS } from '../../../../utils/chatModels';
import { buildContentArray } from './buildContentArray';
import { ChatResponseError, readChatError, requestChatAnswer } from './request';

function clientWithResponse(choice: Record<string, unknown>, inspect?: (request: Record<string, any>) => void) {
  return new OpenAI({
    apiKey: 'test-key',
    maxRetries: 0,
    fetch: async (_url, options) => {
      inspect?.(JSON.parse(options.body as string));
      return new Response(
        JSON.stringify({
          id: 'test',
          object: 'chat.completion',
          created: 1,
          model: CHAT_MODELS.openai,
          choices: [choice],
        }),
        {
          headers: { 'content-type': 'application/json' },
        }
      );
    },
  });
}

test('OpenAI SDK sends multimodal context with a valid reasoning budget and reads the visible answer', async () => {
  const content = buildContentArray('What is in this picture?', ['https://example.com/image.png']);
  const client = clientWithResponse(
    { index: 0, finish_reason: 'stop', message: { role: 'assistant', content: ' A cat. ' } },
    (request) => {
      assert.equal(request.model, CHAT_MODELS.openai);
      assert.equal(request.reasoning_effort, 'high');
      assert.ok(request.max_completion_tokens >= 16000);
      assert.equal(request.temperature, undefined);
      assert.deepEqual(request.messages[1].content, content);
    }
  );
  assert.equal(await requestChatAnswer(client, content), 'A cat.');
});

test('a reasoning budget exhaustion is reported instead of sending a partial answer', async () => {
  const client = clientWithResponse({
    index: 0,
    finish_reason: 'length',
    message: { role: 'assistant', content: 'partial' },
  });
  await assert.rejects(requestChatAnswer(client, buildContentArray('Question', [])), ChatResponseError);
});

test('provider refusals are surfaced and empty outputs are handled explicitly', async () => {
  const refusal = clientWithResponse({
    index: 0,
    finish_reason: 'stop',
    message: { role: 'assistant', content: null, refusal: 'I cannot help with that.' },
  });
  assert.equal(await requestChatAnswer(refusal, buildContentArray('Question', [])), 'I cannot help with that.');
  const empty = clientWithResponse({ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: '' } });
  await assert.rejects(requestChatAnswer(empty, buildContentArray('Question', [])), /did not get an answer/);
});

test('provider errors never expose private details in the chat reply', () => {
  const error = new OpenAI.APIError(401, { detail: 'private token and request' }, 'private token', new Headers());
  assert.doesNotMatch(readChatError(error), /private|token/);
  assert.match(readChatError(new OpenAI.APIConnectionTimeoutError()), /too long/);
  assert.match(readChatError(new OpenAI.APIError(429, undefined, 'private', new Headers())), /usage limit/);
});
