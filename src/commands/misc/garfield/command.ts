import { AttachmentBuilder, Message } from 'discord.js';
import sharp from 'sharp';
import { Command } from '../../../types/Command';
import openaiClient from '../../../utils/clients/openaiClient';
import { characterifiedFilename, getCharacterName, pickCaptionStyle, pickCharacterVariant } from './character';
import { replyWithEmbedMode, replyWithStandardMode } from './reply';
import { extractImproveSource } from './sourceExtractor';
import { mascotifyText } from './textGeneration';
import { CharacterVariant, DEFAULT_IMAGE_TYPE, GARFIELD_MESSAGES, ImagePlan, MAX_IMAGE_DIMENSION } from './types';
import { ensureExtension } from './utils';

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

    const variant = pickCharacterVariant();
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
            variant,
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
            variant,
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
          variant,
        });
        return;
      }

      await replyWithStandardMode(message, {
        garfieldText: mascotText,
        garfieldImage: mascotImage,
        variant,
      });
    } catch (error) {
      console.error('Error running .garfield:', error);
      await message.reply(GARFIELD_MESSAGES.genericError);
    }
  },
};

async function mascotifyImage({
  imageUrl,
  originalFilename = 'source.png',
  variant,
}: {
  imageUrl: string;
  originalFilename?: string;
  variant: CharacterVariant;
}): Promise<AttachmentBuilder> {
  const imageRes = await fetch(imageUrl);

  if (!imageRes.ok) {
    throw new Error(`Failed to fetch source image: ${imageRes.status} ${imageRes.statusText}`);
  }

  const imageArrayBuffer = await imageRes.arrayBuffer();
  const originalBuffer = Buffer.from(imageArrayBuffer);

  const normalizedBuffer = await normalizeSourceImage(originalBuffer);
  const inputFilename = ensureExtension(originalFilename, DEFAULT_IMAGE_TYPE);

  const plan = await planMascotImageEdit({ normalizedBuffer, variant });
  const prompt = buildPlannedImageEditPrompt({ variant, plan });

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
    name: `${characterifiedFilename(variant)}.png`,
  });
}

async function planMascotImageEdit({
  normalizedBuffer,
  variant,
}: {
  normalizedBuffer: Buffer;
  variant: CharacterVariant;
}): Promise<ImagePlan> {
  const response = await openaiClient.responses.create({
    model: 'gpt-5-chat-latest',
    input: [
      {
        role: 'system',
        content: [
          'You are a comedy director for a Garfield-themed image editing command.',
          'Your job is to find the FUNNIEST way to insert the requested character into the provided image, staying true to their personality.',
          ...getCharacterPlanningContext(variant),
          'Analyze the image and identify the single funniest insertion opportunity.',
          'Do not default to the most natural or composition-safe option. Ask: what would make someone laugh when they see this?',
          'If no clean integration exists, commit to the bit — an absurd choice executed with confidence beats a boring safe one.',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: [
              'Analyze the image and return JSON with exactly these keys:',
              'sceneTransform, comedyConcept, comedyIntensity, insertionMode, targetElement, placement, pose, expression, medium, material, abstractionLevel, styleNotes, executionNotes',
              'sceneTransform: if instructed to transform the scene, describe the full thematic reskin here (color palette, lighting, atmosphere, art style). Otherwise empty string.',
              'comedyConcept: one sentence describing the specific funny idea (e.g. "the character\'s face replaces the meteor\'s surface as it smiles toward the dinosaurs")',
              'comedyIntensity: one of subtle, moderate, unhinged',
              'insertionMode: one of face-on-object, eating, reinterpret-subject, sitting-on, add-to-scene, observer',
              'targetElement: what in the image the character interacts with, replaces, or reacts to',
              'placement: where in the image the character appears',
              "pose: the character's body pose",
              "expression: the character's facial expression",
              'medium: the visual medium of the image (e.g. photograph, oil painting, pixel art, pencil sketch)',
              'material: the dominant material or texture of the target element',
              'abstractionLevel: how realistic vs stylized the image is',
              "styleNotes: array of notes about adapting the character to match the image's visual style while remaining recognizable",
              'executionNotes: array of specific instructions for pulling off this edit cleanly',
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
            sceneTransform: { type: 'string' },
            comedyConcept: { type: 'string' },
            comedyIntensity: { type: 'string', enum: ['subtle', 'moderate', 'unhinged'] },
            insertionMode: {
              type: 'string',
              enum: ['face-on-object', 'eating', 'reinterpret-subject', 'sitting-on', 'add-to-scene', 'observer'],
            },
            targetElement: { type: 'string' },
            placement: { type: 'string' },
            pose: { type: 'string' },
            expression: { type: 'string' },
            medium: { type: 'string' },
            material: { type: 'string' },
            abstractionLevel: { type: 'string' },
            styleNotes: { type: 'array', items: { type: 'string' } },
            executionNotes: { type: 'array', items: { type: 'string' } },
          },
          required: [
            'sceneTransform',
            'comedyConcept',
            'comedyIntensity',
            'insertionMode',
            'targetElement',
            'placement',
            'pose',
            'expression',
            'medium',
            'material',
            'abstractionLevel',
            'styleNotes',
            'executionNotes',
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

function buildPlannedImageEditPrompt({ variant, plan }: { variant: CharacterVariant; plan: ImagePlan }): string {
  const characterDescription = getCharacterDescription(variant);
  const styleInstruction = plan.styleNotes.length
    ? `Style adaptation: ${plan.styleNotes.join('; ')}.`
    : `Adapt the character into the image's visual style while keeping their iconic features recognizable.`;
  const executionInstruction = plan.executionNotes.length
    ? `Execution notes: ${plan.executionNotes.join('; ')}.`
    : 'Integrate cleanly without making the edit look pasted-in.';

  const identityInstruction = getIdentityInstruction(variant);

  const mediumInstruction = [
    `Render in the image's visual medium: ${plan.medium}.`,
    `Match the material/texture of the target: ${plan.material}.`,
    `Abstraction level: ${plan.abstractionLevel}.`,
  ].join(' ');

  const conceptLine = [
    plan.sceneTransform ? `Scene transformation: ${plan.sceneTransform}` : null,
    `Comedy concept: ${plan.comedyConcept}`,
  ]
    .filter(Boolean)
    .join(' ');

  if (plan.insertionMode === 'face-on-object') {
    return [
      conceptLine,
      `Place ${characterDescription}'s face on ${plan.targetElement}.`,
      `The object retains its shape, scale, and position in the scene — only its face or front surface becomes ${getCharacterName(variant)}.`,
      'The face should feel like it belongs on the object, not pasted on top of it.',
      `Expression: ${plan.expression}.`,
      mediumInstruction,
      identityInstruction,
      styleInstruction,
      executionInstruction,
      'Do not alter the rest of the scene.',
    ].join(' ');
  }

  if (plan.insertionMode === 'eating') {
    return [
      conceptLine,
      `Add ${characterDescription} eating or fixating on ${plan.targetElement}.`,
      `Placement: ${plan.placement}.`,
      `Pose: ${plan.pose}. Expression: ${plan.expression}.`,
      'The character should look genuinely invested — this is the most important thing in their world right now.',
      mediumInstruction,
      identityInstruction,
      styleInstruction,
      executionInstruction,
      'Keep the rest of the scene intact.',
    ].join(' ');
  }

  if (plan.insertionMode === 'reinterpret-subject') {
    return [
      conceptLine,
      `Transform ${plan.targetElement} into ${characterDescription}.`,
      'Do not insert a separate character. The existing subject itself becomes the character.',
      'Preserve the original pose, framing, and medium. Only the identity of the subject changes.',
      `Pose: ${plan.pose}. Expression: ${plan.expression}.`,
      mediumInstruction,
      identityInstruction,
      styleInstruction,
      executionInstruction,
    ].join(' ');
  }

  if (plan.insertionMode === 'sitting-on') {
    return [
      conceptLine,
      `Add ${characterDescription} lounging or sitting on ${plan.targetElement}.`,
      `Placement: ${plan.placement}.`,
      `Pose: ${plan.pose}. Expression: ${plan.expression}.`,
      'The character should look completely at home and unbothered by whatever is happening around them.',
      mediumInstruction,
      identityInstruction,
      styleInstruction,
      executionInstruction,
      'Keep the rest of the scene intact.',
    ].join(' ');
  }

  if (plan.insertionMode === 'observer') {
    return [
      conceptLine,
      `Add ${characterDescription} watching the scene from ${plan.placement}.`,
      `Pose: ${plan.pose}. Expression: ${plan.expression}.`,
      'The character is fully aware of the chaos but not participating.',
      mediumInstruction,
      identityInstruction,
      styleInstruction,
      executionInstruction,
      'Keep the rest of the scene intact.',
    ].join(' ');
  }

  // add-to-scene fallback
  return [
    conceptLine,
    `Add ${characterDescription} to the scene. Target: ${plan.targetElement}.`,
    `Placement: ${plan.placement}.`,
    `Pose: ${plan.pose}. Expression: ${plan.expression}.`,
    mediumInstruction,
    identityInstruction,
    styleInstruction,
    executionInstruction,
    'Keep the rest of the scene intact.',
  ].join(' ');
}

function getCharacterDescription(variant: CharacterVariant): string {
  switch (variant) {
    case 'garfula':
      return [
        'Garfield as Dracula',
        'the classic orange tabby Garfield with black stripes, a round face, half-lidded eyes, and a smug lazy expression',
        'reinterpreted through the source image medium and material with tasteful gothic Dracula details',
      ].join(', ');
    case 'nermal':
      return [
        'Nermal',
        'the small cute gray cat from Garfield, with soft gray fur, big expressive eyes, a rounded face, and an adorably smug expression',
        'reinterpreted through the source image medium and material',
      ].join(', ');
    case 'jon':
      return [
        'Jon Arbuckle',
        'a tall lanky man with dark swept hair, an earnest goofy expression, and dorky casual clothes',
        'reinterpreted through the source image medium and material',
      ].join(', ');
    case 'odie':
      return [
        'Odie',
        'the yellow dog from Garfield with a long floppy tongue, big dopey eyes, floppy ears, and an expression of pure unthinking happiness',
        'reinterpreted through the source image medium and material',
      ].join(', ');
    case 'himbo':
      return [
        'Himbo Garfield',
        'a buff muscular version of the classic orange tabby Garfield, with the same black stripes and round face but with an impressive physique, a huge friendly grin, and wide enthusiastic eyes',
        'reinterpreted through the source image medium and material',
      ].join(', ');
    default:
      return [
        'Garfield',
        'the classic orange tabby cat with black stripes, a round face, half-lidded eyes, and a smug lazy expression',
        'reinterpreted through the source image medium and material',
      ].join(', ');
  }
}

function getIdentityInstruction(variant: CharacterVariant): string {
  switch (variant) {
    case 'garfula':
      return 'Garfield must remain recognizable as Dracula-Garfield: orange tabby, black stripes, round face, half-lidded eyes, plus gothic/vampire accents (subtle cape, fangs). Adapt the rendering style but keep these features clear.';
    case 'nermal':
      return 'Nermal must remain recognizable: small gray cat, big expressive eyes, rounded face, adorably smug expression. Adapt the rendering style to match the image but do not lose these features.';
    case 'jon':
      return 'Jon must remain recognizable: tall lanky human, dark swept hair, earnest goofy expression, dorky clothes. Adapt the rendering style to match the image but do not lose these features.';
    case 'odie':
      return 'Odie must remain recognizable: yellow dog, long floppy tongue, big dopey eyes, floppy ears, expression of pure happiness. Adapt the rendering style to match the image but do not lose these features.';
    case 'himbo':
      return 'Himbo Garfield must remain recognizable: orange tabby, black stripes, round face, but with a clearly muscular build, a huge friendly smile, and wide enthusiastic eyes — not the usual half-lidded smug look. Adapt the rendering style to match the image but do not lose these features.';
    default:
      return 'Garfield must remain recognizable: orange tabby, black stripes, round face, half-lidded sleepy eyes, smug expression. Adapt the rendering style to match the image but do not lose these features.';
  }
}

function getCharacterPlanningContext(variant: CharacterVariant): string[] {
  switch (variant) {
    case 'garfula':
      return [
        'Character: Garfield as Dracula — lazy, food-obsessed, smug, selfish, deadpan, chronically unimpressed, secretly chaotic, with gothic vampire energy.',
        'Food is always the priority. Face-on-object works great for large inanimate things.',
        'Apply a gothic/Dracula twist to the comedy concept — keep the laziness and food obsession, but let the vampire energy color the execution.',
        'Transform the entire scene into a gothic/horror setting: dark stone, candlelight, creeping fog, muted desaturated palette, spooky atmosphere. Describe this in sceneTransform.',
      ];
    case 'nermal':
      return [
        'Character: Nermal — adorably smug, vain, self-satisfied, effortlessly cute, mildly annoying.',
        'Find scenes where smugly existing is funnier than participating. Being adorable in the wrong context is the joke.',
        'Transform the entire scene into a soft pastel world: rounded shapes, warm pastel colors, gentle diffused lighting, everything slightly precious and cute. Describe this in sceneTransform.',
      ];
    case 'jon':
      return [
        'Character: Jon Arbuckle — earnest, upbeat, oblivious, awkward, always slightly out of place, optimistic despite everything.',
        'Awkward presence beats natural presence. Jon being obliviously in the scene, not fitting in, is the joke.',
        'Transform the entire scene into the visual aesthetic of a mid-2000s sitcom: slightly flat lighting, generic suburban interiors bleeding in, the vibe of a show where nothing quite lands. Describe this in sceneTransform.',
      ];
    case 'odie':
      return [
        'Character: Odie — pure unthinking chaos energy, always happy, no idea what is happening, drool, running, tongue out.',
        'Lead with chaos and enthusiasm. Odie running through something, Odie in the background being ridiculous, Odie interacting with his tongue out.',
        'Transform the entire scene into loose cartoon chaos: exaggerated colors, wobbly outlines, motion lines, things slightly flying or melting, pure anarchic cartoon energy. Describe this in sceneTransform.',
      ];
    case 'himbo':
      return [
        'Character: Himbo Garfield — buff, muscular Garfield, sweet, enthusiastic, not very bright, thinks everything and everyone is amazing, loves working out.',
        'Find scenes where overwhelming positivity and flexing creates contrast — formal events, serious moments, mundane situations that become joyful by his presence.',
        'He fits in everywhere because he thinks he fits in everywhere.',
        'Transform the entire scene into a gym/motivational poster aesthetic: bold saturated colors, dramatic uplighting, everything looks powerful and inspiring. Describe this in sceneTransform.',
      ];
    default:
      return [
        'Character: Garfield — lazy, food-obsessed, smug, selfish, deadpan, chronically unimpressed, secretly chaotic.',
        'Food is always the priority. Face-on-object works great for large inanimate things.',
      ];
  }
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

export default command;
