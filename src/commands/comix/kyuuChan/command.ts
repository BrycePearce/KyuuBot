import { Command } from '../../../types/Command';
import { comixIds } from '../../../utils/constants';
import { createComicHandler } from '../handler';

const command: Command = {
  name: 'Retrieve KyuuChan Chapter',
  description: 'Returns a Kyuu-chan chapter: latest by default, a chapter number, or r for random.',
  invocations: ['k', 'kyute', 'kyuute', 'kyuuchan', 'kyuu'],
  enabled: true,
  args: true,
  usage: '[invocation] [chapterNumber|r] (omit for latest)',
  execute: createComicHandler(comixIds.kyuuChan, 'Kyuu'),
};

export default command;
