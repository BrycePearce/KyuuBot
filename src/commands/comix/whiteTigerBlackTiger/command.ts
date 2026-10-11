import { Command } from '../../../types/Command';
import { comixIds } from '../../../utils/constants';
import { createComicHandler } from '../handler';

const command: Command = {
  name: 'Retrieve White Tiger and Black Tiger Chapter',
  description: 'Returns a White Tiger and Black Tiger chapter: latest by default, a chapter number, or r for random.',
  invocations: ['btwt', 'tigercomic', 'tiger', 'blacktigerandwhitetiger', 'bw', 'tigers', 'b'],
  enabled: true,
  args: true,
  usage: '[invocation] [chapterNumber|r] (omit for latest)',
  execute: createComicHandler(comixIds.whiteTigerAndBlackTiger, 'White Tiger and Black Tiger'),
};

export default command;
