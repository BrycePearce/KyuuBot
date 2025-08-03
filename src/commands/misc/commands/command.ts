import { EmbedBuilder } from 'discord.js';
import { Command } from '../../../types/Command';
import { CommandRegistry } from '../../../utils/commandUtils';

const command: Command = {
  name: 'Commands',
  description: 'Lists all available commands and how to invoke them',
  invocations: ['commands', 'help'],
  enabled: true,
  args: false,
  usage: '.commands',
  async execute(message) {
    const channel = message.channel;
    if (!channel.isSendable()) return;

    const commands = CommandRegistry.getAll().filter((cmd) => cmd.enabled);
    if (!commands.length) {
      return channel.send('No commands available.');
    }

    const prefix = process.env.defaultPrefix || '.';
    const lines = commands.map((cmd) => {
      const invoke = cmd.invocations?.[0] || cmd.name;
      return `**${cmd.name}**\n\`${prefix}${invoke}\` — ${cmd.description}`;
    });

    const embed = new EmbedBuilder().setTitle('Commands').setDescription(lines.join('\n\n')).setColor(0x8e44ad);

    return channel.send({ embeds: [embed] });
  },
};

export default command;
