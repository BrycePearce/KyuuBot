import got from 'got';
import { Command } from '../../../../types/Command';

import type { SDTextToImg } from '../../../../types/StableDiffusion';
import { getRandomEmotePath } from '../../../../utils/files';

enum ImageKeys {
  small = 'sm',
  medium = 'md',
  large = 'lg',
}

const command: Command = {
  name: 'SDText2Img',
  description: 'Generate art from text using Stable Diffusion',
  invocations: ['art', 'a'],
  enabled: true,
  args: true,
  usage: '[size] [model] [prompt]',
  async execute(message, args) {
    try {
      const modifiedArgs = parseArgs(args);
      const { model, prompt, size } = extractArgs(modifiedArgs);
      const sdImgResp: SDTextToImg = await got
        .post('https://stablediffusionapi.com/api/v3/text2img', {
          headers: {
            'Content-Type': 'application/json',
          },
          json: {
            key: process.env.stableDiffusion,
            prompt,
            negative_prompt: null,
            width: size.width,
            height: size.height,
            samples: '1',
            num_inference_steps: '20',
            safety_checker: 'no',
            enhance_prompt: 'yes',
            seed: null,
            guidance_scale: 7.5,
            multi_lingual: 'no',
            panorama: 'no',
            self_attention: 'no',
            upscale: 'no',
            embeddings_model: model, // what is model vs embeddings_model
            webhook: null,
            track_id: null,
          },
        })
        .json();

      if (sdImgResp?.status !== 'success') {
        const hasErr = sdImgResp?.status === 'error';
        throw new Error(JSON.stringify(hasErr ? sdImgResp : 'Processing image failed'));
      }

      const imgRespPath = sdImgResp?.output?.[0];
      const nsfwImageResp: { has_nsfw_concept: boolean[]; status: 'error' } = await got
        .post('https://stablediffusionapi.com/api/v3/nsfw_image_check', {
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

      if (isNsfwImageRespErr) {
        message.channel.send({
          content: '**NSFW checker API is down, click at your own risk!**',
          files: [
            {
              name: 'SPOILER_FILE.png',
              attachment: imgRespPath,
            },
          ],
        });
      } else if (isMessageContentNSFW) {
        message.channel.send({
          content: '-**NSFW**-',
          files: [
            {
              name: 'SPOILER_FILE.png',
              attachment: imgRespPath,
            },
          ],
        });
      } else {
        message.channel.send({ files: [imgRespPath] });
      }
    } catch (err) {
      message.channel.send({
        content: `There was a problem generating your image. ${err}`,
        files: [await getRandomEmotePath()],
      });
    }
  },
};

const parseArgs = (args: string[]) => {
  const initialArgs = args.slice(0, 2);
  const promptArg = args.slice(2).join(' ');
  const modifiedArray = [...initialArgs, promptArg];
  return modifiedArray;
};

const extractArgs = (args: string[]) => {
  // Find and handle size param
  const imgSizes: string[] = Object.values(ImageKeys);
  const sizeParamIndex = args.findIndex((arg) => imgSizes.includes(arg.toLowerCase()));
  const sizeParam = (args?.[sizeParamIndex] as ImageKeys) ?? ImageKeys.small;

  // Remove the size parameter from args if it exists
  if (sizeParamIndex !== -1) {
    args.splice(sizeParamIndex, 1);
  }

  // model will be the second-to-last item if it exists , undefined otherwise
  const modelParam = args.length > 1 ? args[args.length - 2] : null;

  // Prompt param should always be last
  const promptParam = args[args.length - 1];

  // For now assume a third parameter is the Embeddings model

  return { prompt: promptParam, size: getImgSize(sizeParam), model: modelParam };
};

const getImgSize = (size: ImageKeys) => {
  switch (size) {
    case 'md': {
      return { width: 720, height: 1080 };
    }
    case 'lg': {
      return { width: 1080, height: 1080 };
    }
    default: {
      return { width: 1024, height: 1024 };
    }
  }
};

export default command;
