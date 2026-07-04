import { Command } from '../../../../types/Command';

const command: Command = {
  name: 'Velma',
  description: 'Returns an image of Velma Dinkley',
  invocations: ['velma', 'dinkley', 'jinkies'],
  enabled: true,
  args: false,
  usage: '[invocation]',
  async execute(message) {
    const channel = message.channel;
    if (!channel.isSendable()) return;
    const imageUrl = 'https://i.imgur.com/2ZQPfUT.png';

    try {
      channel.send({ files: [imageUrl] });
    } catch (error) {
      console.error('Error sending velma:', error);
      message.reply('Velma can\'t find her glasses');
    }
  },
};

export default command;
