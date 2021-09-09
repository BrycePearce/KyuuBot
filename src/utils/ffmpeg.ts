import { PromiseResolver } from './../types/PromiseResolver';
import { isUrlExtensionStatic } from './files';
import { imageSize } from 'image-size';
import ffmpeg from 'fluent-ffmpeg';

export const writeTextOnMedia = async (textToWrite: string, mediaInputPath: string, mediaOutputPath: string): Promise<PromiseResolver> => {
    const { width, height } = imageSize(mediaInputPath);
    const gifFilter = [`drawtext=fontfile=OpenSans.ttf:text=${textToWrite}:fontcolor=black:fontsize=10:x=${width - 80}:y=${height - 20},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`];
    const staticFilter = [`drawtext=text=${textToWrite}':fontcolor=black:fontsize=10:x=${width - 80}:y=${height - 20}`];
    const filter = isUrlExtensionStatic(mediaInputPath) ? staticFilter : gifFilter;
    return new Promise((resolve, reject) => {
        const writeTextToMedia = ffmpeg(mediaInputPath);
        writeTextToMedia.complexFilter(filter); // todo: make it correct font
        writeTextToMedia.on('error', () => reject(new Error('Failed to write text to gif')));
        writeTextToMedia.on('end', () => resolve({ success: true }));
        writeTextToMedia.output(mediaOutputPath);
        writeTextToMedia.run();
    });
};