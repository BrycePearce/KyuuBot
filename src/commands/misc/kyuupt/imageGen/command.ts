import { AttachmentBuilder } from 'discord.js';
import got from 'got';
import OpenAI, { toFile } from 'openai';
import type { Command } from '../../../../types/Command';
import { getRandomEmotePath } from '../../../../utils/files';
import { extractImageUrls } from '../chatCompletion/extractImages';

const openai = new OpenAI({ apiKey: process.env.gptImageGen });

const command: Command = {
  name: 'Kyuubot Images',
  description: 'Create new images or edit an existing image via OpenAI',
  invocations: ['i', 'image', 'generate'],
  args: true,
  enabled: true,
  usage: '[invocation] [prompt]',
  async execute(message, args) {
    const channel = message.channel;
    if (!channel.isSendable()) return;

    const imageUrls = extractImageUrls(message);
    if (imageUrls.length > 1) {
      await channel.send('🙀 Please attach only **one** image to edit. 🙀');
      return;
    }

    const prompt = args.join(' ').trim();
    if (!prompt) {
      await channel.send(
        '🙀 You need to provide a prompt! For example:\n' +
          ' • `.image a neon cyberpunk city at night`  (new image)\n' +
          ' • `.image add neon glow` + attach one image  (edit)'
      );
      return;
    }

    try {
      let response;

      if (imageUrls.length === 1) {
        // IMAGE EDIT MODE

        const imgRes = await got(imageUrls[0], { responseType: 'buffer' });
        const buffer = imgRes.body;

        const extMatch = imageUrls[0].match(/\.(png|jpg|jpeg|webp)$/i);
        const ext = extMatch ? extMatch[1].toLowerCase() : 'png';
        const mimeTypes = {
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          webp: 'image/webp',
        };
        const mimeType = mimeTypes[ext] || 'image/png';

        const file = await toFile(buffer, `input.${ext}`, { type: mimeType });

        response = await openai.images.edit({
          model: 'gpt-image-1.5',
          image: file,
          prompt,
          n: 1,
          size: '1024x1024',
        });
      } else {
        // TEXT → IMAGE MODE
        response = await openai.images.generate({
          model: 'gpt-image-1.5',
          prompt,
          n: 1,
          size: '1024x1024',
          response_format: 'b64_json', // explicitly request base64 here only
        });
      }

      const b64Image = response.data[0]?.b64_json;
      if (!b64Image) {
        await channel.send('🙀 Error: no image returned from OpenAI 🙀');
        return;
      }

      const imgBuf = Buffer.from(b64Image, 'base64');
      const attachment = new AttachmentBuilder(imgBuf, { name: 'image.png' });
      await channel.send({ files: [attachment] });
    } catch (err: any) {
      console.error(err);
      await channel.send({
        content: '😿 Something went wrong:\n' + err.message,
        files: [await getRandomEmotePath()],
      });
    }
  },
};

export default command;
