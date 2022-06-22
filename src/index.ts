import { Client, Intents } from 'discord.js';
import Mangadex from 'mangadex-full-api';
import 'reflect-metadata';
import { initCommands } from './commands';
import { commandRegistry } from './commands/commandRegistry';
import BindDatabase from './database';
import { findCommand } from './utils/commandUtils';

require('dotenv').config();

export const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

const USE_NEW_COMMAND_LOADER = false;

async function init() {
  await BindDatabase();
  if (USE_NEW_COMMAND_LOADER) {
    commandRegistry.discover();
  }
  // todo: error handling, do not run if cannot connect
  await Promise.all([
    client.login(process.env.token),
    Mangadex.login(process.env.mangadexUser, process.env.mangadexPassword, '../cache'),
  ]);
}

client.on('ready', async () => {
  if (!USE_NEW_COMMAND_LOADER) {
    initCommands();
  }
});

client.on('messageCreate', async (message) => {
  const guildPrefix = process.env.defaultPrefix; // todo: get server default
  if (message.author.bot || message.channel.type === 'DM' || !message.content.startsWith(guildPrefix)) {
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
