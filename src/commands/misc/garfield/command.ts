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

const NERMAL_CHANCE = 0.1;

const GARFIELD_MESSAGES = {
  noReplyTarget: 'Reply to a message with `.garfield`. I’m not doing free-range effort.',
  unreadableReply: 'I tried to read that reply. Regrettably, it fought back.',
  nothingUsable: 'That message has no snackable text and no image worth improving against its will.',
  improveFailed: 'I looked at it and decided not to grow as a person.',
  genericError: 'Something broke. I blame Monday.',
  oversizedText: 'I had too much to say. That alone is upsetting.',
  failedEmbed: 'That embed had problems even I did not want.',
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

type MascotCharacter = 'garfield' | 'nermal';
type ImageVariant = 'classic' | 'insert' | 'cursed';
type CaptionStyle = 'bitter-one-liner' | 'lazy-complaint' | 'smug-reaction' | 'anti-effort' | 'food-driven';

const command: Command = {
  name: 'Garfield',
  description: 'Reply to a message with .garfield to Garfield-ify its text or image.',
  invocations: ['garfield'],
  args: false,
  enabled: true,
  usage: '.garfield (as a reply to a message)',

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
      console.error('Failed to fetch replied-to message for .garfield:', error);
      await message.reply(GARFIELD_MESSAGES.unreadableReply);
      return;
    }

    const source = extractImproveSource(repliedToMessage);

    if (!source.imageUrl && !source.text) {
      await message.reply(GARFIELD_MESSAGES.nothingUsable);
      return;
    }

    const character = pickMascotCharacter();
    const captionStyle = pickCaptionStyle();
    const imageVariant = pickImageVariant();

    try {
      await channel.sendTyping();

      let mascotText: string | undefined;
      let mascotImage: AttachmentBuilder | undefined;

      if (source.text) {
        try {
          mascotText = await mascotifyText({
            sourceText: source.text,
            isAccompanyingImage: Boolean(source.imageUrl),
            character,
            captionStyle,
          });
        } catch (error) {
          console.error('Failed to mascot-ify text:', error);
        }
      }

      if (source.imageUrl) {
        try {
          mascotImage = await mascotifyImage({
            imageUrl: source.imageUrl,
            originalFilename: source.imageFilename ?? 'source.png',
            character,
            variant: imageVariant,
          });
        } catch (error) {
          console.error('Failed to mascot-ify image:', error);
        }
      }

      if (!mascotText && !mascotImage) {
        await message.reply(GARFIELD_MESSAGES.improveFailed);
        return;
      }

      if (source.cameFromEmbed) {
        await replyWithEmbedMode(message, {
          garfieldText: mascotText,
          garfieldImage: mascotImage,
          embedTitle: source.embedTitle,
          character,
        });
        return;
      }

      await replyWithStandardMode(message, {
        garfieldText: mascotText,
        garfieldImage: mascotImage,
        character,
      });
    } catch (error) {
      console.error('Error running .garfield:', error);
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

async function mascotifyText({
  sourceText,
  isAccompanyingImage,
  character,
  captionStyle,
}: {
  sourceText: string;
  isAccompanyingImage: boolean;
  character: MascotCharacter;
  captionStyle: CaptionStyle;
}): Promise<string> {
  const isVeryShortInput = isShortInput(sourceText);

  const completion = await openaiClient.responses.create({
    model: 'gpt-5-chat-latest',
    input: [
      {
        role: 'system',
        content: buildTextSystemPrompt({
          character,
          captionStyle,
          isVeryShortInput,
        }),
      },
      {
        role: 'user',
        content: buildTextUserPrompt({
          sourceText,
          isAccompanyingImage,
          character,
          captionStyle,
          isVeryShortInput,
        }),
      },
    ],
  });

  const mascotText = completion.output_text?.trim();

  if (!mascotText) {
    throw new Error('No text returned from text model.');
  }

  return truncateTextReply(mascotText);
}

async function mascotifyImage({
  imageUrl,
  originalFilename = 'source.png',
  character,
  variant,
}: {
  imageUrl: string;
  originalFilename?: string;
  character: MascotCharacter;
  variant: ImageVariant;
}): Promise<AttachmentBuilder> {
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
    prompt: buildImageEditPrompt({
      character,
      variant,
    }),
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
    name: `${characterifiedFilename(character)}.png`,
  });
}

function buildTextSystemPrompt({
  character,
  captionStyle,
  isVeryShortInput,
}: {
  character: MascotCharacter;
  captionStyle: CaptionStyle;
  isVeryShortInput: boolean;
}): string {
  if (character === 'nermal') {
    return [
      'You are Nermal from Garfield.',
      'Write a short caption or reaction as Nermal would say it.',
      'Keep it concise, funny, and characterful.',
      'The voice should be smug, cute, vain, self-satisfied, and annoying in an effortless way.',
      'Avoid baby-talk overload, internet meme humor, try-hard sarcasm, poetic phrasing, roleplay theatrics, or assistant-like wording.',
      'Nermal should sound pleased with himself, a little bratty, and very aware of being adorable.',
      'Use at most 2 short lines.',
      'Prefer one clear joke.',
      'Do not explain the joke.',
      'Do not wrap the answer in quotes.',
      'Do not use emojis or hashtags.',
      'Keep it natural and readable, not exaggerated nonsense.',
      `Caption shape: ${describeCaptionStyle(captionStyle)}.`,
      isVeryShortInput
        ? 'If the source text is very short, build a real joke from it instead of lightly paraphrasing it.'
        : 'Keep the original meaning or vibe loosely recognizable only if it helps the joke.',
    ].join(' ');
  }

  return [
    'You are Garfield the cat.',
    'Write like a classic Garfield newspaper comic caption.',
    'Your voice is dry, lazy, smug, bitter, petty, deadpan, and chronically unimpressed.',
    'Prefer blunt, simple punchlines over clever internet humor.',
    'Avoid meme voice, try-hard jokes, theatrical phrasing, wholesome inspiration, edgy sarcasm, or assistant-like wording.',
    'Good themes: avoiding effort, hating mornings, judging people, boredom, food, naps, selfishness, and low-energy superiority.',
    'Use at most 2 short lines.',
    'Prefer one clean joke.',
    'Do not explain the joke.',
    'Do not wrap the answer in quotes.',
    'Do not use emojis or hashtags.',
    'The result should sound effortless and mean in a funny way, not like someone trying too hard to do Garfield.',
    `Caption shape: ${describeCaptionStyle(captionStyle)}.`,
    isVeryShortInput
      ? 'If the source text is very short, do not just paraphrase it. Turn it into a stronger Garfield-style reaction.'
      : 'Keep the original meaning or vibe loosely recognizable only if it helps the joke.',
  ].join(' ');
}

function buildTextUserPrompt({
  sourceText,
  isAccompanyingImage,
  character,
  captionStyle,
  isVeryShortInput,
}: {
  sourceText: string;
  isAccompanyingImage: boolean;
  character: MascotCharacter;
  captionStyle: CaptionStyle;
  isVeryShortInput: boolean;
}): string {
  const subjectLabel = character === 'nermal' ? 'Nermal' : 'Garfield';

  return [
    isAccompanyingImage
      ? `Write a short ${subjectLabel}-style caption for an accompanying image.`
      : `Rewrite this as something ${subjectLabel} would say.`,
    `Lean into this mode: ${describeCaptionStyle(captionStyle)}.`,
    'Do not simply paraphrase the source text.',
    'Build one clean joke or reaction.',
    'Keep it concise and readable.',
    isVeryShortInput
      ? 'Because the source is short, make the joke stronger instead of just restating it.'
      : 'Keep the core vibe loosely recognizable.',
    '',
    `Source text: ${sourceText}`,
  ].join('\n');
}

function buildImageEditPrompt({ character, variant }: { character: MascotCharacter; variant: ImageVariant }): string {
  const subjectDescription =
    character === 'nermal'
      ? [
          'Nermal, the small cute gray cat from Garfield, with soft gray fur, big expressive eyes, a rounded face, and an adorably smug expression',
          'Keep Nermal recognizable as the classic Garfield character, but adapt him to the image naturally',
        ].join('. ')
      : [
          'Garfield, a classic orange tabby cat with black stripes, a round face, half-lidded eyes, and a smug expression',
          'Keep Garfield recognizable as classic Garfield, but adapt him to the image naturally',
        ].join('. ');

  const sharedRules = [
    'Preserve the original image as much as possible.',
    'If there is a clear main subject, central character, or prominent figure, transform that subject into the character.',
    'If there is no clear main subject to replace, add the character prominently but tastefully into the scene in a way that fits the composition.',
    'Match the original medium and style. If the source is a painting, poster, illustration, animation frame, meme, or drawing, keep that style rather than turning it photorealistic.',
    'Preserve the original pose, framing, camera angle, crop, background, lighting, scene layout, and overall composition.',
    'Preserve the actual clothing style, accessories, props, and objects that are clearly present in the source image when a subject is being transformed.',
    'Do not invent military uniforms, medals, ceremonial outfits, royal portraits, fantasy armor, or formal decorations unless they are clearly present in the original image.',
    'Do not redesign the whole scene.',
    'Do not add extra random characters.',
    'Keep the result funny, readable, and visually coherent.',
  ];

  if (variant === 'insert') {
    return [
      `Add ${subjectDescription} into this image naturally and prominently.`,
      'Do not replace the whole scene.',
      'Keep the original image intact as much as possible.',
      'If there is already a strong main subject, preserve that subject and add the character as a nearby presence, observer, intruder, or reaction figure.',
      'The character should feel like they belong in the same world and style as the original image.',
      'Place the character in a tasteful, visible position rather than hiding them in the distance.',
      ...sharedRules,
    ].join(' ');
  }

  if (variant === 'cursed') {
    return [
      `Transform or insert ${subjectDescription} in a funny, slightly uncanny, cursed way.`,
      'Keep the original image clearly recognizable.',
      'If there is a strong main subject, prefer transforming that subject first.',
      'If there is not, add the character prominently into the scene.',
      'The effect should be strange and entertaining, but not messy or incomprehensible.',
      ...sharedRules,
    ].join(' ');
  }

  return [
    `Use ${subjectDescription} as the transformed or inserted character.`,
    'Default behavior: if there is a clear main subject, replace that subject while preserving as much of the original image as possible.',
    'If there is no obvious subject to replace, add the character in a tasteful and prominent position that respects the original artwork or photo.',
    'The result should feel like the same image, just with the character naturally integrated into it.',
    ...sharedRules,
  ].join(' ');
}

function describeCaptionStyle(captionStyle: CaptionStyle): string {
  switch (captionStyle) {
    case 'bitter-one-liner':
      return 'a blunt bitter one-liner';
    case 'lazy-complaint':
      return 'a lazy complaint';
    case 'smug-reaction':
      return 'a smug reaction';
    case 'anti-effort':
      return 'an anti-effort observation';
    case 'food-driven':
      return 'a food-motivated reaction';
    default:
      return 'a short deadpan caption';
  }
}

function characterifiedFilename(character: MascotCharacter): string {
  return character === 'nermal' ? 'nermalfied' : 'garfieldified';
}

function getCharacterImageOnlyMessage(character: MascotCharacter): string {
  return character === 'nermal' ? "Oh no, you've been Nermified!" : "Oh yeah, that's beautiful...";
}

function getCharacterOversizedTextWithImageMessage(character: MascotCharacter): string {
  return character === 'nermal'
    ? "Oh no, you've been Nermified! My commentary was too powerful, so I attached it."
    : 'The image is ready. My commentary exceeded my comfort level, so I attached it.';
}

function pickMascotCharacter(): MascotCharacter {
  return Math.random() < NERMAL_CHANCE ? 'nermal' : 'garfield';
}

function pickImageVariant(): ImageVariant {
  return weightedRandom<ImageVariant>([
    ['classic', 0.72],
    ['insert', 0.2],
    ['cursed', 0.08],
  ]);
}

function pickCaptionStyle(): CaptionStyle {
  return weightedRandom<CaptionStyle>([
    ['bitter-one-liner', 0.34],
    ['lazy-complaint', 0.24],
    ['smug-reaction', 0.22],
    ['anti-effort', 0.14],
    ['food-driven', 0.06],
  ]);
}

function weightedRandom<T>(entries: Array<[T, number]>): T {
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const roll = Math.random() * totalWeight;

  let runningWeight = 0;
  for (const [value, weight] of entries) {
    runningWeight += weight;
    if (roll <= runningWeight) {
      return value;
    }
  }

  return entries[entries.length - 1][0];
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
    character: MascotCharacter;
  }
): Promise<void> {
  const { garfieldText, garfieldImage, character } = payload;

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
      content: getCharacterOversizedTextWithImageMessage(character),
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
      content: getCharacterImageOnlyMessage(character),
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
    character: MascotCharacter;
  }
): Promise<void> {
  const { garfieldText, garfieldImage, embedTitle, character } = payload;

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
      content: getCharacterImageOnlyMessage(character),
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
    .setFooter({ text: 'Approved by Garfield' });
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
