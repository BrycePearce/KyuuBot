import got from 'got';
import yargs from 'yargs';
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
      const { model, prompt, size } = parseArgs(args);
      const sdImgResp: SDTextToImg = await got
        .post('https://stablediffusionapi.com/api/v3/text2img', {
          headers: {
            'Content-Type': 'application/json',
          },
          json: {
            key: process.env.stableDiffusion,
            prompt,
            negative_prompt:
              'painting, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, deformed, ugly, blurry, bad anatomy, bad proportions, extra limbs, cloned face, skinny, glitchy, double torso, extra arms, extra hands, mangled fingers, missing lips, ugly face, distorted face, extra legs',
            width: size.width,
            height: size.height,
            samples: '1',
            num_inference_steps: '30',
            seed: null,
            guidance_scale: 7.5,
            model_id: model ?? 'anything-v3', // what is model vs embeddings_model
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
  // Define known flags
  const knownFlags = ['-m', '-s'];

  // Find the index of the first known flag
  const firstFlagIndex = args.findIndex((word) => knownFlags.includes(word));

  // Extract the prompt and the flag part of the input
  const prompt = firstFlagIndex !== -1 ? args.slice(0, firstFlagIndex).join(' ') : args.join(' ');
  const flagsString = firstFlagIndex !== -1 ? args.slice(firstFlagIndex).join(' ') : '';

  // Parse the flags using yargs
  const argv = yargs(flagsString.split(' '))
    .option('m', {
      alias: 'model',
      type: 'string',
      default: '',
      describe: 'Model flag',
    })
    .option('s', {
      alias: 'size',
      type: 'string',
      default: '',
      describe: 'Size flag',
    })
    .help(false)
    .version(false)
    .parse();

  return {
    prompt,
    model: argv.m,
    size: getImgSize(argv.s),
  };
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
