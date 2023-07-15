import { Chapter, Manga } from 'mangadex-full-api';
import { retrieveComix } from '../comixPreloader';
import { ComixError } from '../types/Comix';
import { PromiseResolver } from '../types/PromiseResolver';
import { writeTextOnMedia } from './ffmpeg';
import {
  deleteFileFromTmp,
  getFileExtension,
  getRandomEmotePath,
  getTmpPathWithFilename,
  isUrlExtensionStatic,
  saveImageToTmp,
} from './files';

interface ResolvedChapter {
  chapter: Chapter;
  pages: string[];
}

type SuccessCallback = (pages: string[]) => void;
type FailureCallback = (error: ComixError) => void;

export async function retrieveAndSendComic(
  mangaId: string,
  args: string[],
  onSuccess: SuccessCallback,
  onFailure: FailureCallback,
  onFileCleanup?: (deletedFilePaths: string[]) => void
) {
  let createdEntities: string[] = [];

  try {
    const manga = retrieveComix(mangaId);
    const requestedChapter = await getRequestedChapter(manga, args);
    const chapterList = await manga.getFeed(
      {
        translatedLanguage: ['en'],
        offset: Math.max(Number(requestedChapter) - 5, 0),
        limit: 25,
        order: { chapter: 'asc', volume: 'asc' },
      } as any,
      false
    );
    const matchingChapters = chapterList.filter((chapter) => chapter.chapter === requestedChapter);
    if (matchingChapters.length === 0) {
      onFailure({ message: 'No chapter was found', type: 'chapterNotFound', emotePath: await getRandomEmotePath() });
      return;
    }

    const preferredChapter = await getPreferredChapterPages(matchingChapters);
    const outputFileName = Date.now();

    let filePaths: string[] = [];
    for (const page of preferredChapter.pages) {
      const fileExtension = getFileExtension(page);
      const savedMediaPath = getTmpPathWithFilename(`${outputFileName}.${fileExtension}`);
      const mediaOutputPath = getTmpPathWithFilename(`${outputFileName}-finished.${fileExtension}`);
      createdEntities = [savedMediaPath, mediaOutputPath];

      // get and output processed page
      const { localChapterPath } = await getChapterWithChapterInfo(
        preferredChapter.chapter,
        page,
        savedMediaPath,
        mediaOutputPath
      );
      filePaths.push(localChapterPath);
    }

    onSuccess(filePaths);
  } catch (ex) {
    onFailure({ message: ex['message'] || 'Something went really wrong!', type: 'apiError' });
    return;
  } finally {
    // delete tmp files
    for (const entity of createdEntities) {
      const deletionResult = await deleteFileFromTmp(entity);
      if (!deletionResult.success) {
        console.warn(deletionResult.message);
      }
    }
    if (onFileCleanup) onFileCleanup(createdEntities);
  }
}

async function getRequestedChapter(manga: Manga, args: string[]): Promise<string> {
  if (args[0] && args[0].toLowerCase() !== 'r') return args[0];

  const latestChapter = (
    await manga.getFeed(
      { translatedLanguage: ['en'], limit: 1, order: { chapter: 'desc', volume: 'desc' } } as any,
      false
    )
  )[0].chapter;

  // if there are no arguments then fetch the latest chapter
  if (!args[0]) {
    return latestChapter;
  } else {
    // otherwise they requested a random chapter
    const randomChapter = Math.floor(Math.random() * (Number(latestChapter) - 1 + 1)) + 1;
    return randomChapter.toString();
  }
}

const getChapterWithChapterInfo = async (
  chapter: Chapter,
  pageUrl: string,
  rawMediaPath: string,
  processedMediaPath: string
): Promise<PromiseResolver & { localChapterPath?: string }> => {
  return new Promise(async (resolve, reject) => {
    const textToWrite = `Vol. ${chapter.volume} Ch. ${chapter.chapter}`;

    try {
      // download url so we can process (add text) it
      await saveImageToTmp(pageUrl, rawMediaPath);
      // write text to the saved file, then write the file with changes to processedMediaPath
      await writeTextOnMedia(textToWrite, rawMediaPath, processedMediaPath);
    } catch (ex) {
      // todo: probably a better way to handle this, either with chained catches or typeguard
      let errorMessage = 'There was an error fetching the chapter';
      if (ex instanceof Error) {
        errorMessage = ex.message;
      }
      reject(new Error(errorMessage));
    }

    resolve({ success: true, localChapterPath: processedMediaPath });
  });
};

/**
 * @param chapterList
 * @description Filters duplicate chapters, prefers gif chapters when available.
 */
const getPreferredChapterPages = async (chapters: Chapter[]): Promise<ResolvedChapter> => {
  let preferredChapter: ResolvedChapter;
  for (let i = 0; i < chapters.length; i++) {
    const chapterList = await chapters[i].getReadablePages();
    const doPagesIncludeGif = chapterList.some((page) => !isUrlExtensionStatic(page));
    if (doPagesIncludeGif) {
      preferredChapter = { chapter: chapters[i], pages: chapterList };
      break;
    }
    preferredChapter = { chapter: chapters[i], pages: chapterList };
  }
  return preferredChapter;
};

export const isValidChapterArgs = (args: string[]): boolean => {
  if (!args[0]) return true;
  // accepts a string integer, or the letter r case insenitive
  return new RegExp('^[0-9]+$', 'i').test(args[0]) || args[0].trim().toLowerCase() === 'r';
};
