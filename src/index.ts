import { ChannelType, Client, GatewayIntentBits } from 'discord.js';
import { loginPersonal } from 'mangadex-full-api';
import 'reflect-metadata';
import { initComix } from './comixPreloader';
import { initCommands } from './commands';
import { commandRegistry } from './commands/commandRegistry';
import BindDatabase from './database';
import { findCommand } from './utils/commandUtils';
import { initializedComix } from './utils/constants';

require('dotenv').config();

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const USE_NEW_COMMAND_LOADER = false;

async function init() {
  await BindDatabase();
  if (USE_NEW_COMMAND_LOADER) {
    commandRegistry.discover();
  }

  const res = await Promise.allSettled([
    client.login(process.env.token),
    loginPersonal({
      username: process.env.mangadexUser,
      password: process.env.mangadexPassword,
      clientId: process.env.mangadexClientId,
      clientSecret: process.env.mangadexSecret,
    }),
  ]);
  console.log('res', res);

  res.forEach((login, i) => {
    if (login.status === 'rejected') console.warn(`Login failed for ${i === 0 ? 'Discord' : 'Mangadex'}`);
  });
}

client.on('ready', async (asd) => {
  if (!USE_NEW_COMMAND_LOADER) {
    try {
      initCommands();
      await initComix(initializedComix);
    } catch (err) {
      const errorMsg = 'Failed to initialize';
      console.error(errorMsg, err);
    }
  }
});

client.on('messageCreate', async (message) => {
  const guildPrefix = process.env.defaultPrefix; // todo: get server default
  if (message.author.bot || message.channel.type === ChannelType.DM || !message.content.startsWith(guildPrefix)) {
    return;
  }

  const commandArguments = message.content.slice(guildPrefix.length).trim().split(/ +/g);
  const commandName = commandArguments.shift().toLowerCase();
  if (USE_NEW_COMMAND_LOADER) {
    commandRegistry.execute(commandName, commandArguments, message);
  } else {
    const command = findCommand(commandName); // todo: probably do a validate command & arguments method
    if (!command) return;
    command.execute(message, commandArguments);
  }
});

init();
