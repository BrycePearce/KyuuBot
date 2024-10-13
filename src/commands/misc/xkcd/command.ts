import got from 'got';
import { Command } from '../../../types/Command';

interface XKCD {
  month: string;
  num: number;
  link: string;
  year: string;
  news: string;
  safe_title: string;
  transcript: string;
  alt: string;
  img: string;
  title: string;
  day: string;
}

const numberRegex = new RegExp(/^\d+$/);

const command: Command = {
  name: 'xkcd',
  description: 'Gets xkcd comic',
  invocations: ['xkcd'],
  args: true,
  enabled: true,
  usage: '[invocation]',
  async execute(message, args) {
    const channel = message.channel;
    if (!channel.isSendable()) return;
    let comic: XKCD;
    try {
      if (args.length === 0) {
        comic = await getLatestComic();
      } else if (numberRegex.test(args[0])) {
        comic = await getSpecificComic(Number(args[0]));
      } else {
        comic = await getRandomComic();
      }
      await channel.send({ files: [comic.img] });
      channel.send(`[${comic.alt}]`);
    } catch (ex) {
      channel.send(ex['message'] || 'Something went really wrong');
    }
  },
};

const getLatestComic = async (): Promise<XKCD> => {
  try {
    return (await got('https://xkcd.com/info.0.json').json()) as XKCD;
  } catch (ex) {
    throw new Error('Failed to fetch from xkcd');
  }
};

const getSpecificComic = async (comicNumber: number): Promise<XKCD> => {
  try {
    return (await got(`https://xkcd.com/${comicNumber}/info.0.json`).json()) as XKCD;
  } catch (ex) {
    throw new Error('Failed to fetch from xkcd');
  }
};

const getRandomComic = async (): Promise<XKCD> => {
  try {
    const latest = await getLatestComic();
    const randomChapterNumber = Math.floor(Math.random() * (latest.num - 1 + 1)) + 1;
    return await getSpecificComic(randomChapterNumber);
  } catch {
    throw new Error('Failed to fetch from xkcd');
  }
};

export default command;
