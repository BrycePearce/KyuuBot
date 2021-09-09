import { PromiseResolver } from './../types/PromiseResolver';
import { createWriteStream } from 'fs';
import got from 'got';

export const saveImageToTmp = async (url: string, writePath: string): Promise<PromiseResolver> => {
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

export const isUrlExtensionStatic = (url: string): boolean => {
    return ['jpg', 'jpeg', 'jfif', 'pjpeg', 'pjp'].includes(getFileExtension(url));
};

export const getFileExtension = (url: string): string => { // todo: probably make this a util
    const fileExtension = url.split(/[#?]/)[0].split('.').pop().trim();
    return fileExtension;
};