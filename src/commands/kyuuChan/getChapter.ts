import { Chapter, Manga } from 'mangadex-full-api';
import { Command } from "../../types/Command";
import { createWriteStream } from 'fs';
import { imageSize } from 'image-size';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import got from 'got';

interface ResolvedChapter {
    chapter: Chapter;
    pages: string[];
};

interface PromiseResolver {
    success: boolean;
    message?: string;
}
/*
    command todos:
    1.) Get specified manga & specified chapter # from argument
    2.) Allow r for random manga & chapter
    3.) Cleanup tmp files
    4.) re-implement static files textwrite with ffmpeg
    5.) Maybe abstract ffmpeg logic to helpers(or utils)/ffmpeg
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
        for (const chapter of preferredChapter.pages) {
            try {
                const { localChapterPath } = await getChapterWithChapterInfo(preferredChapter.chapter, chapter);
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
        if (chapterPagesIncludeGif(chapterList)) {
            preferredChapter = { chapter: chapters[i], pages: chapterList };
            break;
        }
        preferredChapter = { chapter: chapters[i], pages: chapterList };
    }
    return preferredChapter;
};

const chapterPagesIncludeGif = (chapterPages: string[]): boolean => {
    return !!chapterPages.find((chapter) => {
        const fileExtension = chapter.split(/[#?]/)[0].split('.').pop().trim();
        if (fileExtension === 'gif') {
            return true;
        }
    });
};

const getChapterWithChapterInfo = async (chapter: Chapter, chapterUrl: string): Promise<PromiseResolver & { localChapterPath?: string }> => {
    return new Promise(async (resolve, reject) => {
        const textToWrite = `Vol. ${chapter.volume} Ch. ${chapter.chapter}`;

        // handle gifs
        if (chapterPagesIncludeGif([chapterUrl])) { // todo: probably a better way to do this, instead of setting it in an array & without code dupe
            const timestamp = Date.now();
            const savedGifPath = getTmpPathWithFilename(`${timestamp}.gif`);
            const gifWithTextOutputPath = getTmpPathWithFilename(`${timestamp}-finished.gif`);

            try {
                // download gif from url so we can process (add text) it
                await saveImageToTmp(chapterUrl, savedGifPath);

                // write text to the gif and write the resulting file to gifWithTextOutputPath
                await writeTextToGif(textToWrite, savedGifPath, gifWithTextOutputPath);
            }
            catch (ex) { // todo: probably a better way to handle this, either with chained catches or typeguard
                let errorMessage = 'There was an error fetching the chapter';
                if (ex instanceof Error) {
                    errorMessage = ex.message;
                }
                reject(new Error(errorMessage));
            }
            resolve({ success: true, localChapterPath: gifWithTextOutputPath });
        }

        // handle static image types (todo: al oooooooooot of reused code here but I'm tired, cleanup) also not handling errors
        const timestamp = Date.now();
        const savedStaticImagePath = getTmpPathWithFilename(`${timestamp}.png`); // todo: wont always be png, set/get actual filetype
        const staticImageWithTextOutputPath = getTmpPathWithFilename(`${timestamp}-finished.png`);
        await saveImageToTmp(chapterUrl, savedStaticImagePath);
        await writeTextToStaticFiletype(textToWrite, savedStaticImagePath, staticImageWithTextOutputPath);
        resolve({ success: true, localChapterPath: staticImageWithTextOutputPath });
    });
};

const saveImageToTmp = async (url: string, writePath: string): Promise<PromiseResolver> => {
    // todo: make a database and cache all chapters instead of getting them per request
    return new Promise((resolve, reject) => {
        const fetchStream = got.stream(url);

        fetchStream.pipe(createWriteStream(writePath));

        fetchStream.on('error', () => {
            reject(new Error('Failed to download image'));
        });

        fetchStream.on('end', () => {
            resolve({ success: true });
        });
    });
};

const writeTextToGif = async (textToWrite: string, gifInputPath: string, gifOutputPath: string): Promise<PromiseResolver> => {
    const { width, height } = imageSize(gifInputPath);
    return new Promise((resolve, reject) => {
        const writeTextToGif = ffmpeg(gifInputPath);
        writeTextToGif.complexFilter([`drawtext=fontfile=OpenSans.ttf:text=${textToWrite}:fontcolor=black:fontsize=10:x=${width - 80}:y=${height - 20},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`]); // todo: make it correct font
        writeTextToGif.on('error', () => reject(new Error('Failed to write text to gif')));
        writeTextToGif.on('end', () => resolve({ success: true }));
        writeTextToGif.output(gifOutputPath);
        writeTextToGif.run();
    });
};

// todo: de-dupe this code, basically the same function as writeTextToGif
const writeTextToStaticFiletype = async (textToWrite: string, staticFileInputPath: string, staticFileOutputPath: string): Promise<PromiseResolver> => {
    const { width, height } = imageSize(staticFileInputPath);

    return new Promise((resolve, reject) => {
        const writeTextToStaticFile = ffmpeg(staticFileInputPath);
        writeTextToStaticFile.complexFilter([`drawtext=text=${textToWrite}':fontcolor=black:fontsize=10:x=${width - 80}:y=${height - 20}`]); // todo: add font type
        writeTextToStaticFile.on('error', () => reject(new Error('Failed to write text to static file')));
        writeTextToStaticFile.on('end', () => resolve({ success: true }));
        writeTextToStaticFile.output(staticFileOutputPath);
        writeTextToStaticFile.run();
    });
};

const getTmpPathWithFilename = (filename: string) => {
    return path.normalize(path.join(__dirname, '../../../tmp', filename));
};
