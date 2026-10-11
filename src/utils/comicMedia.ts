import path from 'node:path';
import sharp from 'sharp';

const MAX_DECODED_PIXELS = 64_000_000;
const MAX_FRAMES = 500;
const fontfile = path.resolve(__dirname, '../../fonts/OpenSans.ttf');
type ComicFormat = 'jpeg' | 'png' | 'gif' | 'webp';

export interface ComicMediaInfo {
  format: ComicFormat;
  width: number;
  height: number;
  pages: number;
  animated: boolean;
  delay?: number[];
  loop?: number;
}

function decoder(input: Buffer) {
  return sharp(input, { animated: true, limitInputPixels: MAX_DECODED_PIXELS, failOn: 'error' });
}

// libvips does not decode APNG animation. Detect its control chunk rather than
// accidentally turning an animated PNG into a still image.
function isAnimatedPng(input: Buffer): boolean {
  if (!input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
  for (let offset = 8; offset + 12 <= input.length; ) {
    const length = input.readUInt32BE(offset);
    const type = input.toString('ascii', offset + 4, offset + 8);
    if (type === 'acTL') return true;
    if (type === 'IDAT' || type === 'IEND') return false;
    offset += 12 + length;
  }
  return false;
}

export async function inspectComicMedia(input: Buffer): Promise<ComicMediaInfo> {
  if (isAnimatedPng(input)) throw new Error('Animated PNG comics are not supported yet.');
  const metadata = await decoder(input).metadata();
  if (!['jpeg', 'png', 'gif', 'webp'].includes(metadata.format)) {
    throw new Error('This comic image format is not supported.');
  }
  const pages = metadata.pages ?? 1;
  const height = metadata.pageHeight ?? metadata.height;
  if (!metadata.width || !height || pages > MAX_FRAMES || metadata.width * height * pages > MAX_DECODED_PIXELS) {
    throw new Error('This comic is too large to process safely.');
  }
  return {
    format: metadata.format as ComicFormat,
    width: metadata.width,
    height,
    pages,
    animated: pages > 1,
    delay: metadata.delay,
    loop: metadata.loop,
  };
}

function escapeMarkup(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]
  );
}

/** Annotate every frame while retaining the input format, canvas and animation. */
export async function annotateComicPage(
  input: Buffer,
  label: string
): Promise<{
  data: Buffer;
  extension: string;
  animated: boolean;
}> {
  const info = await inspectComicMedia(input);
  const padding = Math.min(8, Math.floor(Math.min(info.width, info.height) / 10));
  const fontSize = Math.max(10, Math.min(18, Math.round(info.width / 90)));
  const text = await sharp({
    text: { text: escapeMarkup(label), font: `Open Sans ${fontSize}`, fontfile, rgba: true },
  })
    .png()
    .toBuffer();
  const fittedText = await sharp(text)
    .resize({
      width: Math.max(1, info.width - padding * 2),
      height: Math.max(1, info.height - padding * 2),
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png()
    .toBuffer({ resolveWithObject: true });
  const overlay = await sharp({
    create: { width: info.width, height: info.height, channels: 4, background: '#00000000' },
  })
    .composite([
      {
        input: fittedText.data,
        left: info.width - padding - fittedText.info.width,
        top: info.height - padding - fittedText.info.height,
      },
    ])
    .png()
    .toBuffer();

  // Animated images are a vertical strip of full frames in libvips. Tiling a
  // full-canvas transparent overlay stamps precisely the same place in each.
  let output = decoder(input)
    .keepMetadata()
    .composite([{ input: overlay, tile: true, gravity: 'northwest' }]);
  switch (info.format) {
    case 'gif':
      // Preserve duplicate frames and subtle changes between palettes. Adding
      // text can still require quantization to GIF's 256-colour palette.
      output = output.gif({
        delay: info.delay,
        loop: info.loop,
        effort: 7,
        dither: 0,
        keepDuplicateFrames: true,
        interFrameMaxError: 0,
        interPaletteMaxError: 0,
      });
      break;
    case 'webp':
      output = output.webp({ lossless: true, delay: info.delay, loop: info.loop });
      break;
    case 'png':
      output = output.png();
      break;
    case 'jpeg':
      output = output.jpeg({ quality: 100, chromaSubsampling: '4:4:4' });
      break;
  }
  return {
    data: await output.toBuffer(),
    extension: info.format === 'jpeg' ? 'jpg' : info.format,
    animated: info.animated,
  };
}
