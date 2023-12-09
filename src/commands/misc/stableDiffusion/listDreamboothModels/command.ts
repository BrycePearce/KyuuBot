import { EmbedBuilder } from 'discord.js';
import type { Command } from '../../../../types/Command';
import { sdModels } from '../../../../utils/constants';

const command: Command = {
  name: 'Models',
  description: 'Integrates OpenAI Api to create images with dall-e',
  invocations: ['m', 'models'],
  args: false,
  enabled: true,
  usage: '[invocation]',
  async execute(message) {
    const embed = new EmbedBuilder().setColor(0x0099ff).setTitle('Available Models');

    sdModels.forEach((model) => {
      embed.addFields({
        value: `**Description:** ${model.description}\n**Alias:** ${model.modelAlts.join(', ')}`,
        name: `**Name:** ${model.model}`,
      });
    });

    message.channel.send({ embeds: [embed] });
  },
};

export default command;
