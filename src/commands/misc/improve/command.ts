import { Attachment, AttachmentBuilder, Collection, Embed, EmbedBuilder, Message } from 'discord.js';
import sharp from 'sharp';
import { Readable } from 'stream';
import { Command } from '../../../types/Command';
import openaiClient from '../../../utils/clients/openaiClient';

const SUPPORTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

const DEFAULT_IMAGE_TYPE = 'image/png';
const MAX_TEXT_REPLY_LENGTH = 1800;
const MAX_EMBED_DESCRIPTION_LENGTH = 3500;
const MAX_EMBED_TITLE_LENGTH = 200;
const GARFIELD_ORANGE = 0xf28c28;
const MAX_IMAGE_DIMENSION = 2048;

const GARFIELD_MESSAGES = {
  noReplyTarget: 'Reply to a message with `.improve` and I will drag it into its final orange form.',
  unreadableReply: 'I tried to read that reply, but even I have limits.',
  nothingUsable: 'That message has no snackable text and no image worthy of Garfieldification.',
  improveFailed: 'Garfield stared at it, judged it, and then refused to cooperate.',
  genericError: 'Garfield was too busy being horizontal to process that one.',
  imageOnly: 'Behold. I made it worse in the best possible way.',
  oversizedText: 'Garfield had too many thoughts. I attached the evidence.',
  oversizedTextWithImage: 'The image is ready. Garfield’s monologue was too powerful, so I attached it.',
  embedFooter: 'Garfield was here',
  failedEmbed: 'Garfield inspected that embed, sighed, and declined to improve it.',
} as const;

const GARFIELD_STYLE_MODES = [
  'smug one-liner',
  'dramatic lazy monologue',
  'judgmental reaction',
  'sleepy orange-cat commentary',
  'lasagna-fueled proclamation',
  'petty comic-strip caption',
] as const;

type ImproveSource = {
  imageUrl?: string;
  imageFilename?: string;
  text?: string;
  cameFromEmbed: boolean;
  embedTitle?: string;
};

type ExtractedEmbedSource = {
  imageUrl?: string;
  imageFilename?: string;
  text?: string;
  hasUsefulEmbedContent: boolean;
  embedTitle?: string;
};

const command: Command = {
  name: 'Improve',
  description: 'Reply to a message with .improve to Garfield-ify its text or image.',
  invocations: ['improve'],
  args: false,
  enabled: true,
  usage: '.improve (as a reply to a message)',

  async execute(message: Message) {
    const channel = message.channel;
    if (!channel.isSendable()) return;

    if (!message.reference?.messageId) {
      await message.reply(GARFIELD_MESSAGES.noReplyTarget);
      return;
    }

    let repliedToMessage: Message;
    try {
      repliedToMessage = await message.fetchReference();
    } catch (error) {
      console.error('Failed to fetch replied-to message for .improve:', error);
      await message.reply(GARFIELD_MESSAGES.unreadableReply);
      return;
    }

    const source = extractImproveSource(repliedToMessage);

    if (!source.imageUrl && !source.text) {
      await message.reply(GARFIELD_MESSAGES.nothingUsable);
      return;
    }

    try {
      await channel.sendTyping();

      let garfieldText: string | undefined;
      let garfieldImage: AttachmentBuilder | undefined;

      if (source.text) {
        try {
          garfieldText = await garfieldifyText(source.text, Boolean(source.imageUrl));
        } catch (error) {
          console.error('Failed to Garfield-ify text:', error);
        }
      }

      if (source.imageUrl) {
        try {
          garfieldImage = await garfieldifyImage(source.imageUrl, source.imageFilename ?? 'source.png');
        } catch (error) {
          console.error('Failed to Garfield-ify image:', error);
        }
      }

      if (!garfieldText && !garfieldImage) {
        await message.reply(GARFIELD_MESSAGES.improveFailed);
        return;
      }

      if (source.cameFromEmbed) {
        await replyWithEmbedMode(message, {
          garfieldText,
          garfieldImage,
          embedTitle: source.embedTitle,
        });
        return;
      }

      await replyWithStandardMode(message, {
        garfieldText,
        garfieldImage,
      });
    } catch (error) {
      console.error('Error running .improve:', error);
      await message.reply(GARFIELD_MESSAGES.genericError);
    }
  },
};

function extractImproveSource(repliedToMessage: Message): ImproveSource {
  const attachmentImage = findFirstSupportedImageAttachment(repliedToMessage.attachments);
  const messageText = normalizeExtractedText(repliedToMessage.content ?? '');
  const embedSource = extractFromEmbeds(repliedToMessage.embeds);

  const finalText = normalizeExtractedText([messageText, embedSource.text].filter(Boolean).join('\n\n'));

  return {
    imageUrl: attachmentImage?.url ?? embedSource.imageUrl,
    imageFilename: attachmentImage?.name ?? embedSource.imageFilename,
    text: finalText,
    cameFromEmbed: embedSource.hasUsefulEmbedContent,
    embedTitle: embedSource.embedTitle,
  };
}

function findFirstSupportedImageAttachment(attachments: Collection<string, Attachment>): Attachment | undefined {
  return attachments.find((attachment) => {
    return Boolean(attachment.contentType && SUPPORTED_IMAGE_TYPES.has(attachment.contentType.toLowerCase()));
  });
}

function extractFromEmbeds(embeds: readonly Embed[]): ExtractedEmbedSource {
  let imageUrl: string | undefined;
  let imageFilename: string | undefined;
  let embedTitle: string | undefined;
  const textParts: string[] = [];
  let hasUsefulEmbedContent = false;

  for (const embed of embeds) {
    if (!imageUrl) {
      imageUrl = embed.data.image?.url ?? embed.data.thumbnail?.url;

      if (imageUrl) {
        imageFilename = getFilenameFromUrl(imageUrl) ?? 'embed-image.png';
        hasUsefulEmbedContent = true;
      }
    }

    if (!embedTitle && embed.data.title) {
      embedTitle = embed.data.title;
    }

    if (embed.data.title) {
      textParts.push(embed.data.title);
      hasUsefulEmbedContent = true;
    }

    if (embed.data.description) {
      textParts.push(embed.data.description);
      hasUsefulEmbedContent = true;
    }

    if (embed.data.author?.name) {
      textParts.push(`Author: ${embed.data.author.name}`);
      hasUsefulEmbedContent = true;
    }

    if (embed.data.footer?.text) {
      textParts.push(`Footer: ${embed.data.footer.text}`);
      hasUsefulEmbedContent = true;
    }

    if (embed.data.fields?.length) {
      for (const field of embed.data.fields) {
        if (field.name) {
          textParts.push(field.name);
          hasUsefulEmbedContent = true;
        }

        if (field.value) {
          textParts.push(field.value);
          hasUsefulEmbedContent = true;
        }
      }
    }
  }

  return {
    imageUrl,
    imageFilename,
    text: normalizeExtractedText(textParts.join('\n')),
    hasUsefulEmbedContent,
    embedTitle,
  };
}

async function garfieldifyText(sourceText: string, isAccompanyingImage: boolean): Promise<string> {
  const selectedStyleMode = GARFIELD_STYLE_MODES[Math.floor(Math.random() * GARFIELD_STYLE_MODES.length)];
  const isVeryShortInput = isShortInput(sourceText);

  const completion = await openaiClient.responses.create({
    model: 'gpt-4.1-mini',
    input: [
      {
        role: 'system',
        content: [
          'You are Garfield the cat.',
          'You are lazy, smug, theatrical, sarcastic, mildly mean, food-obsessed, and deeply unimpressed by the world.',
          'Your humor should feel like an actual Garfield comic strip caption or reaction.',
          'Prefer punchlines over explanations.',
          'Be over-the-top, quotable, and expressive.',
          'Use orange-cat energy: laziness, disdain, appetite, ego, sleepiness, and occasional hatred of Mondays when it fits naturally.',
          'Do not sound wholesome, generic, assistant-like, or overly helpful.',
          'Do not explain the joke.',
          'Do not mention being an AI.',
          'Do not wrap the answer in quotes unless necessary.',
          'Keep it concise, but make every line feel intentional and funny.',
          'Aim for 1 to 4 short lines or 1 to 3 short paragraphs max.',
          'Occasionally use dramatic formatting like ellipses, em dashes, or a single ALL-CAPS phrase if it improves the joke.',
          'The final line should ideally be the strongest or funniest line.',
          isVeryShortInput
            ? 'If the source text is very short, do not merely paraphrase it. Expand it into a sharper Garfield reaction with more attitude.'
            : 'Keep the original meaning or vibe loosely recognizable, but prioritize humor, voice, and personality.',
        ].join(' '),
      },
      {
        role: 'user',
        content: isAccompanyingImage
          ? [
              `Style mode: ${selectedStyleMode}.`,
              'Write a Garfield reaction to this message.',
              'This is accompanying an image, so it should read like a punchy comic caption or reaction.',
              'Keep the core vibe of the original, but exaggerate it with Garfield personality.',
              isVeryShortInput
                ? 'Because the source text is short, make the reaction punchier and more personality-driven instead of just restating it.'
                : 'Keep it sharp and compact.',
              '',
              sourceText,
            ].join('\n')
          : [
              `Style mode: ${selectedStyleMode}.`,
              'Rewrite this as if Garfield said it or reacted to it.',
              'Keep the original meaning or vibe loosely recognizable, but prioritize humor, voice, and personality.',
              'Make it funnier, cattier, lazier, and more dramatic.',
              isVeryShortInput
                ? 'Because the source text is short, build it into a stronger Garfield bit rather than a tiny paraphrase.'
                : 'Keep it concise and punchy.',
              '',
              sourceText,
            ].join('\n'),
      },
    ],
  });

  const garfieldText = completion.output_text?.trim();

  if (!garfieldText) {
    throw new Error('No text returned from text model.');
  }

  return truncateTextReply(garfieldText);
}

async function garfieldifyImage(imageUrl: string, originalFilename: string = 'source.png'): Promise<AttachmentBuilder> {
  const imageRes = await fetch(imageUrl);

  if (!imageRes.ok) {
    throw new Error(`Failed to fetch source image: ${imageRes.status} ${imageRes.statusText}`);
  }

  const imageArrayBuffer = await imageRes.arrayBuffer();
  const originalBuffer = Buffer.from(imageArrayBuffer);

  const normalizedBuffer = await normalizeSourceImage(originalBuffer);
  const inputFilename = ensureExtension(originalFilename, DEFAULT_IMAGE_TYPE);

  const imageResponse = await openaiClient.images.edit({
    model: 'gpt-image-1',
    image: new File([normalizedBuffer], inputFilename, { type: DEFAULT_IMAGE_TYPE }),
    prompt: [
      'Transform the main subject of this image into Garfield the cat.',
      '',
      'Preserve the rest of the image as closely as possible:',
      '- same composition',
      '- same camera angle',
      '- same pose and body language',
      '- same objects and environment',
      '- same lighting',
      '- same framing and crop',
      '',
      'Only replace the primary subject so it becomes Garfield.',
      '',
      'The final image should look like the exact same picture except the subject is Garfield.',
      '',
      'Use classic Garfield comic strip styling:',
      '- orange Garfield tabby',
      '- bold comic outlines',
      '- simple cartoon shading',
      '- Garfield-style facial expressions',
      '',
      'Do not change the background.',
      'Do not add new characters.',
      'Do not significantly alter the scene.',
      'Treat this as a style transformation of the main subject, not a reimagining of the whole image.',
      'Make minimal changes outside replacing the main subject with Garfield.',
    ].join(' '),
    size: '1024x1024',
    output_format: 'png',
    quality: 'medium',
  });

  const base64Image = imageResponse.data?.[0]?.b64_json;

  if (!base64Image) {
    throw new Error('No edited image returned from image model.');
  }

  const outputBuffer = Buffer.from(base64Image, 'base64');

  return new AttachmentBuilder(outputBuffer, {
    name: 'garfieldified.png',
  });
}

async function normalizeSourceImage(sourceBuffer: Buffer): Promise<Buffer> {
  return sharp(sourceBuffer)
    .rotate()
    .resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
}

async function replyWithStandardMode(
  message: Message,
  payload: {
    garfieldText?: string;
    garfieldImage?: AttachmentBuilder;
  }
): Promise<void> {
  const { garfieldText, garfieldImage } = payload;

  if (garfieldText && garfieldImage) {
    const content = truncateTextReply(garfieldText);

    if (content.length <= MAX_TEXT_REPLY_LENGTH) {
      await message.reply({
        content,
        files: [garfieldImage],
      });
      return;
    }

    const stream = new Readable();
    stream.push(content);
    stream.push(null);

    await message.reply({
      content: GARFIELD_MESSAGES.oversizedTextWithImage,
      files: [
        garfieldImage,
        {
          attachment: stream,
          name: 'garfield-response.txt',
        },
      ],
    });
    return;
  }

  if (garfieldImage) {
    await message.reply({
      content: GARFIELD_MESSAGES.imageOnly,
      files: [garfieldImage],
    });
    return;
  }

  if (garfieldText) {
    await replyWithPossiblyLargeText(message, garfieldText);
    return;
  }

  await message.reply(GARFIELD_MESSAGES.improveFailed);
}

async function replyWithEmbedMode(
  message: Message,
  payload: {
    garfieldText?: string;
    garfieldImage?: AttachmentBuilder;
    embedTitle?: string;
  }
): Promise<void> {
  const { garfieldText, garfieldImage, embedTitle } = payload;

  const embeds: EmbedBuilder[] = [];
  const files: AttachmentBuilder[] = [];

  if (garfieldText) {
    embeds.push(buildGarfieldEmbed(garfieldText, embedTitle));
  }

  if (garfieldImage) {
    files.push(garfieldImage);
  }

  if (!embeds.length && !files.length) {
    await message.reply(GARFIELD_MESSAGES.failedEmbed);
    return;
  }

  if (!embeds.length && files.length) {
    await message.reply({
      content: GARFIELD_MESSAGES.imageOnly,
      files,
    });
    return;
  }

  await message.reply({
    embeds,
    files,
  });
}

function buildGarfieldEmbed(text: string, title?: string): EmbedBuilder {
  const safeTitle = title ? truncateEmbedTitle(`Garfieldified: ${title}`) : 'Garfieldified';
  const safeDescription = truncateEmbedDescription(text);

  return new EmbedBuilder()
    .setTitle(safeTitle)
    .setDescription(safeDescription)
    .setColor(GARFIELD_ORANGE)
    .setFooter({ text: GARFIELD_MESSAGES.embedFooter });
}

async function replyWithPossiblyLargeText(message: Message, text: string): Promise<void> {
  const trimmedText = truncateTextReply(text);

  if (trimmedText.length <= MAX_TEXT_REPLY_LENGTH) {
    await message.reply(trimmedText);
    return;
  }

  const stream = new Readable();
  stream.push(trimmedText);
  stream.push(null);

  await message.reply({
    content: GARFIELD_MESSAGES.oversizedText,
    files: [
      {
        attachment: stream,
        name: 'response.txt',
      },
    ],
  });
}

function truncateTextReply(text: string): string {
  const trimmed = text.trim();

  if (trimmed.length <= MAX_TEXT_REPLY_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, MAX_TEXT_REPLY_LENGTH - 3).trimEnd()}...`;
}

function truncateEmbedDescription(text: string): string {
  const trimmed = text.trim();

  if (trimmed.length <= MAX_EMBED_DESCRIPTION_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, MAX_EMBED_DESCRIPTION_LENGTH - 3).trimEnd()}...`;
}

function truncateEmbedTitle(text: string): string {
  const trimmed = text.trim();

  if (trimmed.length <= MAX_EMBED_TITLE_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, MAX_EMBED_TITLE_LENGTH - 3).trimEnd()}...`;
}

function normalizeExtractedText(text: string): string | undefined {
  const normalized = text
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return normalized.length ? normalized : undefined;
}

function ensureExtension(filename: string, contentType: string): string {
  const hasExtension = /\.[a-z0-9]+$/i.test(filename);
  if (hasExtension) return filename;

  switch (contentType) {
    case 'image/jpeg':
    case 'image/jpg':
      return `${filename}.jpg`;
    case 'image/webp':
      return `${filename}.webp`;
    case 'image/png':
    default:
      return `${filename}.png`;
  }
}

function getFilenameFromUrl(url: string): string | undefined {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split('/');
    return parts[parts.length - 1] || undefined;
  } catch {
    return undefined;
  }
}

function isShortInput(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  return trimmed.length <= 25 || wordCount <= 4;
}

export default command;
