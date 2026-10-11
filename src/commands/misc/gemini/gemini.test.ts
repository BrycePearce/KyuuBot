import assert from 'node:assert/strict';
import test from 'node:test';
import { FinishReason, GenerateContentResponse, type Content, type GenerateContentParameters } from '@google/genai';
import type { Message } from 'discord.js';
import sharp from 'sharp';
import * as files from '../../../utils/files';
import * as replies from '../../../utils/replySource';
import { CHAT_MODELS } from '../../../utils/chatModels';
import command from './command';
import * as gemini from './generate';

function answer(text = 'A visible answer') {
  return Object.assign(new GenerateContentResponse(), {
    candidates: [{ content: { parts: [{ text: 'Private thought', thought: true }, { text }] } }],
  });
}

test('Gemini uses the configured model, a system instruction, and visible response parts', async () => {
  let request: GenerateContentParameters;
  const result = await gemini.generateGeminiAnswer('A user question', [], {
    generateContent: async (value) => {
      request = value;
      return answer();
    },
  });
  assert.equal(result, 'A visible answer');
  assert.equal(request.model, CHAT_MODELS.gemini);
  assert.match(String(request.config.systemInstruction), /80 words/);
  assert.equal(request.config.thinkingConfig.includeThoughts, false);
  assert.equal(request.config.thinkingConfig.thinkingLevel, 'HIGH');
  assert.equal(request.config.maxOutputTokens, 32768);
  assert.deepEqual(request.contents, [{ role: 'user', parts: [{ text: 'A user question' }] }]);
});

test('Gemini detects actual image MIME types and deduplicates URLs', async () => {
  const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: 'white' } })
    .jpeg()
    .toBuffer();
  let downloads = 0;
  await gemini.generateGeminiAnswer(
    'Describe this',
    ['https://example.test/image.png', 'https://example.test/image.png'],
    {
      download: async (_url, options) => {
        downloads++;
        assert.equal(options.maxBytes, 3 * 1024 * 1024);
        assert.equal(options.timeoutMs, 20_000);
        return image;
      },
      generateContent: async (request) => {
        const contents = request.contents as Content[];
        assert.deepEqual(contents[0].parts[1], {
          inlineData: { mimeType: 'image/jpeg', data: image.toString('base64') },
        });
        return answer();
      },
    }
  );
  assert.equal(downloads, 1);
});

test('failed downloads stop before calling Gemini instead of becoming request parts', async () => {
  await assert.rejects(
    gemini.generateGeminiAnswer('Describe this', ['https://example.test/image'], {
      download: async () => {
        throw new Error('Download failed');
      },
      generateContent: async () => {
        assert.fail('Must not call Gemini');
      },
    }),
    /Download failed/
  );
});

test('too many images and unsupported GIF fail before calling Gemini', async () => {
  const neverGenerate = async () => {
    assert.fail('Must not call Gemini');
  };
  await assert.rejects(
    gemini.generateGeminiAnswer(
      'Describe',
      Array.from({ length: 5 }, (_, i) => `https://example.test/${i}`),
      {
        download: async () => {
          assert.fail('Must not download');
        },
        generateContent: neverGenerate,
      }
    ),
    /at most 4/
  );
  const gif = await sharp({ create: { width: 8, height: 8, channels: 3, background: 'white' } })
    .gif()
    .toBuffer();
  await assert.rejects(
    gemini.generateGeminiAnswer('Describe', ['https://example.test/image'], {
      download: async () => gif,
      generateContent: neverGenerate,
    }),
    /PNG, JPEG, or WebP/
  );
});

test('empty or thought-only responses fail cleanly', () => {
  assert.throws(() => gemini.extractGeminiAnswer(new GenerateContentResponse()), /no answer text/);
  assert.throws(() => gemini.extractGeminiAnswer(answer('')), /no answer text/);
});

test('command preserves reply context and attaches answers over the Discord limit', async (t) => {
  const sent: any[] = [];
  let typingCalls = 0;
  t.mock.method(replies, 'extractReplySource', async () => ({
    text: 'Earlier text',
    imageUrls: ['https://example.test/reply'],
  }));
  t.mock.method(gemini, 'generateGeminiAnswer', async (prompt, urls) => {
    assert.match(prompt, /Earlier text/);
    assert.match(prompt, /New question/);
    assert.deepEqual(urls, ['https://example.test/direct', 'https://example.test/reply']);
    return 'x'.repeat(2001);
  });
  const message = {
    attachments: new Map([['1', { url: 'https://example.test/direct', contentType: 'image/png' }]]),
    channel: {
      isSendable: () => true,
      sendTyping: async () => {
        typingCalls++;
      },
      send: async (payload) => {
        sent.push(payload);
      },
    },
  } as unknown as Message;
  await command.execute(message, ['New', 'question']);
  assert.equal(sent.length, 1);
  assert.equal(typingCalls, 1);
  assert.equal(sent[0].files[0].attachment.toString(), 'x'.repeat(2001));
  assert.deepEqual(sent[0].allowedMentions, { parse: [] });
});

test('command errors send a Kyuu image and never expose provider errors', async (t) => {
  const sent: any[] = [];
  const log = t.mock.method(console, 'error', () => {});
  t.mock.method(replies, 'extractReplySource', async () => null);
  t.mock.method(gemini, 'generateGeminiAnswer', async () => {
    throw new Error('secret-provider-debug-info');
  });
  t.mock.method(files, 'getRandomEmotePath', async () => 'kyuu.png');
  const message = {
    attachments: new Map(),
    channel: {
      isSendable: () => true,
      sendTyping: async () => {},
      send: async (payload) => {
        sent.push(payload);
      },
    },
  } as unknown as Message;
  await command.execute(message, ['Hello']);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].files, ['kyuu.png']);
  assert.doesNotMatch(sent[0].content, /secret-provider/);
  assert.equal(log.mock.callCount(), 1);
});

test('empty input is rejected before requesting Gemini', async () => {
  await assert.rejects(
    gemini.generateGeminiAnswer('  ', [], {
      generateContent: async () => {
        assert.fail('Must not call Gemini');
      },
    }),
    /Provide a question or image/
  );
});

test('image-only input has no empty text part', async () => {
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: 'white' } })
    .png()
    .toBuffer();
  await gemini.generateGeminiAnswer(' ', ['https://example.test/image'], {
    download: async () => png,
    generateContent: async (request) => {
      const contents = request.contents as Content[];
      assert.equal(contents[0].parts.length, 1);
      assert.equal(contents[0].parts[0].text, undefined);
      assert.equal(contents[0].parts[0].inlineData.mimeType, 'image/png');
      return answer();
    },
  });
});

test('truncated responses are rejected even when some text is present', () => {
  const response = answer('The incomplete answer starts');
  response.candidates[0].finishReason = FinishReason.MAX_TOKENS;
  assert.throws(() => gemini.extractGeminiAnswer(response), /output limit/);
});

test('typing is refreshed during a long request and stopped after completion', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  let typingCalls = 0;
  t.mock.method(replies, 'extractReplySource', async () => null);
  t.mock.method(gemini, 'generateGeminiAnswer', async () => {
    t.mock.timers.tick(16000);
    return 'Done';
  });
  const message = {
    attachments: new Map(),
    channel: {
      isSendable: () => true,
      sendTyping: async () => {
        typingCalls++;
      },
      send: async () => {},
    },
  } as unknown as Message;
  await command.execute(message, ['Hello']);
  assert.equal(typingCalls, 3);
  t.mock.timers.tick(16000);
  assert.equal(typingCalls, 3, 'no refresh survives command completion');
});

for (const delivery of ['missing-image', 'image-upload-fails', 'all-sends-fail']) {
  test(`command error reporting tolerates ${delivery}`, async (t) => {
    t.mock.method(console, 'error', () => {});
    t.mock.method(console, 'warn', () => {});
    t.mock.method(replies, 'extractReplySource', async () => null);
    t.mock.method(gemini, 'generateGeminiAnswer', async () => {
      throw new Error('provider error');
    });
    t.mock.method(files, 'getRandomEmotePath', async () => {
      if (delivery === 'missing-image') throw new Error('Image unavailable');
      return 'kyuu.png';
    });
    const sent: any[] = [];
    const message = {
      attachments: new Map(),
      channel: {
        isSendable: () => true,
        sendTyping: async () => {},
        send: async (payload) => {
          sent.push(payload);
          if (payload.files || delivery === 'all-sends-fail') throw new Error('Discord unavailable');
        },
      },
    } as unknown as Message;
    await command.execute(message, ['Hello']);
    assert.equal(sent[sent.length - 1].files, undefined, 'last attempt uses text alone');
    assert.equal(sent.length, delivery === 'missing-image' ? 1 : 2);
  });
}
