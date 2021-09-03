import { Command } from "../../types/Command";
import { Manga } from 'mangadex-full-api';
import Jimp from 'jimp';
import { GifUtil, GifFrame, GifCodec } from 'gifwrap';
import got from 'got';

import { Message, MessageAttachment } from "discord.js";


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
    usage: '[chapterNumber]',
    async execute(message, args) {
        const manga = await Manga.getByQuery({ ids: ['5b2c7a03-ca53-43f0-abc8-031c0c136ae6'] }); // todo: save and store this on init, then pass it here so don't have to fetch on every query
        const chapterList = await manga.getFeed({ translatedLanguage: ['en'], offset: Math.max(Number(args[0]) - 5, 0), limit: 50, order: { chapter: 'asc', volume: 'asc' } } as any, false);
        const foundChap = chapterList.find((chapter) => chapter.chapter === args[0]);
        const textToWrite = `Vol. ${foundChap.volume} Ch. ${foundChap.chapter}`;
        const chapters = await foundChap.getReadablePages();
        for (const chapter of chapters) {
            const [_, fileExtension] = chapter.split(/\.(?=[^\.]+$)/);
            if (fileExtension.toLowerCase().includes('gif')) {
                getGifFramesWithChapterText(message, chapter, textToWrite);
                return;
            }
            try {
                const loadedChapter = await Jimp.read(chapter);
                const mimeType = loadedChapter.getMIME();
                await writeTextOnJimpImage(loadedChapter, textToWrite);
                const buffer = await loadedChapter.getBufferAsync(mimeType);
                sendBufferAsAttachment(message, buffer);
            } catch (error) {
                console.log('error!', error)
            }
        }
    }
}

const getGifFramesWithChapterText = async (message: Message, chapterUrl: string, chapterText: string) => {
    try {
        const { body: buffer } = await got(chapterUrl, { responseType: 'buffer' });
        const gif = await GifUtil.read(buffer);
        const promises = gif.frames.map(async (frame) => {
            const jimpImage: Jimp = GifUtil.copyAsJimp(Jimp, frame);
            await writeTextOnJimpImage(jimpImage, chapterText);
            return new GifFrame(jimpImage.bitmap, {
                disposalMethod: frame.disposalMethod,
                delayCentisecs: frame.delayCentisecs,
            });
        });

        const frames = await Promise.all(promises);
        GifUtil.quantizeDekker(frames, 1200); // needed for images with over 256 color indexes
        const codec = new GifCodec();
        const updatedGifBuffer = await codec.encodeGif(frames, { loops: 15 });
        sendBufferAsAttachment(message, updatedGifBuffer.buffer)
    } catch (ex) {
        console.log('e... error!?', ex)
    }
}

const writeTextOnJimpImage = async (jimpImage: Jimp, text: string) => {
    const font = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
    jimpImage.print(font, 10, 10, text);
}

const sendBufferAsAttachment = (message: Message, buffer: Buffer) => {
    const attachment = new MessageAttachment(buffer);
    message.channel.send(attachment);
}