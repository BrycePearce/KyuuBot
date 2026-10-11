import assert from 'node:assert/strict';
import test from 'node:test';
import { crc32 } from 'node:zlib';
import sharp from 'sharp';
import { annotateComicPage, inspectComicMedia } from './comicMedia';

async function animation(format: 'gif' | 'webp', loop = 3, secondGreen = 220) {
  const frame = Buffer.alloc(180 * 100 * 4);
  for (let i = 0; i < frame.length; i += 4) {
    frame[i] = 240;
    frame[i + 1] = 160;
    frame[i + 2] = 100;
    frame[i + 3] = i < 180 * 20 * 4 ? 0 : 255;
  }
  const second = Buffer.from(frame);
  for (let i = 180 * 20 * 4; i < second.length; i += 4) second[i + 1] = secondGreen;
  const source = sharp(Buffer.concat([frame, second]), {
    raw: { width: 180, height: 200, channels: 4, pageHeight: 100 },
  });
  return format === 'gif'
    ? source.gif({ delay: [100, 300], loop, keepDuplicateFrames: true, interPaletteMaxError: 0 }).toBuffer()
    : source.webp({ lossless: true, delay: [100, 300], loop }).toBuffer();
}

for (const format of ['gif', 'webp'] as const) {
  for (const loop of [0, 1, 3]) {
    test(`${format} retains frames, delays, loop ${loop}, transparency and annotation on every frame`, async () => {
      const input = await animation(format, loop);
      const result = await annotateComicPage(input, 'Vol. 1 Ch. 1');
      const before = await inspectComicMedia(input);
      const after = await inspectComicMedia(result.data);
      assert.deepEqual(after, before);
      assert.equal(result.extension, format);
      assert.equal(result.animated, true);
      const original = await sharp(input, { animated: true }).ensureAlpha().raw().toBuffer();
      const output = await sharp(result.data, { animated: true }).ensureAlpha().raw().toBuffer();
      for (let page = 0; page < 2; page++) {
        const start = page * 180 * 100 * 4;
        assert.equal(output[start + 3], 0, 'transparent pixels stay transparent');
        assert.deepEqual(
          output.subarray(start + 180 * 25 * 4, start + 180 * 30 * 4),
          original.subarray(start + 180 * 25 * 4, start + 180 * 30 * 4),
          'pixels away from the label remain unchanged'
        );
        assert.notDeepEqual(
          output.subarray(start + 180 * 75 * 4, start + 180 * 100 * 4),
          original.subarray(start + 180 * 75 * 4, start + 180 * 100 * 4),
          'every frame has a label'
        );
      }
    });
  }
}

for (const secondGreen of [160, 161]) {
  test(`GIF preserves ${secondGreen === 160 ? 'identical frames' : 'subtle frame colour changes'}`, async () => {
    const input = await animation('gif', 1, secondGreen);
    const result = await annotateComicPage(input, 'Ch. 1');
    const before = await inspectComicMedia(input);
    assert.equal(before.pages, 2, 'the source fixture contains both frames');
    assert.deepEqual(await inspectComicMedia(result.data), before);
    const original = await sharp(input, { animated: true }).ensureAlpha().raw().toBuffer();
    const output = await sharp(result.data, { animated: true }).ensureAlpha().raw().toBuffer();
    for (let page = 0; page < 2; page++) {
      const offset = (page * 180 * 100 + 180 * 25) * 4;
      assert.deepEqual(output.subarray(offset, offset + 4), original.subarray(offset, offset + 4));
    }
  });
}

test('rejects excessive frame counts before annotation', async () => {
  const input = await sharp(Buffer.alloc(8 * 8 * 501 * 3, 255), {
    raw: { width: 8, height: 8 * 501, channels: 3, pageHeight: 8 },
  })
    .gif({ keepDuplicateFrames: true })
    .toBuffer();
  assert.equal((await sharp(input, { animated: true }).metadata()).pages, 501);
  await assert.rejects(annotateComicPage(input, 'Ch. 1'), /too large/);
});

test('rejects excessive decoded canvas size before annotation', async () => {
  const input = await sharp({ create: { width: 8, height: 8, channels: 3, background: 'white' } })
    .png()
    .toBuffer();
  // A crafted oversized PNG header must be rejected before decoding pixels.
  // Recompute its IHDR checksum without allocating a huge test bitmap.
  input.writeUInt32BE(9000, 16);
  input.writeUInt32BE(8000, 20);
  input.writeUInt32BE(crc32(input.subarray(12, 29)), 29);
  await assert.rejects(annotateComicPage(input, 'Ch. 1'), /pixel limit|too large/i);
});

for (const format of ['png', 'jpeg', 'gif', 'webp'] as const) {
  test(`still ${format} keeps its format and canvas`, async () => {
    const input = await sharp({ create: { width: 200, height: 100, channels: 4, background: 'white' } })
      .toFormat(format)
      .toBuffer();
    const result = await annotateComicPage(input, 'Vol. ? Ch. 12.5');
    const metadata = await inspectComicMedia(result.data);
    assert.equal(metadata.format, format);
    assert.equal(metadata.width, 200);
    assert.equal(metadata.height, 100);
    assert.equal(metadata.animated, false);
  });
}

test('tiny images and markup characters do not break text rendering', async () => {
  const input = await sharp({ create: { width: 8, height: 8, channels: 4, background: 'white' } })
    .png()
    .toBuffer();
  const result = await annotateComicPage(input, 'Vol. <&> Ch. 1');
  assert.equal((await inspectComicMedia(result.data)).width, 8);
});

test('invalid images fail instead of producing a misleading output', async () => {
  await assert.rejects(annotateComicPage(Buffer.from('not an image'), 'Ch. 1'));
});

test('APNG is rejected instead of silently losing animation', async () => {
  const png = await sharp({ create: { width: 8, height: 8, channels: 4, background: 'white' } })
    .png()
    .toBuffer();
  const animationControl = Buffer.alloc(20);
  animationControl.writeUInt32BE(8);
  animationControl.write('acTL', 4);
  const apng = Buffer.concat([png.subarray(0, 33), animationControl, png.subarray(33)]);
  await assert.rejects(inspectComicMedia(apng), /Animated PNG/);
});
