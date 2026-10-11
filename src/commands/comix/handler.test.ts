import assert from 'node:assert/strict';
import test from 'node:test';
import type { Message, MessageCreateOptions } from 'discord.js';
import { ComicError } from '../../utils/chapterUtils';
import { createComicHandler } from './handler';
import kyuu from './kyuuChan/command';
import tiger from './whiteTigerBlackTiger/command';

const pages = [
  { data: Buffer.from('animated image'), name: 'chapter-1-page-1.gif' },
  { data: Buffer.from('static image'), name: 'chapter-1-page-2.png' },
];

function mockMessage(send: (options: MessageCreateOptions) => Promise<unknown>, sendable = true): Message {
  return { channel: { isSendable: () => sendable, send } } as unknown as Message;
}

test('chapter uploads are awaited and keep their original buffer, name, and order', async () => {
  const received: MessageCreateOptions[] = [];
  let releaseFirst: () => void;
  const firstUpload = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let markStarted: () => void;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const execute = createComicHandler('manga-id', 'Kyuu', {
    retrieve: async (id, args) => {
      assert.equal(id, 'manga-id');
      assert.deepEqual(args, ['1']);
      return pages;
    },
  });
  const running = execute(
    mockMessage(async (options) => {
      received.push(options);
      if (received.length === 1) {
        markStarted();
        await firstUpload;
      }
    }),
    ['1']
  );
  await started;
  assert.equal(received.length, 1, 'page two must wait for page one');
  releaseFirst();
  await running;
  assert.deepEqual(
    received,
    pages.map((page) => ({ files: [{ attachment: page.data, name: page.name }] }))
  );
});

test('all retrieval failures send a Kyuu image and only safe error details', async () => {
  for (const error of [
    new ComicError('Choose a chapter number or r for random.'),
    new ComicError('No chapter was found.'),
    new Error('download failed: internal URL and credentials'),
    new Error('native image processing failed'),
  ]) {
    const received: MessageCreateOptions[] = [];
    const logged: unknown[] = [];
    const execute = createComicHandler('manga-id', 'Kyuu', {
      retrieve: async () => {
        throw error;
      },
      getEmotePath: async () => 'kyuu-error.png',
      logError: (_message, cause) => {
        logged.push(cause);
      },
    });
    await execute(
      mockMessage(async (options) => {
        received.push(options);
      }),
      []
    );
    assert.equal(received.length, 1);
    assert.deepEqual(received[0].files, ['kyuu-error.png']);
    assert.deepEqual(received[0].allowedMentions, { parse: [] });
    assert.match(received[0].content!, /^Kyuu chapter error:/);
    if (error instanceof ComicError) assert.ok(received[0].content!.includes(error.message));
    else assert.ok(!received[0].content!.includes(error.message));
    assert.equal(logged[0], error);
  }
});

test('failed uploads stop delivery and report partial chapter delivery with a Kyuu image', async () => {
  const received: MessageCreateOptions[] = [];
  const uploadError = new Error('Discord upload failed');
  const logged: unknown[] = [];
  const execute = createComicHandler('manga-id', 'White Tiger and Black Tiger', {
    retrieve: async () => [...pages, { ...pages[0], name: 'page-3.gif' }],
    getEmotePath: async () => 'kyuu-error.png',
    logError: (_message, error) => {
      logged.push(error);
    },
  });
  await execute(
    mockMessage(async (options) => {
      received.push(options);
      if (received.length === 2) throw uploadError;
    }),
    []
  );
  assert.equal(received.length, 3);
  assert.match(received[2].content!, /couldn't upload.*Sent 1 of 3 pages/);
  assert.deepEqual(received[2].files, ['kyuu-error.png']);
  assert.deepEqual(logged, [uploadError]);
});

test('missing error emotes fall back to a text response', async () => {
  const received: MessageCreateOptions[] = [];
  const logged: unknown[] = [];
  const execute = createComicHandler('manga-id', 'Kyuu', {
    retrieve: async () => {
      throw new ComicError('No chapter was found.');
    },
    getEmotePath: async () => {
      throw new Error('missing emote folder');
    },
    logError: (_message, error) => {
      logged.push(error);
    },
  });
  await execute(
    mockMessage(async (options) => {
      received.push(options);
    }),
    []
  );
  assert.equal(received.length, 1);
  assert.equal(received[0].files, undefined);
  assert.match(received[0].content!, /No chapter was found/);
  assert.equal(logged.length, 2);
});

test('error attachment failures retry as text and never reject when Discord remains unavailable', async () => {
  const received: MessageCreateOptions[] = [];
  const logged: unknown[] = [];
  const execute = createComicHandler('manga-id', 'Kyuu', {
    retrieve: async () => {
      throw new Error('MangaDex unavailable');
    },
    getEmotePath: async () => 'kyuu-error.png',
    logError: (_message, error) => {
      logged.push(error);
    },
  });
  await assert.doesNotReject(() =>
    execute(
      mockMessage(async (options) => {
        received.push(options);
        throw new Error('Discord unavailable');
      }),
      []
    )
  );
  assert.equal(received.length, 2);
  assert.deepEqual(received[0].files, ['kyuu-error.png']);
  assert.equal(received[1].files, undefined);
  assert.equal(logged.length, 3);
});

test('non-sendable channels do not retrieve a chapter', async () => {
  const execute = createComicHandler('manga-id', 'Kyuu', {
    retrieve: async () => {
      assert.fail('must not retrieve');
    },
  });
  await execute(
    mockMessage(async () => {
      assert.fail('must not send');
    }, false),
    []
  );
});

test('commands preserve all existing invocation aliases', () => {
  assert.deepEqual(kyuu.invocations, ['k', 'kyute', 'kyuute', 'kyuuchan', 'kyuu']);
  assert.deepEqual(tiger.invocations, ['btwt', 'tigercomic', 'tiger', 'blacktigerandwhitetiger', 'bw', 'tigers', 'b']);
});

test('both handlers share the retrieval limit and failures release capacity without queuing busy requests', async () => {
  let rejectFirst: (error: Error) => void;
  let releaseSecond: (value: typeof pages) => void;
  const first = new Promise<typeof pages>((_resolve, reject) => {
    rejectFirst = reject;
  });
  const second = new Promise<typeof pages>((resolve) => {
    releaseSecond = resolve;
  });
  let retrievals = 0;
  const dependencies = {
    retrieve: async () => {
      retrievals += 1;
      if (retrievals === 1) return first;
      if (retrievals === 2) return second;
      return pages;
    },
    getEmotePath: async () => 'kyuu-error.png',
    logError: () => {},
  };
  const kyuuHandler = createComicHandler('kyuu', 'Kyuu', dependencies);
  const tigerHandler = createComicHandler('tiger', 'Tiger', dependencies);
  const firstRun = kyuuHandler(
    mockMessage(async () => {}),
    []
  );
  const secondRun = tigerHandler(
    mockMessage(async () => {}),
    []
  );
  try {
    const busyResponses: MessageCreateOptions[] = [];
    await tigerHandler(
      mockMessage(async (options) => {
        busyResponses.push(options);
      }),
      []
    );
    assert.equal(retrievals, 2, 'busy requests must not enter the retrieval pipeline');
    assert.equal(busyResponses.length, 1);
    assert.match(busyResponses[0].content!, /preparing other chapters/);
    assert.deepEqual(busyResponses[0].files, ['kyuu-error.png']);

    rejectFirst(new Error('download failed'));
    await firstRun;
    const retryResponses: MessageCreateOptions[] = [];
    await kyuuHandler(
      mockMessage(async (options) => {
        retryResponses.push(options);
      }),
      []
    );
    assert.equal(retrievals, 3, 'a failed retrieval must release its slot');
    assert.equal(retryResponses.length, pages.length);
    assert.equal(retryResponses[0].content, undefined);
  } finally {
    rejectFirst(new Error('test cleanup'));
    releaseSecond(pages);
    await Promise.all([firstRun, secondRun]);
  }
});

test('slow Discord uploads retain capacity and completed uploads release it', async () => {
  let releaseUploads: () => void;
  const uploads = new Promise<void>((resolve) => {
    releaseUploads = resolve;
  });
  let reportUploadsStarted: () => void;
  const uploadsStarted = new Promise<void>((resolve) => {
    reportUploadsStarted = resolve;
  });
  let pendingUploads = 0;
  const slowChannel = mockMessage(async () => {
    pendingUploads += 1;
    if (pendingUploads === 2) reportUploadsStarted();
    await uploads;
  });
  let retrievals = 0;
  const execute = createComicHandler('kyuu', 'Kyuu', {
    retrieve: async () => {
      retrievals += 1;
      return [pages[0]];
    },
    getEmotePath: async () => 'kyuu-error.png',
    logError: () => {},
  });
  const first = execute(slowChannel, []);
  const second = execute(slowChannel, []);
  try {
    await uploadsStarted;
    const received: MessageCreateOptions[] = [];
    await execute(
      mockMessage(async (options) => {
        received.push(options);
      }),
      []
    );
    assert.equal(retrievals, 2, 'buffered chapters must remain bounded while uploads stall');
    assert.equal(received.length, 1);
    assert.match(received[0].content!, /preparing other chapters/);
    assert.deepEqual(received[0].files, ['kyuu-error.png']);
    await execute(
      mockMessage(async () => {}),
      []
    );
    assert.equal(retrievals, 2, "busy responses must not release another request's permit");
  } finally {
    releaseUploads();
    await Promise.all([first, second]);
  }
  const received: MessageCreateOptions[] = [];
  await execute(
    mockMessage(async (options) => {
      received.push(options);
    }),
    []
  );
  assert.equal(retrievals, 3);
  assert.equal(received[0].content, undefined);
});

test('upload and error-reporting failures release their request permits', async () => {
  let retrievals = 0;
  const execute = createComicHandler('kyuu', 'Kyuu', {
    retrieve: async () => {
      retrievals += 1;
      return [pages[0]];
    },
    getEmotePath: async () => 'kyuu-error.png',
    logError: () => {},
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await assert.doesNotReject(() =>
      execute(
        mockMessage(async () => {
          throw new Error('Discord unavailable');
        }),
        []
      )
    );
  }
  assert.equal(retrievals, 3, 'every failed delivery must release capacity even if reporting fails');
});
