import { ComixError } from '../../../types/Comix';
import { Command } from '../../../types/Command';
import { isValidChapterArgs, retrieveAndSendComic } from '../../../utils/chapterUtils';
import { kyuuChanComixId } from '../../../utils/constants';

const command: Command = {
  name: 'Retrieve KyuuChan Chapter',
  description: 'Returns the the kyuu comic number specified by the user',
  invocations: ['k', 'kyute', 'kyuute', 'kyuuchan', 'kyuu'],
  enabled: true,
  args: true,
  usage: '[invocation] [chapterNumber]',
  async execute(message, args) {
    if (!isValidChapterArgs(args)) return;
    const channel = message.channel;

    if (!channel.isSendable()) return;

    const onSuccess = (pages: string[]) => {
      for (const page of pages) {
        channel.send({ files: [page] }).catch(console.error);
      }
    };
    const onFailure = (error: ComixError) => {
      console.error(JSON.stringify(error));
      switch (error.type) {
        case 'chapterNotFound':
          channel.send({ content: error.message, files: [error.emotePath] });
          break;
        case 'apiError':
        default:
          channel.send(`Kyuu chapter error: ${error.message || 'An unknown error occurred'}`);
          break;
      }
    };

    await retrieveAndSendComic(kyuuChanComixId, args, onSuccess, onFailure);
  },
};

export default command;
