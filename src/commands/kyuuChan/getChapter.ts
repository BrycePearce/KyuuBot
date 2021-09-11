import { deleteFilesFromTmp, getFileExtension, getRandomEmotePath, isUrlExtensionStatic, saveImageToTmp } from '../../utils/files';
import { PromiseResolver } from '../../types/PromiseResolver';
import { writeTextOnMedia } from '../../utils/ffmpeg';
import { Chapter, Manga } from 'mangadex-full-api';
import { Command } from "../../types/Command";
import path from 'path';

interface ResolvedChapter {
    chapter: Chapter;
    pages: string[];
};

/*
    command todos:
    1.) Get specified manga & specified chapter # from argument
    2.) Allow r for random manga & chapter
*/
export const command: Command = {
    name: 'Retrieve Chapter',
    description: 'Returns the the kyuu comic number specified by the user',
    invocations: ['k', 'kyute', 'kyuute', 'kyuuchan', 'kyuu'],
    args: true,
    usage: '[invocation] [chapterNumber]',
    async execute(message, args) {
        if (!isValidArgs(args)) return;

        // todo: error handling for this block
        const manga = await Manga.getByQuery({ ids: ['5b2c7a03-ca53-43f0-abc8-031c0c136ae6'] }); // todo: save and store this on init, then pass it here so don't have to fetch on every query
        const requestedChapter = await getRequestedChapter(manga, args);
        const chapterList = await manga.getFeed({ translatedLanguage: ['en'], offset: Math.max(Number(requestedChapter) - 5, 0), limit: 25, order: { chapter: 'asc', volume: 'asc' } } as any, false);
        const matchingChapters = chapterList.filter((chapter) => chapter.chapter === requestedChapter);

        if (matchingChapters.length === 0) {
            message.channel.send('No chapter was found', { files: [await getRandomEmotePath()] });
            return;
        }

        const preferredChapter = await getPreferredChapterPages(matchingChapters);
        const outputFileName = Date.now();
        for (const page of preferredChapter.pages) {
            // create paths to save the media (page) for processing
            const fileExtension = getFileExtension(page);
            const savedMediaPath = getTmpPathWithFilename(`${outputFileName}.${fileExtension}`);
            const mediaOutputPath = getTmpPathWithFilename(`${outputFileName}-finished.${fileExtension}`);

            // get and output processed page
            try {
                const { localChapterPath } = await getChapterWithChapterInfo(preferredChapter.chapter, page, savedMediaPath, mediaOutputPath);
                await message.channel.send({ files: [localChapterPath] });
            } catch (ex) {
                console.error(ex)
                message.channel.send(ex['message'] || 'Something went really wrong!');
                return;
            } finally {
                deleteFilesFromTmp([savedMediaPath, mediaOutputPath]);
            }
        }
    }
};

async function getRequestedChapter(manga: Manga, args: string[]): Promise<string> {
    if (args[0] && args[0].toLowerCase() !== 'r') return args[0];

    const latestChapter = (await manga.getFeed({ translatedLanguage: ['en'], limit: 1, order: { chapter: 'desc', volume: 'desc' } } as any, false))[0].chapter;

    // if there are no arguments then fetch the latest chapter
    if (!args[0]) {
        return latestChapter;
    } else { // otherwise they requested a random chapter
        const randomChapter = Math.floor(Math.random() * (Number(latestChapter) - 1 + 1)) + 1;
        return randomChapter.toString();
    }
};

const isValidArgs = (args: string[]): boolean => {
    if (!args[0]) return true;
    // accepts a string integer, or the letter r case insenitive
    return new RegExp('^[0-9]+$', 'i').test(args[0]) || args[0].trim().toLowerCase() === 'r';
};

/**
 * @param chapterList
 * @description Filters duplicate chapters, prefers gif chapters when available.
 */
const getPreferredChapterPages = async (chapters: Chapter[]): Promise<ResolvedChapter> => {
    let preferredChapter: ResolvedChapter;
    for (let i = 0; i < chapters.length; i++) {
        const chapterList = await chapters[i].getReadablePages();
        const doPagesIncludeGif = chapterList.some(page => !isUrlExtensionStatic(page));
        if (doPagesIncludeGif) {
            preferredChapter = { chapter: chapters[i], pages: chapterList };
            break;
        }
        preferredChapter = { chapter: chapters[i], pages: chapterList };
    }
    return preferredChapter;
};

const getChapterWithChapterInfo = async (chapter: Chapter, pageUrl: string, rawMediaPath: string, processedMediaPath: string): Promise<PromiseResolver & { localChapterPath?: string }> => {
    return new Promise(async (resolve, reject) => {
        const textToWrite = `Vol. ${chapter.volume} Ch. ${chapter.chapter}`;

        try {
            // download url so we can process (add text) it
            await saveImageToTmp(pageUrl, rawMediaPath);

            // write text to the saved file, then write the file with changes to processedMediaPath
            await writeTextOnMedia(textToWrite, rawMediaPath, processedMediaPath);
        } catch (ex) { // todo: probably a better way to handle this, either with chained catches or typeguard
            let errorMessage = 'There was an error fetching the chapter';
            if (ex instanceof Error) {
                errorMessage = ex.message;
            }
            reject(new Error(errorMessage));
        }

        resolve({ success: true, localChapterPath: processedMediaPath });
    });
};

const getTmpPathWithFilename = (filename: string) => {
    return path.normalize(path.join(__dirname, '../../../tmp', filename));
};
