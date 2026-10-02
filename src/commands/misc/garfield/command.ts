import { AttachmentBuilder, Message } from 'discord.js';
import { Command } from '../../../types/Command';
import { waitForMessageUnfurl } from '../../../utils/messageImages';
import { startTypingKeepalive } from '../comic/typingKeepalive';
import { pickCaptionStyle, pickCharacterVariant } from './character';
import { renderGarfieldEdit } from './imageEditor';
import { editGarfieldPlan, planGarfieldEdit } from './planner';
import { replyWithEmbedMode, replyWithStandardMode } from './reply';
import { extractImproveSource, mergeImproveSources } from './sourceExtractor';
import { mascotifyText } from './textGeneration';
import { CharacterVariant, GARFIELD_MESSAGES, ImproveSource } from './types';
import { describeModerationBlock, isModerationBlocked } from './utils';

const command: Command = {
  name: 'Garfield',
  description: 'Garfield-ifies text or an image from the command or a replied-to message.',
  invocations: ['garfield'],
  args: false,
  enabled: true,
  usage: '.garfield [text] [image] — or reply to a message with .garfield',

  async execute(message: Message, args: string[]) {
    const channel = message.channel;
    if (!channel.isSendable()) return;

    const ownMessage = await waitForMessageUnfurl(message);
    const ownSource = extractImproveSource(ownMessage, args.join(' ').trim());
    let replySource: ImproveSource | undefined;

    if (message.reference?.messageId) {
      try {
        const repliedMessage = await waitForMessageUnfurl(await message.fetchReference());
        replySource = extractImproveSource(repliedMessage);
      } catch (error) {
        console.error('Failed to fetch replied-to message for .garfield:', error);
        if (!ownSource.imageUrl && !ownSource.text) {
          await message.reply(GARFIELD_MESSAGES.unreadableReply);
          return;
        }
      }
    }

    const source = mergeImproveSources(ownSource, replySource);

    if (!source.imageUrl && !source.text) {
      await message.reply(GARFIELD_MESSAGES.noInput);
      return;
    }

    const variant = pickCharacterVariant();
    const stopTyping = startTypingKeepalive(
      () => channel.sendTyping(),
      undefined,
      (error) => console.warn('Failed to refresh .garfield typing indicator:', error)
    );

    try {
      let mascotText: string | undefined;
      let mascotImage: AttachmentBuilder | undefined;

      if (source.imageUrl) {
        const edit = await editImage(source, variant);
        if (edit && 'image' in edit) {
          mascotImage = edit.image;
          mascotText = edit.caption;
        } else if (edit && !source.text) {
          await message.reply(GARFIELD_MESSAGES.imageBlocked);
          return;
        }
      }

      // Text-only input, or the image edit failed and there is still text to riff on.
      if (source.text && !mascotImage) {
        try {
          mascotText = await mascotifyText({
            sourceText: source.text,
            isAccompanyingImage: false,
            variant,
            captionStyle: pickCaptionStyle(),
          });
        } catch (error) {
          console.error('Failed to mascot-ify text:', error);
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
    } finally {
      stopTyping();
    }
  },
};

type ImageEditResult = { image: AttachmentBuilder; caption?: string } | { blocked: true };

const MAX_RENDER_ATTEMPTS = 2;

async function editImage(source: ImproveSource, variant: CharacterVariant): Promise<ImageEditResult | undefined> {
  if (!source.imageUrl) return undefined;
  const imageUrl = source.imageUrl;

  try {
    const { sourceBrief, pitches, plan: firstPlan } = await planGarfieldEdit({ imageUrl, text: source.text, variant });
    const blockedPremises: string[] = [];
    let plan = firstPlan;

    for (let attempt = 1; attempt <= MAX_RENDER_ATTEMPTS; attempt++) {
      console.log(`.garfield plan (${variant}, ${plan.mechanism}): ${plan.premise}`);

      try {
        const image = await renderGarfieldEdit({
          imageUrl,
          originalFilename: source.imageFilename,
          variant,
          plan,
          sourceBrief,
        });
        return { image, caption: plan.caption.trim() || undefined };
      } catch (error) {
        if (!isModerationBlocked(error)) throw error;

        console.warn(`.garfield render blocked by image moderation: ${describeModerationBlock(error)}`);
        blockedPremises.push(plan.premise);
        if (attempt === MAX_RENDER_ATTEMPTS) return { blocked: true };

        plan = await editGarfieldPlan({ imageUrl, text: source.text, variant, sourceBrief, pitches, blockedPremises });
      }
    }
  } catch (error) {
    console.error('Failed to mascot-ify image:', error);
  }

  return undefined;
}

export default command;
