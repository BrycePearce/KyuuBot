import { getFileExtension, isUrlExtensionStatic, saveImageToTmp } from '../../utils/files';
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
    3.) Cleanup tmp files
*/
export const command: Command = {
    name: 'Retrieve Chapter',
    description: 'Returns the the kyuu comic number specified by the user',
    invocations: ['k', 'kyute', 'kyuute', 'kyuuchan', 'kyuu'],
    args: true,
    usage: '[invocation] [chapterNumber]',
    async execute(message, args) {
        const manga = await Manga.getByQuery({ ids: ['5b2c7a03-ca53-43f0-abc8-031c0c136ae6'] }); // todo: save and store this on init, then pass it here so don't have to fetch on every query
        const chapterList = await manga.getFeed({ translatedLanguage: ['en'], offset: Math.max(Number(args[0]) - 5, 0), limit: 25, order: { chapter: 'asc', volume: 'asc' } } as any, false);
        const matchingChapters = chapterList.filter((chapter) => chapter.chapter === args[0]);
        const preferredChapter = await getPreferredChapter(matchingChapters);
        const outputFileName = Date.now();
        for (const chapter of preferredChapter.pages) {
            try {
                const { localChapterPath } = await getChapterWithChapterInfo(preferredChapter.chapter, chapter, outputFileName);
                message.channel.send({ files: [localChapterPath] });
            } catch (ex) {
                console.error(ex)
                message.channel.send(ex['message'] || 'Something went really wrong!');
                return;
            }
        }
    }
};

/**
 * @param chapterList
 * @description Filters duplicate chapters, will prefer gif chapter if available.
 */
const getPreferredChapter = async (chapters: Chapter[]): Promise<ResolvedChapter> => {
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

const getChapterWithChapterInfo = async (chapter: Chapter, chapterUrl: string, outputFileName: number): Promise<PromiseResolver & { localChapterPath?: string }> => {
    return new Promise(async (resolve, reject) => {
        const textToWrite = `Vol. ${chapter.volume} Ch. ${chapter.chapter}`;
        const fileExtension = getFileExtension(chapterUrl);
        const savedImage = getTmpPathWithFilename(`${outputFileName}.${fileExtension}`);
        const mediaOutputPath = getTmpPathWithFilename(`${outputFileName}-finished.${fileExtension}`);

        try {
            // download url so we can process (add text) it
            await saveImageToTmp(chapterUrl, savedImage);

            // write text to the file and write the resulting file to mediaOutputPath
            await writeTextOnMedia(textToWrite, savedImage, mediaOutputPath);
        } catch (ex) { // todo: probably a better way to handle this, either with chained catches or typeguard
            let errorMessage = 'There was an error fetching the chapter';
            if (ex instanceof Error) {
                errorMessage = ex.message;
            }
            reject(new Error(errorMessage));
        }
        resolve({ success: true, localChapterPath: mediaOutputPath });
    });
};

const getTmpPathWithFilename = (filename: string) => {
    return path.normalize(path.join(__dirname, '../../../tmp', filename));
};
