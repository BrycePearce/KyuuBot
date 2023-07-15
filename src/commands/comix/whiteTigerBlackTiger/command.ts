import { ComixError } from '../../../types/Comix';
import { Command } from '../../../types/Command';
import { isValidChapterArgs, retrieveAndSendComic } from '../../../utils/chapterUtils';
import { whiteTigerAndBlackTigerComixId } from '../../../utils/constants';

const command: Command = {
  name: 'Retrieve White Tiger and Black Tiger Chapter',
  description: 'Returns the the White Tiger and Black Tiger comic number specified by the user',
  invocations: ['btwt', 'tigercomic', 'tiger', 'blacktigerandwhitetiger', 'bw', 'tigers', 'b'],
  enabled: true,
  args: true,
  usage: '[invocation] [chapterNumber]',
  async execute(message, args) {
    if (!isValidChapterArgs(args)) return;

    const onSuccess = (pages: string[]) => {
      for (const page of pages) {
        message.channel.send({ files: [page] });
      }
    };

    const onFailure = (error: ComixError) => {
      console.error(JSON.stringify(error));
      switch (error.type) {
        case 'chapterNotFound':
          message.channel.send({ content: error.message, files: [error.emotePath] });
          break;
        case 'apiError':
        default:
          message.channel.send(error.message || 'An unknown error occurred');
          break;
      }
    };

    await retrieveAndSendComic(whiteTigerAndBlackTigerComixId, args, onSuccess, onFailure);
  },
};

export default command;
