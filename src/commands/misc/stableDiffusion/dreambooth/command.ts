import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import got from 'got';

import { Command } from '../../../../types/Command';
import { sdModels } from '../../../../utils/constants';
import { getRandomEmotePath } from '../../../../utils/files';

import type { SdDefaultModels } from '../../../../types/Constants';
import type { DreamboothResponse, DreamboothRetry } from '../../../../types/StableDiffusion';

const command: Command = {
  name: 'SDText2Img',
  description: 'Generate art from text using Stable Diffusion',
  invocations: ['art', 'a', 'sd'],
  enabled: true,
  args: true,
  usage: '[prompt]',
  async execute(message, args) {
    const prompt = args.join(' ');

    // First, send the message with the buttons
    const buttonModelList = await message.channel.send({
      content: 'Choose a model:',
      components: generateModelButtonRows(),
    });

    try {
      // Wait for the button interaction
      const interaction = await buttonModelList.awaitMessageComponent({
        filter: (i: ButtonInteraction) => {
          // Check if the button is not 'custom' before deferring
          if (i.customId !== 'custom') {
            i.deferUpdate();
          }
          return i.user.id === message.author.id && i.isButton();
        },
        componentType: ComponentType.Button,
        time: 30000,
      });

      // Process the interaction
      let modelId = interaction.customId;
      const isCustomModel = modelId === 'custom';
      const isRandomModel = modelId === 'random';

      if (isCustomModel) {
        modelId = await collectCustomModelId(interaction);
      } else if (isRandomModel) {
        const nonRandomModels = sdModels.filter((model) => model.model !== 'random');
        const randomModel = nonRandomModels[Math.floor(Math.random() * nonRandomModels.length)];
        modelId = randomModel.model;
      }

      // remove the buttons
      if (buttonModelList.deletable) buttonModelList.delete();

      // attempt to display response
      const { isNsfwImageRespErr, imgRespPath, isMessageContentNSFW } = await getStableDiffusionData(prompt, modelId);

      if (isNsfwImageRespErr) {
        message.channel.send({
          content: `**NSFW checker API is down, click at your own risk!** [${modelId}]`,
          files: [
            {
              name: 'SPOILER_FILE.png',
              attachment: imgRespPath,
            },
          ],
        });
      } else if (isMessageContentNSFW) {
        message.channel.send({
          content: `-**NSFW** [${modelId}]-`,
          files: [
            {
              name: 'SPOILER_FILE.png',
              attachment: imgRespPath,
            },
          ],
        });
      } else {
        message.channel.send({ files: [imgRespPath], content: `[${modelId}]` });
      }
    } catch (err: any) {
      message.channel.send({
        content: `There was a problem generating your image. ${err}`,
        files: [await getRandomEmotePath()],
      });
    }
  },
};

const generateModelButtonRows = () => {
  const modelChunks: SdDefaultModels[][] = sdModels.reduce((resultArray, item, index) => {
    const chunkIndex = Math.floor(index / 5); // 5 is the button and row limit

    if (!resultArray[chunkIndex]) {
      resultArray[chunkIndex] = []; // Start a new chunk
    }

    resultArray[chunkIndex].push(item);

    return resultArray;
  }, []);

  return modelChunks.map((chunk) => {
    const row = new ActionRowBuilder<ButtonBuilder>();
    chunk.forEach((model) => {
      row.addComponents(new ButtonBuilder().setCustomId(model.model).setLabel(model.model).setStyle(model.buttonStyle));
    });
    return row;
  });
};

const collectCustomModelId = async (interaction: ButtonInteraction): Promise<string> => {
  const modalModelId = 'CustomModelID';
  const modal = new ModalBuilder().setCustomId('CustomModelPrompt').setTitle('Custom Model Id');

  const customPromptInput = new TextInputBuilder()
    .setCustomId(modalModelId)
    .setLabel('Enter your custom model id')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const modelActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(customPromptInput);

  // Add inputs to the modal
  modal.addComponents(modelActionRow);

  // Show the modal to the user
  await interaction.showModal(modal);

  try {
    const modalSubmitInteraction = await interaction.awaitModalSubmit({
      time: 60000,
      filter: (i) => i.customId === 'CustomModelPrompt' && i.user.id === interaction.user.id,
    });

    // Extract and return the value from the modal
    const customModelId = modalSubmitInteraction.fields.getTextInputValue(modalModelId);
    await modalSubmitInteraction.deferUpdate(); // Acknowledge the modal submission
    return customModelId;
  } catch (err) {
    throw new Error(`Failed to process custom model text from modal ${JSON.stringify(err)}`);
  }
};

const getStableDiffusionData = async (prompt: string, model: string) => {
  let sdImgResp: DreamboothResponse | DreamboothRetry = await got
    .post('https://modelslab.com/api/v4/dreambooth', {
      headers: {
        'Content-Type': 'application/json',
      },
      json: {
        key: process.env.stableDiffusion,
        prompt,
        channel: 'dreambooth',
        enhance_prompt: 'yes',
        guidance_scale: 7.5,
        height: 512,
        width: 512,
        model_id: model,
        samples: '1',
        seed: null,
        steps: 30,
        track_id: null,
        webhook: null,
      },
    })
    .json();

  let hasRetryFailed = false;
  if (sdImgResp?.status == 'processing') {
    const retryResponse = await handleProcessingImg(sdImgResp.id);
    if (retryResponse?.output?.[0]?.length > 0) {
      sdImgResp = retryResponse;
    } else hasRetryFailed = true;
  }

  if (sdImgResp?.status === 'failed' || sdImgResp?.status === 'error' || hasRetryFailed) {
    throw new Error(
      JSON.stringify(
        hasRetryFailed
          ? 'Request timed out'
          : (sdImgResp as any)?.messege
          ? (sdImgResp as any)?.messege
          : 'Processing image failed'
      )
    );
  }

  const imgRespPath = sdImgResp.output[0];
  const nsfwImageResp: { has_nsfw_concept: boolean[]; status: 'error' } = await got
    .post('https://modelslab.com/api/v3/nsfw_image_check', {
      headers: {
        'Content-Type': 'application/json',
      },
      json: {
        key: process.env.stableDiffusion,
        init_image: imgRespPath,
      },
    })
    .json();

  const isNsfwImageRespErr = nsfwImageResp?.status === 'error';
  const isMessageContentNSFW = nsfwImageResp?.has_nsfw_concept ? nsfwImageResp?.has_nsfw_concept[0] : true;
  return { imgRespPath, isNsfwImageRespErr, isMessageContentNSFW };
};

const handleProcessingImg = async (imgId: number) => {
  try {
    return await retryForProcessedImg(imgId);
  } catch (error) {
    return null;
  }
};

const retryForProcessedImg = async (imgId: number, delays: number[] = [5, 10, 15, 30, 45, 60]) => {
  const retries = delays.length;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response: DreamboothRetry = await got
        .post(`https://modelslab.com/api/v3/dreambooth/fetch/${imgId}`, {
          headers: {
            'Content-Type': 'application/json',
          },
          json: {
            key: process.env.stableDiffusion,
            id: imgId,
          },
        })
        .json();
      if (response.status === 'success') {
        return response;
      }
    } catch (error) {
      if (attempt === retries - 1) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, delays[attempt] * 1000));
  }
  throw new Error('API call failed after maximum retries');
};

export default command;
