import { AttachmentBuilder, Message } from 'discord.js';
import { Command } from '../../../types/Command';
import { waitForMessageUnfurl } from '../../../utils/messageImages';
import { startTypingKeepalive } from '../comic/typingKeepalive';
import { pickCaptionStyle, pickCharacterVariant, variantFromDirection } from './character';
import { renderGarfieldEdit } from './imageEditor';
import { getRecentLenses, recordLens } from './lenses';
import { editGarfieldPlan, GarfieldEditRequest, planGarfieldEdit } from './planner';
import { replyWithEmbedMode, replyWithStandardMode } from './reply';
import { extractImproveSource, mergeImproveSources } from './sourceExtractor';
import { mascotifyText } from './textGeneration';
import { GARFIELD_MESSAGES, ImproveSource } from './types';
import { describeModerationBlock, isModerationBlocked, normalizeExtractedText } from './utils';

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

    // With an image, words after the command steer the edit instead of being treated as source material.
    const direction = source.imageUrl ? normalizeExtractedText(args.join(' ')) : undefined;
    const sourceText = direction ? replySource?.text : source.text;
    const variant = variantFromDirection(direction) ?? pickCharacterVariant();
    const stopTyping = startTypingKeepalive(
      () => channel.sendTyping(),
      undefined,
      (error) => console.warn('Failed to refresh .garfield typing indicator:', error)
    );

    try {
      let mascotText: string | undefined;
      let mascotImage: AttachmentBuilder | undefined;

      if (source.imageUrl) {
        const edit = await editImage(
          { imageUrl: source.imageUrl, text: sourceText, direction, variant },
          source.imageFilename,
          message.guildId ?? message.channelId
        );
        if (edit && 'image' in edit) {
          mascotImage = edit.image;
          mascotText = edit.caption;
        } else if (edit && !sourceText) {
          await message.reply(GARFIELD_MESSAGES.imageBlocked);
          return;
        }
      }

      // Text-only input, or the image edit failed and there is still text to riff on.
      if (sourceText && !mascotImage) {
        try {
          mascotText = await mascotifyText({
            sourceText,
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

async function editImage(
  request: GarfieldEditRequest,
  originalFilename: string | undefined,
  lensScope: string
): Promise<ImageEditResult | undefined> {
  try {
    const {
      sourceBrief,
      rolledLens,
      pitches,
      plan: firstPlan,
    } = await planGarfieldEdit(request, getRecentLenses(lensScope));
    const blockedPremises: string[] = [];
    let plan = firstPlan;

    for (let attempt = 1; attempt <= MAX_RENDER_ATTEMPTS; attempt++) {
      const lensNote = plan.lens === rolledLens ? plan.lens : `${plan.lens}, rolled ${rolledLens}`;
      console.log(`.garfield plan (${request.variant}, ${lensNote}, text ${plan.textPolicy}): ${plan.premise}`);

      try {
        const image = await renderGarfieldEdit({
          imageUrl: request.imageUrl,
          originalFilename,
          variant: request.variant,
          plan,
          sourceBrief,
        });
        recordLens(lensScope, plan.lens);
        return { image, caption: plan.caption.trim() || undefined };
      } catch (error) {
        if (!isModerationBlocked(error)) throw error;

        console.warn(`.garfield render blocked by image moderation: ${describeModerationBlock(error)}`);
        blockedPremises.push(plan.premise);
        if (attempt === MAX_RENDER_ATTEMPTS) return { blocked: true };

        plan = await editGarfieldPlan(request, { sourceBrief, rolledLens, pitches, blockedPremises });
      }
    }
  } catch (error) {
    console.error('Failed to mascot-ify image:', error);
  }

  return undefined;
}

export default command;
