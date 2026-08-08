import got from 'got';
import { Command } from '../../../types/Command';

interface WikiRandom {
  query: { random: Array<{ title: string }> };
}

interface WikiParse {
  parse: { title: string; wikitext: { '*': string } };
  error?: { code: string; info: string };
}

interface QuotableResponse {
  content: string;
  author: string;
}

interface Quote {
  text: string;
  author: string;
  url: string;
}

const WIKI_API = 'https://en.wikiquote.org/w/api.php';
const QUOTABLE_API = 'https://api.quotable.io/random';
const MAX_RETRIES = 6;
const MIN_QUOTES = 3;
const MIN_QUOTE_LENGTH = 50;

const SKIP_SECTIONS =
  /^(external links?|see also|notes?|references?|further reading|sources?|bibliography|filmography|discography|works?)$/i;

const command: Command = {
  name: 'wikiquote',
  description: 'Gets a random quote from Wikiquote or Quotable',
  invocations: ['quote', 'wikiquote'],
  args: false,
  enabled: true,
  usage: '[invocation]',
  async execute(message, _args) {
    const channel = message.channel;
    if (!channel.isSendable()) return;
    try {
      const quote = await getRandomQuote();
      const prefix =
        message.author.id === '182320583491452928' ? 'Rooby-Rooby-Roo! Raggy, I round Rikiquotes! Rehehehe!\n' : '';
      channel.send(`${prefix}> ${quote.text}\n— [${quote.author}](<${quote.url}>)`);
    } catch (ex) {
      channel.send(ex['message'] || 'Failed to fetch a quote');
    }
  },
};

async function getRandomQuote(): Promise<Quote> {
  const preferWikiquote = Math.random() < 0.7;
  const [primary, fallback] = preferWikiquote
    ? ([getWikiquoteQuote, getQuotableQuote] as const)
    : ([getQuotableQuote, getWikiquoteQuote] as const);

  try {
    return await primary();
  } catch {
    return await fallback();
  }
}

async function getWikiquoteQuote(): Promise<Quote> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const title = await getRandomTitle();
      const wikitext = await getWikitext(title);
      const quotes = parseQuotes(wikitext);
      if (quotes.length >= MIN_QUOTES) {
        return {
          text: quotes[Math.floor(Math.random() * quotes.length)],
          author: title,
          url: `https://en.wikiquote.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
        };
      }
    } catch {
      // page missing, redirect, or parse error — try another
    }
  }
  throw new Error('Wikiquote exhausted retries');
}

async function getQuotableQuote(): Promise<Quote> {
  const data = await got(QUOTABLE_API, {
    searchParams: { minLength: MIN_QUOTE_LENGTH },
  }).json<QuotableResponse>();
  return {
    text: data.content,
    author: data.author,
    url: `https://en.wikiquote.org/wiki/${encodeURIComponent(data.author.replace(/ /g, '_'))}`,
  };
}

async function getRandomTitle(): Promise<string> {
  const data = await got(WIKI_API, {
    searchParams: { action: 'query', list: 'random', rnnamespace: 0, rnlimit: 1, format: 'json' },
  }).json<WikiRandom>();
  return data.query.random[0].title;
}

async function getWikitext(title: string): Promise<string> {
  const data = await got(WIKI_API, {
    searchParams: { action: 'parse', page: title, prop: 'wikitext', format: 'json' },
  }).json<WikiParse>();
  if (data.error) throw new Error(data.error.info);
  return data.parse.wikitext['*'];
}

function parseQuotes(wikitext: string): string[] {
  if (/^#REDIRECT/i.test(wikitext.trim())) return [];
  if (/\{\{[^}]*stub/i.test(wikitext)) return [];

  const quotes: string[] = [];
  let inQuoteSection = true;

  for (const line of wikitext.split('\n')) {
    if (line.startsWith('==')) {
      const heading = line.replace(/=+/g, '').trim();
      inQuoteSection = !SKIP_SECTIONS.test(heading);
      continue;
    }

    if (!inQuoteSection) continue;
    if (!line.startsWith('* ') || line.startsWith('** ')) continue;

    const cleaned = stripMarkup(line.slice(2));
    if (cleaned.length >= MIN_QUOTE_LENGTH) quotes.push(cleaned);
  }

  return quotes;
}

function stripMarkup(text: string): string {
  return text
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, '')
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/'{2,3}/g, '')
    .replace(/^["""«»]|["""«»]$/g, '')
    .trim();
}

export default command;
