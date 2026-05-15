import sharp from 'sharp';
import {
  CAPTION_HEIGHT,
  DIVIDER_1_X,
  DIVIDER_2_X,
  DIVIDER_WIDTH,
  PANEL_1_CENTER,
  PANEL_1_WIDTH,
  PANEL_2_CENTER,
  PANEL_3_CENTER,
  STRIP_HEIGHT,
  STRIP_WIDTH,
} from './types';
import type { ComicScript } from './types';

const FONT_SIZE = 17;
const LINE_HEIGHT = 22;
// Conservative average char width estimate for bold Arial at 17px
const AVG_CHAR_WIDTH = 9;
// Horizontal padding inside each caption bar
const CAPTION_PADDING = 30;

export async function assembleComic(imageBuffer: Buffer, script: ComicScript): Promise<Buffer> {
  const [p1, p2, p3] = script.panels;

  const svg = buildSvgOverlay(p1.caption, p2.caption, p3.caption);

  return sharp(imageBuffer)
    .resize(STRIP_WIDTH, STRIP_HEIGHT, { fit: 'fill' }) // normalize size in case model drifts
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

function buildSvgOverlay(caption1: string, caption2: string, caption3: string): string {
  const captionTop = STRIP_HEIGHT - CAPTION_HEIGHT;

  const panel2Width = DIVIDER_2_X - DIVIDER_1_X - DIVIDER_WIDTH;
  const panel3Width = STRIP_WIDTH - DIVIDER_2_X - DIVIDER_WIDTH;
  const availableWidths = [
    PANEL_1_WIDTH - CAPTION_PADDING * 2,
    panel2Width - CAPTION_PADDING * 2,
    panel3Width - CAPTION_PADDING * 2,
  ];

  const lines1 = wrapCaption(caption1, availableWidths[0]);
  const lines2 = wrapCaption(caption2, availableWidths[1]);
  const lines3 = wrapCaption(caption3, availableWidths[2]);

  const captionBars = [
    buildCaptionBar(0, PANEL_1_WIDTH, captionTop, CAPTION_HEIGHT),
    buildCaptionBar(DIVIDER_1_X + DIVIDER_WIDTH, DIVIDER_2_X - DIVIDER_1_X - DIVIDER_WIDTH, captionTop, CAPTION_HEIGHT),
    buildCaptionBar(DIVIDER_2_X + DIVIDER_WIDTH, STRIP_WIDTH - DIVIDER_2_X - DIVIDER_WIDTH, captionTop, CAPTION_HEIGHT),
  ].join('\n');

  const captionTexts = [
    buildCaptionText(lines1, PANEL_1_CENTER, captionTop, CAPTION_HEIGHT),
    buildCaptionText(lines2, PANEL_2_CENTER, captionTop, CAPTION_HEIGHT),
    buildCaptionText(lines3, PANEL_3_CENTER, captionTop, CAPTION_HEIGHT),
  ].join('\n');

  // Dividers run full height so they visually separate the panels including the caption bars
  const dividers = [
    `<rect x="${DIVIDER_1_X}" y="0" width="${DIVIDER_WIDTH}" height="${STRIP_HEIGHT}" fill="black"/>`,
    `<rect x="${DIVIDER_2_X}" y="0" width="${DIVIDER_WIDTH}" height="${STRIP_HEIGHT}" fill="black"/>`,
  ].join('\n');

  // Separator line between art and caption bar
  const separators = [
    `<line x1="0" y1="${captionTop}" x2="${DIVIDER_1_X}" y2="${captionTop}" stroke="black" stroke-width="2"/>`,
    `<line x1="${DIVIDER_1_X + DIVIDER_WIDTH}" y1="${captionTop}" x2="${DIVIDER_2_X}" y2="${captionTop}" stroke="black" stroke-width="2"/>`,
    `<line x1="${DIVIDER_2_X + DIVIDER_WIDTH}" y1="${captionTop}" x2="${STRIP_WIDTH}" y2="${captionTop}" stroke="black" stroke-width="2"/>`,
  ].join('\n');

  // Thin outer border
  const border = `<rect x="0" y="0" width="${STRIP_WIDTH}" height="${STRIP_HEIGHT}" fill="none" stroke="black" stroke-width="3"/>`;

  return `<svg width="${STRIP_WIDTH}" height="${STRIP_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
${captionBars}
${separators}
${dividers}
${captionTexts}
${border}
</svg>`;
}

function buildCaptionBar(x: number, width: number, y: number, height: number): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="white"/>`;
}

function buildCaptionText(lines: string[], centerX: number, captionTop: number, captionHeight: number): string {
  const totalTextHeight = lines.length * LINE_HEIGHT;
  // Vertically center the text block within the caption bar
  const startY = captionTop + Math.floor((captionHeight - totalTextHeight) / 2) + FONT_SIZE;

  const tspans = lines
    .map((line, i) => `<tspan x="${centerX}" dy="${i === 0 ? 0 : LINE_HEIGHT}">${escapeXml(line)}</tspan>`)
    .join('');

  return `<text x="${centerX}" y="${startY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${FONT_SIZE}" font-weight="bold" fill="black">${tspans}</text>`;
}

function wrapCaption(text: string, availableWidth: number): string[] {
  const maxCharsPerLine = Math.floor(availableWidth / AVG_CHAR_WIDTH);
  const maxLines = Math.floor(CAPTION_HEIGHT / LINE_HEIGHT);

  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const test = current ? `${current} ${word}` : word;
    if (test.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) {
        // Last allowed line — append remaining words and truncate if needed
        const remaining = words.slice(i).join(' ');
        const truncated =
          remaining.length > maxCharsPerLine ? `${remaining.slice(0, maxCharsPerLine - 1).trimEnd()}…` : remaining;
        lines.push(truncated);
        return lines;
      }
    } else {
      current = test;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
