import { Command } from '../../../types/Command';
import { client } from './../../../index';

const responses = [
  'it is certain',
  'it is decidedly so',
  'without a doubt',
  'yes — definitely',
  'you may rely on it',
  'as I see it, yes',
  'most likely',
  'outlook good',
  'yes',
  'signs point to yes',
  'reply hazy, try again',
  'ask again later',
  'better not tell you now',
  'cannot predict now',
  'concentrate and ask again',
  'don’t count on it',
  'my reply is no',
  'my sources say no',
  'outlook not so good',
  'very doubtful',
];

const command: Command = {
  name: '8ball',
  description: 'Generates an answer to a question',
  invocations: ['8', '8ball'],
  args: false,
  enabled: true,
  usage: '[invocation]',
  async execute(message, _) {
    const channel = message.channel;
    if (!channel.isSendable()) return;
    const eightballResponse = responses[Math.floor(responses.length * Math.random())];
    const channelEmotes = client.emojis.cache; // note: this pulls emotes from any channel that Kyuubot is in
    const keys = Array.from(channelEmotes.keys());
    const randomEmojiKey = getRandomItemFromList(keys);
    const emote = channelEmotes.get(randomEmojiKey);
    channel.send(`${emote} ${eightballResponse}`);
  },
};

const getRandomItemFromList = <T>(list: T[]): T => {
  return list[Math.floor(Math.random() * list.length)];
};

export default command;
