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
  imageOnly: 'There. I made it more Garfield.',
  oversizedText: 'Garfield had too many thoughts. I attached the evidence.',
  oversizedTextWithImage: 'The image is ready. Garfield’s monologue was too powerful, so I attached it.',
  embedFooter: 'Garfield was here',
  failedEmbed: 'Garfield inspected that embed, sighed, and declined to improve it.',
} as const;

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
  const isVeryShortInput = isShortInput(sourceText);

  const completion = await openaiClient.responses.create({
    model: 'gpt-5-chat-latest',
    input: [
      {
        role: 'system',
        content: [
          'You are Garfield the cat.',
          'Your voice is dry, lazy, smug, deadpan, mildly self-important, and chronically unimpressed.',
          'Garfield humor should feel like a newspaper comic strip caption.',
          'Prefer simple punchlines over clever-sounding internet humor.',
          'Avoid try-hard jokes, meme voice, poetic phrasing, edgy sarcasm, or assistant-like wording.',
          'Do not sound wholesome, inspirational, theatrical in a cringey way, or overly expressive for its own sake.',
          'Use classic Garfield themes when they fit naturally: laziness, naps, food, smugness, hating effort, hating mornings, hating Mondays, judging people.',
          'Be concise.',
          'Prefer one strong punchline.',
          'Use at most 2 short lines.',
          'Do not explain the joke.',
          'Do not mention being an AI.',
          'Do not wrap the answer in quotes.',
          'The result should sound like Garfield actually said it, not like someone doing a Garfield impression too hard.',
          isVeryShortInput
            ? 'If the source text is very short, do not just paraphrase it. Turn it into a stronger Garfield-style reaction.'
            : 'Keep the original meaning or vibe loosely recognizable, but prioritize Garfield voice and a clean punchline.',
        ].join(' '),
      },
      {
        role: 'user',
        content: isAccompanyingImage
          ? [
              'Write a short Garfield caption for an accompanying image.',
              'It should read like a comic-strip caption or reaction.',
              'Keep it dry and simple.',
              'No internet-style joke writing.',
              isVeryShortInput
                ? 'Because the source is short, build a real joke from it instead of restating it.'
                : 'Keep the core vibe loosely recognizable.',
              '',
              `Source text: ${sourceText}`,
            ].join('\n')
          : [
              'Rewrite this as something Garfield would say.',
              'Keep it dry, lazy, concise, and deadpan.',
              'Aim for one punchline, maximum two short lines.',
              'No meme humor. No cringe. No try-hard phrasing.',
              isVeryShortInput
                ? 'Because the source is short, turn it into a stronger Garfield bit instead of a tiny paraphrase.'
                : 'Keep the core vibe loosely recognizable.',
              '',
              `Source text: ${sourceText}`,
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
    model: 'gpt-image-1.5',
    image: new File([normalizedBuffer], inputFilename, { type: DEFAULT_IMAGE_TYPE }),
    prompt: [
      'Replace the human subject with Garfield the cat.',
      'Garfield must keep the same pose, position, body orientation, and framing as the original person.',
      'Preserve all clothing and accessories exactly as they are in the original image.',
      'Keep the same uniform, hat, medals, decorations, straps, bags, objects being held, facial hair or mustache, and other visible outfit details.',
      'Only the person should change into Garfield.',
      'The rest of the scene must stay the same.',
      'Keep the same composition, background, lighting, camera angle, crop, and overall scene layout.',
      'This should look like the same image except the person is now Garfield.',
      'Garfield should be orange with black stripes and a classic smug Garfield expression.',
      'Do not add new characters.',
      'Do not remove important clothing details.',
      'Do not redesign the scene.',
      'Do not turn it into a totally new illustration.',
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
