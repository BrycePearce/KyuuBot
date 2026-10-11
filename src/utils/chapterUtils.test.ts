import assert from 'node:assert/strict';
import test from 'node:test';
import { Chapter } from 'mangadex-full-api';
import { ComicDependencies, ComicError, createComicRetriever, isValidChapterArgs, retrieveComic } from './chapterUtils';
import { ResponseSizeError } from './http';

const chapter = (number: string, pages = ['image'], volume: string = '2') => ({
  id: `chapter-${number}`,
  chapter: number,
  volume,
  getReadablePages: async () => pages,
});
const dependencies = (overrides: Partial<ComicDependencies> = {}): ComicDependencies => ({
  latest: async () => [chapter('12.5')],
  aggregate: async () => ({}),
  search: async (_id, number) => [chapter(number)],
  download: async (url) => Buffer.from(url),
  inspect: async (data) => ({ animated: data.toString() === 'animated' }),
  annotate: async (data) => ({ data, extension: 'png', animated: false }),
  random: () => 0,
  ...overrides,
});

test('arguments accept decimal chapters and reject extras or malformed numbers', () => {
  for (const args of [[], ['1'], ['0'], ['12.5'], ['R'], [' r ']]) assert.equal(isValidChapterArgs(args), true);
  for (const args of [[''], ['-1'], ['Infinity'], ['1e2'], ['1', '2'], ['rubbish']])
    assert.equal(isValidChapterArgs(args), false);
});

test('exact chapter request does not depend on chapter count or feed offsets', async () => {
  let requested: string;
  await createComicRetriever(
    dependencies({
      latest: async () => {
        throw new Error('unexpected latest lookup');
      },
      search: async (id, number) => {
        assert.equal(id, 'manga');
        requested = number;
        return [chapter(number)];
      },
    })
  )('manga', ['127.5']);
  assert.equal(requested, '127.5');
});

test('latest resolves duplicate releases for the latest existing number', async () => {
  let requested: string;
  await createComicRetriever(
    dependencies({
      search: async (_id, number) => {
        requested = number;
        return [chapter(number)];
      },
    })
  )('manga', []);
  assert.equal(requested, '12.5');
});

test('random samples unique existing chapters, including gaps and decimals', async () => {
  let requested: string;
  await createComicRetriever(
    dependencies({
      aggregate: async () => ({
        '1': {
          volume: '1',
          count: 3,
          chapters: {
            a: { chapter: '1', id: 'a', others: ['b'], count: 2 },
            c: { chapter: '8.5', id: 'c', others: [], count: 1 },
          },
        },
        '2': { volume: '2', count: 1, chapters: { d: { chapter: '1', id: 'd', others: [], count: 1 } } },
      }),
      random: () => 0.75,
      search: async (_id, number) => {
        requested = number;
        return [chapter(number)];
      },
    })
  )('manga', ['r']);
  assert.equal(requested, '8.5');
});

test('actual animation takes preference over misleading URL extensions', async () => {
  const labels: string[] = [];
  const result = await createComicRetriever(
    dependencies({
      search: async () => [chapter('1', ['static.gif']), chapter('1', ['animated', 'second'], '3')],
      annotate: async (data, label) => {
        labels.push(label);
        return {
          data,
          extension: data.toString() === 'animated' ? 'gif' : 'png',
          animated: data.toString() === 'animated',
        };
      },
    })
  )('manga', ['1']);
  assert.deepEqual(
    result.map((page) => page.name),
    ['comic-1.gif', 'comic-2.png']
  );
  assert.deepEqual(
    result.map((page) => page.data.toString()),
    ['animated', 'second']
  );
  assert.deepEqual(labels, ['Vol. 3 Ch. 1', 'Vol. 3 Ch. 1']);
});

test('empty manga, missing chapter and releases without pages have safe errors', async () => {
  for (const [args, overrides] of [
    [[], { latest: async () => [] }],
    [['r'], {}],
    [['1'], { search: async () => [] }],
    [['1'], { search: async () => [chapter('1', [])] }],
  ] as [string[], Partial<ComicDependencies>][]) {
    await assert.rejects(
      createComicRetriever(dependencies(overrides))('manga', args),
      (error: ComicError) => error.code === 'chapterNotFound'
    );
  }
});

test('download and annotated attachment bounds become safe user errors', async (context) => {
  context.mock.method(console, 'warn', () => {});
  for (const overrides of [
    {
      download: async () => {
        throw new ResponseSizeError(1);
      },
    },
    { annotate: async () => ({ data: Buffer.alloc(11), extension: 'png', animated: false }) },
    { search: async () => [chapter('1', Array(51).fill('image'))] },
  ]) {
    await assert.rejects(
      createComicRetriever(dependencies(overrides))('manga', ['1'], { maxAttachmentBytes: 10 }),
      (error: ComicError) => error.code === 'tooLarge'
    );
  }
});

test('processing failures reject the whole chapter and preserve the original error', async () => {
  const failure = new Error('decoder failed');
  let processed = 0;
  await assert.rejects(
    createComicRetriever(
      dependencies({
        search: async () => [chapter('1', ['one', 'two'])],
        annotate: async (data) => {
          if (++processed === 2) throw failure;
          return { data, extension: 'png', animated: false };
        },
      })
    )('manga', ['1']),
    (error) => error === failure
  );
});

test('leading zeros normalize without losing precision', async () => {
  let requested: string;
  await createComicRetriever(
    dependencies({
      search: async (_id, number) => {
        requested = number;
        return [chapter(number)];
      },
    })
  )('manga', ['001']);
  assert.equal(requested, '1');
});

test('missing volume is marked unknown instead of inventing a volume number', async () => {
  let label: string;
  await createComicRetriever(
    dependencies({
      search: async () => [chapter('1', ['image'], null)],
      annotate: async (data, text) => {
        label = text;
        return { data, extension: 'png', animated: false };
      },
    })
  )('manga', ['1']);
  assert.equal(label, 'Vol. ? Ch. 1');
});

test('simultaneous requests have independent page contents and labels', async () => {
  const retrieve = createComicRetriever(
    dependencies({
      search: async (_id, number) => [chapter(number, [number])],
      annotate: async (data, label) => ({
        data: Buffer.from(`${data.toString()}:${label}`),
        extension: 'png',
        animated: false,
      }),
    })
  );
  const [first, second] = await Promise.all([retrieve('manga', ['1']), retrieve('manga', ['2'])]);
  assert.equal(first[0].data.toString(), '1:Vol. 2 Ch. 1');
  assert.equal(second[0].data.toString(), '2:Vol. 2 Ch. 2');
});

test('total annotated output limit applies across individually valid pages', async () => {
  await assert.rejects(
    createComicRetriever(
      dependencies({
        search: async () => [chapter('1', ['one', 'two'])],
        annotate: async () => ({ data: Buffer.alloc(26 * 1024 * 1024), extension: 'png', animated: false }),
      })
    )('manga', ['1'], { maxAttachmentBytes: 30 * 1024 * 1024 }),
    (error: ComicError) => error.code === 'tooLarge'
  );
});

test('MangaDex adapter paginates exact matches and excludes external-only releases', async (context) => {
  const offsets: number[] = [];
  context.mock.method(Chapter, 'search', async (query) => {
    assert.equal(query.manga, 'manga');
    assert.equal(query.chapter, '7');
    assert.equal(query.includeExternalUrl, 0);
    offsets.push(query.offset);
    return query.offset === 0 ? Array.from({ length: 100 }, () => chapter('7', [])) : [];
  });
  await assert.rejects(retrieveComic('manga', ['7']), (error: ComicError) => error.code === 'chapterNotFound');
  assert.deepEqual(offsets, [0, 100]);
});

test('a failed duplicate release does not discard a readable static chapter', async (context) => {
  const warnings = context.mock.method(console, 'warn', () => {});
  const result = await createComicRetriever(
    dependencies({
      search: async () => [chapter('1', ['good']), chapter('1', ['broken']), chapter('1', Array(51).fill('oversized'))],
      inspect: async (data) => {
        if (data.toString() === 'broken') throw new Error('corrupt image');
        return { animated: false };
      },
    })
  )('manga', ['1']);
  assert.equal(result[0].data.toString(), 'good');
  assert.equal(warnings.mock.callCount(), 2);
});

test('failed first release can fall back to a later readable release', async (context) => {
  context.mock.method(console, 'warn', () => {});
  const result = await createComicRetriever(
    dependencies({
      search: async () => [chapter('1', ['broken']), chapter('1', ['good'])],
      download: async (url) => {
        if (url === 'broken') throw new Error('unavailable image');
        return Buffer.from(url);
      },
    })
  )('manga', ['1']);
  assert.equal(result[0].data.toString(), 'good');
});

test('when all alternatives fail, preserve the first underlying error', async (context) => {
  context.mock.method(console, 'warn', () => {});
  const first = new Error('first release failed');
  await assert.rejects(
    createComicRetriever(
      dependencies({
        search: async () => [chapter('1', ['first']), chapter('1', ['second'])],
        download: async (url) => {
          throw url === 'first' ? first : new Error('second release failed');
        },
      })
    )('manga', ['1']),
    (error) => error === first
  );
});

test('duplicate download budget stops scanning and returns the valid fallback', async (context) => {
  context.mock.method(console, 'warn', () => {});
  let downloaded = 0;
  const result = await createComicRetriever(
    dependencies({
      search: async () => [chapter('1', ['good']), ...Array.from({ length: 10 }, () => chapter('1', ['broken']))],
      download: async (url, options) => {
        downloaded++;
        if (url === 'broken') throw new ResponseSizeError(options.maxBytes);
        return Buffer.from('good');
      },
    })
  )('manga', ['1'], { maxAttachmentBytes: 50 * 1024 * 1024 });
  assert.equal(result[0].data.toString(), 'good');
  assert.equal(downloaded, 3, 'do not download more alternatives after exhausting the shared allowance');
});
