import got from 'got';
import yargs from 'yargs';
import { Command } from '../../../../types/Command';
import { getRandomEmotePath } from '../../../../utils/files';

import type { DreamboothResponse, DreamboothRetry } from '../../../../types/StableDiffusion';

enum ImageKeys {
  small = 'sm',
  medium = 'md',
  large = 'lg',
}

const command: Command = {
  name: 'SDText2Img',
  description: 'Generate art from text using Stable Diffusion',
  invocations: ['art', 'a', 'sd'],
  enabled: true,
  args: true,
  usage: '[size] [model] [prompt]',
  async execute(message, args) {
    try {
      const { model, prompt, size } = parseArgs(args);
      let sdImgResp: DreamboothResponse | DreamboothRetry = await got
        .post('https://stablediffusionapi.com/api/v4/dreambooth', {
          headers: {
            'Content-Type': 'application/json',
          },
          json: {
            key: process.env.stableDiffusion,
            prompt,
            channel: 'dreambooth',
            enhance_prompt: 'yes',
            guidance_scale: 7.5,
            height: size.height,
            width: size.width,
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
        throw new Error(JSON.stringify('Processing image failed'));
      }

      const imgRespPath = sdImgResp.output[0];
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
    model: argv.m.length ? argv.m : 'anything-v3',
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

const handleProcessingImg = async (imgId: number) => {
  try {
    return await retryForProcessedImg(imgId);
  } catch (error) {
    return null;
  }
};

const retryForProcessedImg = async (imgId: number, delays: number[] = [5, 10, 15, 30]) => {
  const retries = delays.length;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response: DreamboothRetry = await got
        .post(`https://stablediffusionapi.com/api/v3/dreambooth/fetch/${imgId}`, {
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
