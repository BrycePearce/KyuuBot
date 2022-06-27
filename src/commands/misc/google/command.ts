import * as cheerio from 'cheerio';
import got from 'got';
import { Command } from '../../../types/Command';
import { getRandomEmotePath } from '../../../utils/files';

const command: Command = {
  name: 'Google',
  description: 'Do a google search',
  invocations: ['g', 'google', 'search', 'find'],
  args: true,
  enabled: true,
  usage: '[invocation] [query]',
  async execute(message, args) {
    const search = await got(`https://google.com/search?q=${encodeURIComponent(args.join(' '))}`, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36',
      },
    });
    const $ = cheerio.load(search.body);
    const firstResult = $('.jtfYYd').first();
    const citation = firstResult.find('a').attr('href');
    const header = firstResult.find('h3').first().text();
    if (!citation || !header) {
      message.channel.send({ content: 'Not found!', files: [await getRandomEmotePath()] });
      return;
    }
    message.channel.send(header);
    message.channel.send(citation);
  },
};

export default command;
