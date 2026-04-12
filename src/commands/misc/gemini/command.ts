import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import got from 'got';
import { Command } from '../../../types/Command';
import { getRandomEmotePath } from '../../../utils/files';
import { extractReplySource } from '../../../utils/replySource';

const genAI = new GoogleGenerativeAI(process.env.geminiApi);

const command: Command = {
  name: 'Gemini',
  description: 'Generates an answer to a question',
  invocations: ['g', 'gemini'],
  args: true,
  enabled: true,
  usage: '[invocation]',
  async execute(message, args) {
    const channel = message.channel;
    if (!channel.isSendable()) return;

    const userPrompt = args.join(' ');
    const role =
      'You are a helpful assistant. Your response should be 80 words or less, unless necessary for a full answer.';

    const imageAttachments: Array<{ url: string; contentType?: string }> = [];
    message.attachments.forEach((attachment) => {
      if (attachment.contentType?.startsWith('image/')) {
        imageAttachments.push({ url: attachment.url, contentType: attachment.contentType });
      }
    });

    const replySource = await extractReplySource(message);
    for (const url of replySource?.imageUrls ?? []) {
      if (!imageAttachments.some((a) => a.url === url)) {
        imageAttachments.push({ url, contentType: 'image/png' });
      }
    }

    const fullPrompt = replySource?.text ? `Replied-to message: "${replySource.text}"\n\n${userPrompt}` : userPrompt;
    const prompts: Array<string | Part> = [`${role} ${fullPrompt}`];
    if (imageAttachments.length > 0) {
      const imagesAsParts = await Promise.all(
        imageAttachments.map(async (attachment) => {
          try {
            const response = await got(attachment.url, { responseType: 'buffer' });
            const buffer = response.body;
            const base64 = buffer.toString('base64');

            const imagePart: Part = {
              inlineData: {
                data: base64,
                mimeType: attachment.contentType || 'image/png',
              },
            };
            return imagePart;
          } catch (error) {
            return channel.send({
              content: 'There was a problem generating your response',
              files: [await getRandomEmotePath()],
            });
          }
        })
      );

      const validImages = imagesAsParts.filter((img) => img !== null) as Part[];
      prompts.push(...validImages);
    }

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(prompts);

      const response = result.response;
      const text = response.text();

      return channel.send(text);
    } catch (error) {
      return channel.send(`🙀 Error: ${JSON.stringify(error)} 🙀`);
    }
  },
};

export default command;
