import { Command } from '../../../types/Command';

const command: Command = {
  name: 'Scooby',
  description: 'Returns an image of Schoobert Doo',
  invocations: ['scoob', 'scooby', 'scoobs'],
  enabled: true,
  args: false,
  usage: '[invocation]',
  async execute(message) {
    const channel = message.channel;
    if (!channel.isSendable()) return;
    const imageUrl = 'https://upload.wikimedia.org/wikipedia/en/thumb/5/53/Scooby-Doo.png/150px-Scooby-Doo.png';

    try {
      channel.send({ files: [imageUrl] });
    } catch (error) {
      console.error('Error sending scoob:', error);
      message.reply('Scooby is on vacation');
    }
  },
};

export default command;
