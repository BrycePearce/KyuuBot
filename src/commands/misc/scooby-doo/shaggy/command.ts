import { Command } from '../../../../types/Command';

const command: Command = {
  name: 'Shaggy',
  description: 'Returns an image of Norville Rogers',
  invocations: ['shaggy', 'norville', 'shag'],
  enabled: true,
  args: false,
  usage: '[invocation]',
  async execute(message) {
    const channel = message.channel;
    if (!channel.isSendable()) return;
    const imageUrl = 'https://upload.wikimedia.org/wikipedia/en/8/87/ShaggyRogers.png';

    try {
      channel.send({ files: [imageUrl] });
    } catch (error) {
      console.error('Error sending shaggy:', error);
      message.reply('Shaggy is hiding somewhere');
    }
  },
};

export default command;
