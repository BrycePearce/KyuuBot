import type { Message, MessageCreateOptions } from 'discord.js';
import { ComicError, retrieveComic } from '../../utils/chapterUtils';
import { getRandomEmotePath } from '../../utils/files';

// Shared by both commands; reject excess work instead of retaining an unbounded queue.
const MAX_ACTIVE_REQUESTS = 2;
let activeRequests = 0;

interface ComicHandlerDependencies {
  retrieve: typeof retrieveComic;
  getEmotePath: () => Promise<string>;
  logError: (message: string, error: unknown) => void;
}

/** Shared delivery and error handling for the MangaDex commands. */
export function createComicHandler(
  mangaId: string,
  comicName: string,
  overrides: Partial<ComicHandlerDependencies> = {}
) {
  const dependencies: ComicHandlerDependencies = {
    retrieve: retrieveComic,
    getEmotePath: getRandomEmotePath,
    logError: (message, error) => console.error(message, error),
    ...overrides,
  };

  return async (message: Message, args: string[]): Promise<void> => {
    const channel = message.channel;
    if (!channel.isSendable()) return;

    let uploading = false;
    let sentPages = 0;
    let totalPages = 0;
    let ownsPermit = false;
    try {
      // Prepare and validate the entire chapter before posting any of its pages.
      if (activeRequests >= MAX_ACTIVE_REQUESTS) {
        throw new ComicError("I'm preparing other chapters right now. Please try again in a moment.", 'busy');
      }
      activeRequests += 1;
      ownsPermit = true;
      // Hold capacity through delivery: stalled uploads still retain chapter buffers.
      // Prefix messages have no attachmentSizeLimit; use the service's conservative default.
      const pages = await dependencies.retrieve(mangaId, args);
      totalPages = pages.length;
      if (!totalPages) throw new ComicError('No readable pages were found for that chapter.');

      uploading = true;
      for (const page of pages) {
        // Await each upload so Discord receives pages in chapter order.
        await channel.send({ files: [{ attachment: page.data, name: page.name }] });
        sentPages += 1;
      }
    } catch (error) {
      dependencies.logError(`${comicName} chapter ${uploading ? 'upload' : 'retrieval'} failed:`, error);
      const detail = uploading
        ? `I couldn't upload the chapter. Please try again.${sentPages ? ` Sent ${sentPages} of ${totalPages} pages.` : ''}`
        : error instanceof ComicError
          ? error.message
          : "I couldn't fetch or prepare that chapter. Please try again in a moment.";
      const content = `${comicName} chapter error: ${detail}`;

      let files: MessageCreateOptions['files'];
      try {
        files = [await dependencies.getEmotePath()];
      } catch (emoteError) {
        dependencies.logError('Could not load a Kyuu error image:', emoteError);
      }

      try {
        await channel.send({ content, ...(files ? { files } : {}), allowedMentions: { parse: [] } });
      } catch (reportError) {
        dependencies.logError('Could not send the comic error response:', reportError);
        // A missing or unreadable emote must not prevent a useful text response.
        if (files) {
          try {
            await channel.send({ content, allowedMentions: { parse: [] } });
          } catch (fallbackError) {
            dependencies.logError('Could not send the comic error text:', fallbackError);
          }
        }
      }
    } finally {
      if (ownsPermit) activeRequests -= 1;
    }
  };
}
