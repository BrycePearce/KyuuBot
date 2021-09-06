import { Command } from "../../types/Command";
import { Chapter, Manga } from 'mangadex-full-api';
import Jimp from 'jimp';
import { MessageAttachment } from "discord.js";
import ffmpeg, { FfmpegCommand } from 'fluent-ffmpeg';
import got from 'got';
import { createWriteStream } from 'fs';
import path from 'path';
import { imageSize } from 'image-size';


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
    invocations: ['k', 'kyuute', 'kyuuchan', 'kyuu'],
    args: true,
    usage: '[invocation] [chapterNumber]',
    async execute(message, args) {
        const manga = await Manga.getByQuery({ ids: ['5b2c7a03-ca53-43f0-abc8-031c0c136ae6'] }); // todo: save and store this on init, then pass it here so don't have to fetch on every query
        const chapterList = await manga.getFeed({ translatedLanguage: ['en'], offset: Math.max(Number(args[0]) - 5, 0), limit: 25, order: { chapter: 'asc', volume: 'asc' } } as any, false);
        const matchingChapters = chapterList.filter((chapter) => chapter.chapter === args[0]);
        const preferredChapter = await getPreferredChapter(matchingChapters);
        for (const chapter of preferredChapter.pages) {
            const chapterBuffer = await getChapterBufferWithChapterText(preferredChapter.chapter, chapter);
            message.channel.send({ files: [path.normalize('C:/Users/Bryce/Documents/KyuuBot/tmp/xddddddd.gif')] });




            // const attachment = new MessageAttachment(chapterBuffer);
            // message.channel.send(attachment);
            // // message.channel.send({ files: [chapter] });
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

const getChapterBufferWithChapterText = async (chapter: Chapter, chapterUrl: string): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        const textToWrite = `Vol. ${chapter.volume} Ch. ${chapter.chapter}`;
        if (chapterPagesIncludeGif([chapterUrl])) { // todo: probably a better way to do this, instead of setting it in an array & without code dupe
            const writePath = path.normalize(path.join(__dirname, '../../tmp', `${Date.now()}.gif`));

            // const tmpFolder = path.normalize(path.join(__dirname, '/tmp'));

            // download gif from url so we can process (add text) it
            got.stream(chapterUrl).pipe(createWriteStream(writePath)).on('finish', () => {  // todo: make a database and cache all chapters instead of getting them per request
                const { width, height } = imageSize(writePath);
                const gifToMp4 = ffmpeg(writePath).videoFilters(
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
                ).output(path.normalize('C:/Users/Bryce/Documents/KyuuBot/tmp/xd.mp4'));
                gifToMp4.on('end', () => {
                    // ffmpeg -i test.gif -filter_complex 
                    // 'fps=10,scale=100:-1:flags=lanczos,split [o1] [o2];[o1] palettegen [p]; [o2] fifo [o3];[o3] [p] paletteuse' - vf "drawtext=fontfile=OpenSans.ttf:text='Stack Overflow':fontcolor=black:fontsize=24" finalxd.gif
                    const mp4ToGif = ffmpeg(path.normalize('C:/Users/Bryce/Documents/KyuuBot/tmp/xd.mp4')).fpsOutput(10).complexFilter(['fps=10,scale=500:-1:flags=lanczos,split [o1] [o2];[o1] palettegen [p]; [o2] fifo [o3];[o3] [p] paletteuse']).output(path.normalize('C:/Users/Bryce/Documents/KyuuBot/tmp/xddddddd.gif'));
                    mp4ToGif.on('end', () => {
                        resolve(new Buffer('asd'));
                    })
                    mp4ToGif.run();
                });
                gifToMp4.run();
            });
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
