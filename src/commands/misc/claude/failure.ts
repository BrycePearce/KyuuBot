import type { MessageCreateOptions } from 'discord.js';
import { getRandomEmotePath } from '../../../utils/files';

interface FailureDependencies {
  getEmotePath: () => Promise<string>;
  logError: (message: string, error: unknown) => void;
}

/** Error reporting must not replace the original failure with an unhandled rejection. */
export async function sendClaudeFailure(
  send: (options: MessageCreateOptions) => Promise<unknown>,
  content: string,
  overrides: Partial<FailureDependencies> = {}
): Promise<void> {
  const { getEmotePath, logError }: FailureDependencies = {
    getEmotePath: getRandomEmotePath,
    logError: (message, error) => console.error(message, error),
    ...overrides,
  };
  const response: MessageCreateOptions = { content: content.slice(0, 2000), allowedMentions: { parse: [] } };
  let delivered = false;
  try {
    const emotePath = await getEmotePath();
    await send({ ...response, files: [emotePath] });
    delivered = true;
  } catch (error) {
    logError('Unable to send Claude failure image:', error);
  }
  try {
    if (!delivered) await send(response);
    // Provider refusal explanations can be longer than the usual short failure messages.
    for (let offset = 2000; offset < content.length; offset += 2000) {
      await send({ ...response, content: content.slice(offset, offset + 2000) });
    }
  } catch (error) {
    logError('Unable to send Claude failure text:', error);
  }
}
