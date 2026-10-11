import { Chapter, Manga } from 'mangadex-full-api';
import { withMangadexSession } from './clients/mangadexClient';
import { annotateComicPage, inspectComicMedia } from './comicMedia';
import { fetchBuffer, ResponseSizeError } from './http';

const MiB = 1024 * 1024;
const MAX_CHAPTER_BYTES = 50 * MiB;
const MAX_PAGES = 50;

export class ComicError extends Error {
  constructor(
    message: string,
    public readonly code: 'invalidArguments' | 'chapterNotFound' | 'tooLarge' | 'busy' = 'chapterNotFound'
  ) {
    super(message);
    this.name = 'ComicError';
  }
}

export interface ComicPage {
  data: Buffer;
  name: string;
}
export interface ComicOptions {
  maxAttachmentBytes?: number;
}
type ComicChapter = Pick<Chapter, 'id' | 'chapter' | 'volume' | 'getReadablePages'>;
type Aggregate = Awaited<ReturnType<typeof Manga.getAggregate>>;

export interface ComicDependencies {
  latest: (mangaId: string) => Promise<ComicChapter[]>;
  aggregate: (mangaId: string) => Promise<Aggregate>;
  search: (mangaId: string, chapter: string) => Promise<ComicChapter[]>;
  download: typeof fetchBuffer;
  inspect: (data: Buffer) => Promise<{ animated: boolean }>;
  annotate: typeof annotateComicPage;
  random: () => number;
}

export const isValidChapterArgs = (args: string[]): boolean =>
  args.length === 0 || (args.length === 1 && /^(?:\d+(?:\.\d+)?|r)$/i.test(args[0].trim()));
const notFound = () => new ComicError('No chapter was found.', 'chapterNotFound');
const tooLarge = () => new ComicError('That chapter is too large to upload. Please try another chapter.', 'tooLarge');

/** Prepare every page before uploading so processing failures never send a partial comic. */
export function createComicRetriever(dependencies: ComicDependencies) {
  return async (mangaId: string, args: string[], options: ComicOptions = {}): Promise<ComicPage[]> => {
    if (!isValidChapterArgs(args)) {
      throw new ComicError(
        'Choose a chapter number, r for random, or no argument for the latest chapter.',
        'invalidArguments'
      );
    }
    const maxAttachmentBytes = options.maxAttachmentBytes ?? 10 * MiB;
    if (!Number.isFinite(maxAttachmentBytes) || maxAttachmentBytes <= 0) throw tooLarge();
    let requested = args[0]?.trim().replace(/^0+(?=\d)/, '');
    if (!requested) {
      requested = (await dependencies.latest(mangaId))[0]?.chapter;
    } else if (requested.toLowerCase() === 'r') {
      const aggregate = await dependencies.aggregate(mangaId);
      // Sample numbers, not releases, so duplicate translations do not bias random selection.
      const numbers = [
        ...new Set(
          Object.values(aggregate).flatMap((volume) => Object.values(volume.chapters).map((chapter) => chapter.chapter))
        ),
      ].filter((chapter) => /^\d+(?:\.\d+)?$/.test(chapter));
      requested = numbers[Math.floor(dependencies.random() * numbers.length)];
    }
    if (!requested) throw notFound();
    const chapters = await dependencies.search(mangaId, requested);
    let selected: { chapter: ComicChapter; pages: Buffer[] } | undefined;
    let downloadedBytes = 0;
    let firstReleaseError: unknown;
    for (const chapter of chapters) {
      if (downloadedBytes >= 2 * MAX_CHAPTER_BYTES) break;
      try {
        const urls = await withMangadexSession(() => chapter.getReadablePages());
        if (urls.length === 0) continue;
        if (urls.length > MAX_PAGES) throw tooLarge();
        const pages: Buffer[] = [];
        let animated = false;
        let chapterBytes = 0;
        for (const url of urls) {
          if (chapterBytes >= MAX_CHAPTER_BYTES || downloadedBytes >= 2 * MAX_CHAPTER_BYTES) throw tooLarge();
          const maxBytes = Math.min(
            maxAttachmentBytes,
            MAX_CHAPTER_BYTES - chapterBytes,
            2 * MAX_CHAPTER_BYTES - downloadedBytes
          );
          let data: Buffer;
          try {
            data = await dependencies.download(url, { maxBytes });
          } catch (error) {
            // Reserve the allowance for failed downloads too: repeated broken
            // alternatives must not bypass the total request budget.
            downloadedBytes += maxBytes;
            if (error instanceof ResponseSizeError) throw tooLarge();
            throw error;
          }
          chapterBytes += data.length;
          downloadedBytes += data.length;
          if (chapterBytes > MAX_CHAPTER_BYTES || downloadedBytes > 2 * MAX_CHAPTER_BYTES) throw tooLarge();
          animated = (await dependencies.inspect(data)).animated || animated;
          pages.push(data);
        }
        if (!selected || animated) selected = { chapter, pages };
        if (animated) break;
      } catch (error) {
        firstReleaseError ??= error;
        console.warn(`Skipping unreadable MangaDex release ${chapter.id}:`, error);
      }
    }
    if (!selected) throw firstReleaseError ?? notFound();
    const label = `Vol. ${selected.chapter.volume ?? '?'} Ch. ${selected.chapter.chapter ?? requested}`;
    const result: ComicPage[] = [];
    let outputBytes = 0;
    for (const [index, page] of selected.pages.entries()) {
      const { data, extension } = await dependencies.annotate(page, label);
      outputBytes += data.length;
      if (data.length > maxAttachmentBytes || outputBytes > MAX_CHAPTER_BYTES) throw tooLarge();
      result.push({ data, name: `comic-${index + 1}.${extension}` });
    }
    return result;
  };
}

export const retrieveComic = createComicRetriever({
  latest: (mangaId) =>
    withMangadexSession(() =>
      Manga.getFeed(mangaId, {
        translatedLanguage: ['en'],
        includeExternalUrl: 0,
        limit: 1,
        order: { chapter: 'desc', volume: 'desc' },
      })
    ),
  aggregate: (mangaId) => withMangadexSession(() => Manga.getAggregate(mangaId, undefined, ['en'])),
  search: (mangaId, chapter) =>
    withMangadexSession(async () => {
      const chapters: Chapter[] = [];
      // Offsets paginate exact matches, never assume that a chapter number is a feed offset.
      for (let offset = 0; offset < 10000; offset += 100) {
        const batch = await Chapter.search({
          manga: mangaId,
          chapter,
          translatedLanguage: ['en'],
          includeExternalUrl: 0,
          limit: 100,
          offset,
          order: { publishAt: 'desc' },
        });
        chapters.push(...batch);
        if (batch.length < 100) return chapters;
      }
      throw tooLarge();
    }),
  download: fetchBuffer,
  inspect: inspectComicMedia,
  annotate: annotateComicPage,
  random: Math.random,
});
