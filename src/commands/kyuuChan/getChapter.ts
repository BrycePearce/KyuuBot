import { Chapter, Manga } from 'mangadex-full-api';
import { Command } from "../../types/Command";
import { createWriteStream } from 'fs';
import { imageSize } from 'image-size';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import Jimp from 'jimp';
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
    invocations: ['k', 'kyuute', 'kyuuchan', 'kyuu'],
    args: true,
    usage: '[invocation] [chapterNumber]',
    async execute(message, args) {
        const manga = await Manga.getByQuery({ ids: ['5b2c7a03-ca53-43f0-abc8-031c0c136ae6'] }); // todo: save and store this on init, then pass it here so don't have to fetch on every query
        const chapterList = await manga.getFeed({ translatedLanguage: ['en'], offset: Math.max(Number(args[0]) - 5, 0), limit: 25, order: { chapter: 'asc', volume: 'asc' } } as any, false);
        const matchingChapters = chapterList.filter((chapter) => chapter.chapter === args[0]);
        const preferredChapter = await getPreferredChapter(matchingChapters);
        for (const chapter of preferredChapter.pages) {
            try {
                const { localGifPath } = await getChapterWithChapterInfo(preferredChapter.chapter, chapter);
                message.channel.send({ files: [localGifPath] });
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

const getChapterWithChapterInfo = async (chapter: Chapter, chapterUrl: string): Promise<PromiseResolver & { localGifPath?: string }> => {
    return new Promise(async (resolve, reject) => {
        const textToWrite = `Vol. ${chapter.volume} Ch. ${chapter.chapter}`;
        if (chapterPagesIncludeGif([chapterUrl])) { // todo: probably a better way to do this, instead of setting it in an array & without code dupe
            const timestamp = Date.now();
            const savedGifPath = getTmpPathWithFilename(`${timestamp}.gif`);
            const savedMp4Path = getTmpPathWithFilename(`${timestamp}.mp4`);
            const gifWithTextOutputPath = getTmpPathWithFilename(`${timestamp}-finished.gif`);

            try {
                // download gif from url so we can process (add text) it
                await saveImageToTmp(chapterUrl, savedGifPath);

                // convert gif to mp4 and write vol/chapter text. Then write output to /tmp
                await writeMp4WithTextFromGif(textToWrite, savedGifPath, savedMp4Path);

                // convert back to gif (now with text)
                await writeMp4ToGif(savedMp4Path, gifWithTextOutputPath);
            }
            catch (ex) { // todo: probably a better way to handle this, either with chained catches or typeguard
                let errorMessage = 'There was an error fetching the chapter';
                if (ex instanceof Error) {
                    errorMessage = ex.message;
                }
                reject(new Error(errorMessage));
            }
            resolve({ success: true, localGifPath: gifWithTextOutputPath });
        }
    });

    // const loadedChapter = await Jimp.read(chapterUrl);
    // const mimeType = loadedChapter.getMIME();
    // const font = await Jimp.loadFont(Jimp.FONT_SANS_10_BLACK);
    // const offset = {
    //     width: loadedChapter.getWidth() - 70,
    //     height: loadedChapter.getHeight() - 15
    // };
    // loadedChapter.print(font, offset.width, offset.height, textToWrite);
    // const updatedBuffer = await loadedChapter.getBufferAsync(mimeType);
    // return updatedBuffer;
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

const writeMp4WithTextFromGif = async (textToWrite: string, gifInputPath: string, mp4OutputPath: string): Promise<PromiseResolver> => {
    const { width, height } = imageSize(gifInputPath);
    return new Promise((resolve, reject) => {
        const gifToMp4 = ffmpeg(gifInputPath).videoFilters(
            [{
                filter: 'drawtext',
                options: {
                    fontfile: Jimp.FONT_SANS_10_BLACK, // todo: compare to 'OpenSans.ttf'
                    text: textToWrite,
                    fontsize: 10,
                    fontcolor: 'black',
                    x: width - 80,
                    y: height - 20,
                }
            }]
        );
        gifToMp4.output(mp4OutputPath);
        gifToMp4.on('error', () => reject(new Error('Failed to convert gif to mp4')));
        gifToMp4.on('end', () => {
            resolve({ success: true });
        });
        gifToMp4.run();
    });
};

const writeMp4ToGif = async (mp4InputPath: string, gifOutputPath: string): Promise<PromiseResolver> => {
    return new Promise((resolve, reject) => {
        const mp4ToGif = ffmpeg(path.normalize(mp4InputPath)).fpsOutput(10).complexFilter(['fps=10,scale=500:-1:flags=lanczos,split [o1] [o2];[o1] palettegen [p]; [o2] fifo [o3];[o3] [p] paletteuse']).output(path.normalize(gifOutputPath));
        mp4ToGif.on('error', () => reject(new Error('Failed to convert mp4 to gif')))
        mp4ToGif.on('end', () => {
            resolve({ success: true });
        });
        mp4ToGif.run();
    });
};

const getTmpPathWithFilename = (filename: string) => {
    return path.normalize(path.join(__dirname, '../../../tmp', filename));
};
