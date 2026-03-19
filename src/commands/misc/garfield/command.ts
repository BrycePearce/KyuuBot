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
const CURSED_CHANCE = 0.08;

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
type CaptionStyle = 'bitter-one-liner' | 'lazy-complaint' | 'smug-reaction' | 'anti-effort' | 'food-driven';
type ImageFlavor = 'normal' | 'cursed';

type ImageInsertionMode = 'reinterpret-subject' | 'interact-with-object' | 'add-to-scene' | 'observer';

type SceneFocusStrength = 'clear-single-subject' | 'shared-focus' | 'diffuse-scene';
type SubjectType = 'person' | 'animal' | 'object' | 'food' | 'statue' | 'architecture' | 'none' | 'multiple';

type ImagePlan = {
  summary: string;
  hasClearMainSubject: boolean;
  sceneFocusStrength: SceneFocusStrength;
  subjectType: SubjectType;
  mainSubjectDescription: string;
  shouldInteractWithObject: boolean;
  interactionObject: string;
  interactionAction: string;
  insertionMode: ImageInsertionMode;
  placement: string;
  pose: string;
  expression: string;
  medium: string;
  material: string;
  abstractionLevel: string;
  preserve: string[];
  styleNotes: string[];
  riskNotes: string[];
};

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

    const imageFlavor = pickImageFlavor();
    const character = imageFlavor === 'cursed' ? 'garfield' : pickMascotCharacter();
    const captionStyle = pickCaptionStyle();

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
            imageFlavor,
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
            imageFlavor,
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
          imageFlavor,
        });
        return;
      }

      await replyWithStandardMode(message, {
        garfieldText: mascotText,
        garfieldImage: mascotImage,
        character,
        imageFlavor,
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
  imageFlavor,
}: {
  sourceText: string;
  isAccompanyingImage: boolean;
  character: MascotCharacter;
  captionStyle: CaptionStyle;
  imageFlavor: ImageFlavor;
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
          imageFlavor,
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
          imageFlavor,
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
  imageFlavor,
}: {
  imageUrl: string;
  originalFilename?: string;
  character: MascotCharacter;
  imageFlavor: ImageFlavor;
}): Promise<AttachmentBuilder> {
  const imageRes = await fetch(imageUrl);

  if (!imageRes.ok) {
    throw new Error(`Failed to fetch source image: ${imageRes.status} ${imageRes.statusText}`);
  }

  const imageArrayBuffer = await imageRes.arrayBuffer();
  const originalBuffer = Buffer.from(imageArrayBuffer);

  const normalizedBuffer = await normalizeSourceImage(originalBuffer);
  const inputFilename = ensureExtension(originalFilename, DEFAULT_IMAGE_TYPE);

  const plan = await planMascotImageEdit({
    normalizedBuffer,
    character,
    imageFlavor,
  });

  const prompt = buildPlannedImageEditPrompt({
    character,
    imageFlavor,
    plan,
  });

  const imageResponse = await openaiClient.images.edit({
    model: 'gpt-image-1.5',
    image: new File([normalizedBuffer], inputFilename, { type: DEFAULT_IMAGE_TYPE }),
    prompt,
    size: '1024x1024',
    output_format: 'png',
    quality: 'high',
  });

  const base64Image = imageResponse.data?.[0]?.b64_json;

  if (!base64Image) {
    throw new Error('No edited image returned from image model.');
  }

  const outputBuffer = Buffer.from(base64Image, 'base64');

  return new AttachmentBuilder(outputBuffer, {
    name: `${characterifiedFilename(character, imageFlavor)}.png`,
  });
}

async function planMascotImageEdit({
  normalizedBuffer,
  character,
  imageFlavor,
}: {
  normalizedBuffer: Buffer;
  character: MascotCharacter;
  imageFlavor: ImageFlavor;
}): Promise<ImagePlan> {
  const response = await openaiClient.responses.create({
    model: 'gpt-5-chat-latest',
    input: [
      {
        role: 'system',
        content: [
          'You are an image edit planner for a Garfield-themed image editing command.',
          'Analyze the provided image and decide the most composition-preserving way to integrate the requested character.',
          'You must distinguish between these cases:',
          '1. If there is obvious food or an object Garfield should naturally interact with, prefer interaction.',
          '2. If there is a clear main subject, prefer reinterpreting that subject as Garfield while preserving material, medium, structure, pose, abstraction, and composition.',
          '3. If there is no clear main subject, add Garfield into the scene in the same material, medium, style, abstraction level, and prominence as surrounding elements.',
          'If the image contains statues, carvings, paintings, drawings, toys, posters, pixel art, or other stylized objects, Garfield should be adapted into that exact kind of thing rather than inserted as a normal cartoon cat.',
          'The goal is to preserve the original composition as much as possible.',
          'Be specific about material, medium, abstraction level, focus strength, and what visual elements should be preserved.',
          'Return strict JSON only.',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: [
              `Character: ${character}`,
              `Flavor: ${imageFlavor}`,
              'Return JSON with exactly these keys:',
              'summary, hasClearMainSubject, sceneFocusStrength, subjectType, mainSubjectDescription, shouldInteractWithObject, interactionObject, interactionAction, insertionMode, placement, pose, expression, medium, material, abstractionLevel, preserve, styleNotes, riskNotes',
              'Valid sceneFocusStrength values: clear-single-subject, shared-focus, diffuse-scene',
              'Valid subjectType values: person, animal, object, food, statue, architecture, none, multiple',
              'Valid insertionMode values: reinterpret-subject, interact-with-object, add-to-scene, observer',
              'If there is no clear main subject, do not force one.',
              'If multiple similar objects are present with no single focal subject, Garfield should be added with similar prominence rather than becoming the dominant subject.',
              'If no object interaction is appropriate, return empty strings for interactionObject and interactionAction.',
              'For statues, carvings, sculptures, paintings, drawings, murals, or other stylized media, explicitly identify the material and medium so Garfield can be adapted into them.',
              'If cursed flavor is requested, still preserve composition and medium as much as possible unless a Dracula-themed shift genuinely helps.',
            ].join('\n'),
          },
          {
            type: 'input_image',
            image_url: `data:${DEFAULT_IMAGE_TYPE};base64,${normalizedBuffer.toString('base64')}`,
            detail: 'high',
          },
        ],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'garfield_image_plan',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            summary: { type: 'string' },
            hasClearMainSubject: { type: 'boolean' },
            sceneFocusStrength: {
              type: 'string',
              enum: ['clear-single-subject', 'shared-focus', 'diffuse-scene'],
            },
            subjectType: {
              type: 'string',
              enum: ['person', 'animal', 'object', 'food', 'statue', 'architecture', 'none', 'multiple'],
            },
            mainSubjectDescription: { type: 'string' },
            shouldInteractWithObject: { type: 'boolean' },
            interactionObject: { type: 'string' },
            interactionAction: { type: 'string' },
            insertionMode: {
              type: 'string',
              enum: ['reinterpret-subject', 'interact-with-object', 'add-to-scene', 'observer'],
            },
            placement: { type: 'string' },
            pose: { type: 'string' },
            expression: { type: 'string' },
            medium: { type: 'string' },
            material: { type: 'string' },
            abstractionLevel: { type: 'string' },
            preserve: {
              type: 'array',
              items: { type: 'string' },
            },
            styleNotes: {
              type: 'array',
              items: { type: 'string' },
            },
            riskNotes: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: [
            'summary',
            'hasClearMainSubject',
            'sceneFocusStrength',
            'subjectType',
            'mainSubjectDescription',
            'shouldInteractWithObject',
            'interactionObject',
            'interactionAction',
            'insertionMode',
            'placement',
            'pose',
            'expression',
            'medium',
            'material',
            'abstractionLevel',
            'preserve',
            'styleNotes',
            'riskNotes',
          ],
        },
      },
    },
  });

  const rawPlan = response.output_text?.trim();

  if (!rawPlan) {
    throw new Error('No image plan returned from planner.');
  }

  return JSON.parse(rawPlan) as ImagePlan;
}

function buildTextSystemPrompt({
  character,
  captionStyle,
  isVeryShortInput,
  imageFlavor,
}: {
  character: MascotCharacter;
  captionStyle: CaptionStyle;
  isVeryShortInput: boolean;
  imageFlavor: ImageFlavor;
}): string {
  if (imageFlavor === 'cursed') {
    return [
      'You are Garfield, but specifically Dracula-themed Garfield.',
      'Write a short caption as Garf-ula would say it.',
      'The voice should still feel like Garfield first: lazy, smug, dry, unimpressed, selfish, food-motivated.',
      'Add a light Dracula flavor: nocturnal, dramatic, mildly vampiric, but still funny and readable.',
      'Do not become full gothic roleplay or parody prose.',
      'Keep it concise and punchy.',
      'Use at most 2 short lines.',
      'Prefer one clean joke.',
      'Do not explain the joke.',
      'Do not wrap the answer in quotes.',
      'Do not use emojis or hashtags.',
      `Caption shape: ${describeCaptionStyle(captionStyle)}.`,
      isVeryShortInput
        ? 'If the source text is very short, make a stronger joke rather than lightly paraphrasing it.'
        : 'Keep the original meaning or vibe loosely recognizable only if it helps the joke.',
    ].join(' ');
  }

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
  imageFlavor,
}: {
  sourceText: string;
  isAccompanyingImage: boolean;
  character: MascotCharacter;
  captionStyle: CaptionStyle;
  isVeryShortInput: boolean;
  imageFlavor: ImageFlavor;
}): string {
  const subjectLabel = imageFlavor === 'cursed' ? 'Garf-ula' : character === 'nermal' ? 'Nermal' : 'Garfield';

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

function buildPlannedImageEditPrompt({
  character,
  imageFlavor,
  plan,
}: {
  character: MascotCharacter;
  imageFlavor: ImageFlavor;
  plan: ImagePlan;
}): string {
  const characterDescription = getCharacterDescription(character, imageFlavor);
  const preserveInstruction = plan.preserve.length
    ? `Preserve these specific elements wherever possible: ${plan.preserve.join('; ')}.`
    : 'Preserve the original composition and visible details as much as possible.';
  const styleInstruction = plan.styleNotes.length
    ? `Match the original style and medium: ${plan.styleNotes.join('; ')}.`
    : 'Match the original style and medium exactly.';
  const riskInstruction = plan.riskNotes.length
    ? `Avoid these mistakes: ${plan.riskNotes.join('; ')}.`
    : 'Avoid changing the image more than necessary.';

  const cursedInstruction =
    imageFlavor === 'cursed'
      ? [
          'Use a Garfield Dracula theme.',
          'Garfield should read clearly as Dracula-themed Garfield: subtle cape, fangs, gothic attitude, possibly moody lighting or tasteful spooky accents if they fit.',
          'Even in cursed mode, preserve the original medium, structure, and composition as much as possible.',
          'Do not turn the image into a completely different scene unless necessary.',
        ].join(' ')
      : 'Keep the result tasteful, naturally integrated, and as composition-preserving as possible.';

  const mediumMaterialInstruction = [
    `Medium: ${plan.medium}.`,
    `Material: ${plan.material}.`,
    `Abstraction level: ${plan.abstractionLevel}.`,
  ].join(' ');

  if (plan.insertionMode === 'interact-with-object' && plan.shouldInteractWithObject) {
    return [
      `Edit this image so ${characterDescription} is naturally integrated into the scene.`,
      `Do not insert a generic separate cartoon unless the original image itself is already in that style.`,
      `Have the character interact with ${plan.interactionObject} by ${plan.interactionAction}.`,
      `Placement: ${plan.placement}.`,
      `Pose: ${plan.pose}.`,
      `Expression: ${plan.expression}.`,
      mediumMaterialInstruction,
      'The character must match the same medium, material, visual treatment, and abstraction level as the surrounding image.',
      'Keep the rest of the image as unchanged as possible.',
      'Preserve the original framing, crop, background, environment, camera angle, props, and layout.',
      preserveInstruction,
      styleInstruction,
      riskInstruction,
      cursedInstruction,
    ].join(' ');
  }

  if (plan.insertionMode === 'reinterpret-subject') {
    return [
      `Reinterpret the main subject as ${characterDescription}.`,
      `Main subject description: ${plan.mainSubjectDescription}.`,
      'Do not insert a separate Garfield character into the scene.',
      'Instead, transform the existing subject itself into a Garfield version of that same thing.',
      'Preserve the original material, medium, structure, silhouette logic, abstraction level, pose, prominence, and composition.',
      'If the subject is a statue, carving, sculpture, painting, toy, drawing, mural, or stylized object, Garfield must become that same kind of object rather than a normal standalone cartoon cat.',
      `Pose to preserve: ${plan.pose}.`,
      `Expression target: ${plan.expression}.`,
      mediumMaterialInstruction,
      'The result should feel like the same subject in the same image, only reinterpreted as Garfield.',
      'Do not redesign the whole scene.',
      'Do not make Garfield cleaner, more colorful, or more polished than the source style unless the source already is.',
      preserveInstruction,
      styleInstruction,
      riskInstruction,
      cursedInstruction,
    ].join(' ');
  }

  return [
    `Add ${characterDescription} naturally into the image.`,
    'Do not insert a generic separate cartoon unless the source image itself is already that kind of cartoon.',
    'Garfield must be adapted into the same medium, material, abstraction level, and style as the surrounding scene.',
    'If there is no clear main subject or the scene has shared/diffuse focus, Garfield should have similar prominence to nearby elements rather than becoming the dominant focal point.',
    'If the scene contains statues, carvings, sculptures, signs, paintings, drawings, toys, props, or repeating objects, Garfield should be added as that same kind of thing.',
    `Placement: ${plan.placement}.`,
    `Pose: ${plan.pose}.`,
    `Expression: ${plan.expression}.`,
    mediumMaterialInstruction,
    'Keep the original scene as intact as possible.',
    'The character may be relatively subtle or minimally prominent if that better preserves the image and composition.',
    'Do not add random extra characters.',
    'Preserve crop, framing, lighting, background, and scene layout.',
    preserveInstruction,
    styleInstruction,
    riskInstruction,
    cursedInstruction,
  ].join(' ');
}

function getCharacterDescription(character: MascotCharacter, imageFlavor: ImageFlavor): string {
  if (imageFlavor === 'cursed') {
    return [
      'Garfield as Dracula',
      'the classic orange tabby Garfield with black stripes, a round face, half-lidded eyes, and a smug lazy expression',
      'reinterpreted through the source image medium and material with tasteful gothic Dracula details',
    ].join(', ');
  }

  if (character === 'nermal') {
    return [
      'Nermal',
      'the small cute gray cat from Garfield, with soft gray fur, big expressive eyes, a rounded face, and an adorably smug expression',
      'reinterpreted through the source image medium and material',
    ].join(', ');
  }

  return [
    'Garfield',
    'the classic orange tabby cat with black stripes, a round face, half-lidded eyes, and a smug lazy expression',
    'reinterpreted through the source image medium and material',
  ].join(', ');
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

function characterifiedFilename(character: MascotCharacter, imageFlavor: ImageFlavor): string {
  if (imageFlavor === 'cursed') return 'garf-ulad';
  return character === 'nermal' ? 'nermalfied' : 'garfieldified';
}

function getCharacterImageOnlyMessage(character: MascotCharacter, imageFlavor: ImageFlavor): string {
  if (imageFlavor === 'cursed') return "You have been Garf-ula'd!";
  return character === 'nermal' ? "Oh no, you've been Nermified!" : "Oh yeah, that's beautiful...";
}

function getCharacterOversizedTextWithImageMessage(character: MascotCharacter, imageFlavor: ImageFlavor): string {
  if (imageFlavor === 'cursed') {
    return "You have been Garf-ula'd! My commentary rose from the crypt, so I attached it.";
  }

  return character === 'nermal'
    ? "Oh no, you've been Nermified! My commentary was too powerful, so I attached it."
    : 'The image is ready. My commentary exceeded my comfort level, so I attached it.';
}

function getEmbedFooterText(character: MascotCharacter, imageFlavor: ImageFlavor): string {
  if (imageFlavor === 'cursed') return 'Approved by Garf-ula';
  return character === 'nermal' ? 'Approved by Nermal' : 'Approved by Garfield';
}

function pickMascotCharacter(): MascotCharacter {
  return Math.random() < NERMAL_CHANCE ? 'nermal' : 'garfield';
}

function pickImageFlavor(): ImageFlavor {
  return Math.random() < CURSED_CHANCE ? 'cursed' : 'normal';
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
    imageFlavor: ImageFlavor;
  }
): Promise<void> {
  const { garfieldText, garfieldImage, character, imageFlavor } = payload;

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
      content: getCharacterOversizedTextWithImageMessage(character, imageFlavor),
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
      content: getCharacterImageOnlyMessage(character, imageFlavor),
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
    imageFlavor: ImageFlavor;
  }
): Promise<void> {
  const { garfieldText, garfieldImage, embedTitle, character, imageFlavor } = payload;

  const embeds: EmbedBuilder[] = [];
  const files: AttachmentBuilder[] = [];

  if (garfieldText) {
    embeds.push(buildGarfieldEmbed(garfieldText, embedTitle, character, imageFlavor));
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
      content: getCharacterImageOnlyMessage(character, imageFlavor),
      files,
    });
    return;
  }

  await message.reply({
    embeds,
    files,
  });
}

function buildGarfieldEmbed(
  text: string,
  title: string | undefined,
  character: MascotCharacter,
  imageFlavor: ImageFlavor
): EmbedBuilder {
  const prefix = imageFlavor === 'cursed' ? "Garf-ula'd" : 'Garfieldified';
  const safeTitle = title ? truncateEmbedTitle(`${prefix}: ${title}`) : prefix;
  const safeDescription = truncateEmbedDescription(text);

  return new EmbedBuilder()
    .setTitle(safeTitle)
    .setDescription(safeDescription)
    .setColor(GARFIELD_ORANGE)
    .setFooter({ text: getEmbedFooterText(character, imageFlavor) });
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
