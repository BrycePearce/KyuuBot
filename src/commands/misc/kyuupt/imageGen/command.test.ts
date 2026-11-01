import assert from 'node:assert/strict';
import test from 'node:test';
import type { Message } from 'discord.js';
import { Images } from 'openai/resources/images';

test('image generation uses reply text and optional instructions', async (t) => {
  const originalKey = process.env.gptImageGen;
  process.env.gptImageGen = 'test-key';
  const { default: command } = await import('./command');
  if (originalKey === undefined) delete process.env.gptImageGen;
  else process.env.gptImageGen = originalKey;

  const cases = [
    { text: 'A cat sailing among the stars', args: [], expected: 'A cat sailing among the stars' },
    {
      text: 'A cat sailing among the stars',
      args: ['in', 'watercolor'],
      expected: 'Source text:\nA cat sailing among the stars\n\nImage instructions:\nin watercolor',
    },
    { text: undefined, args: ['A', 'forest'], expected: 'A forest' },
    { text: undefined, args: [], expected: undefined },
  ];

  for (const scenario of cases) {
    await t.test(JSON.stringify(scenario), async (t) => {
      const requests: any[] = [];
      const sent: any[] = [];
      t.mock.method(Images.prototype, 'generate', async (request) => {
        requests.push(request);
        return { data: [{ b64_json: Buffer.from('test-image').toString('base64') }] };
      });
      const message = {
        content: '.i',
        attachments: new Map(),
        embeds: [],
        reference: scenario.text ? { messageId: 'source' } : null,
        fetchReference: async () => ({ content: scenario.text, attachments: new Map(), embeds: [] }),
        channel: {
          isSendable: () => true,
          send: async (payload: any) => {
            sent.push(payload);
          },
        },
      } as unknown as Message;

      await command.execute(message, scenario.args);
      assert.equal(sent.length, 1);
      if (scenario.expected) {
        assert.equal(requests.length, 1);
        assert.equal(requests[0].prompt, scenario.expected);
        assert.equal(sent[0].files.length, 1);
      } else {
        assert.equal(requests.length, 0);
        assert.match(sent[0], /provide a prompt/);
      }
    });
  }
});
