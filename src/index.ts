import { Client } from 'discord.js';
import Mangadex from 'mangadex-full-api';
import 'reflect-metadata';
import { initCommands } from './commands';
import { commandRegistry } from './commands/commandRegistry';
import './commands/tester';
import BindDatabase from './database';
import { findCommand } from './utils/commandUtils';

require('dotenv').config();

export const client: Client = new Client();

async function init() {
  commandRegistry.discover();
  // todo: error handling, do not run if cannot connect
  await Promise.all([
    client.login(process.env.token),
    Mangadex.login(process.env.mangadexUser, process.env.mangadexPassword, '../cache'),
  ]);
}

client.on('ready', async () => {
  initCommands();
});

client.on('message', async (message) => {
  const guildPrefix = process.env.defaultPrefix; // todo: get server default

  if (message.author.bot || message.channel.type === 'dm' || !message.content.startsWith(guildPrefix)) {
    return;
  }

  const commandArguments = message.content.slice(guildPrefix.length).trim().split(/ +/g);
  const commandName = commandArguments.shift().toLowerCase();
  const command = findCommand(commandName); // todo: probably do a validate command & arguments method

  if (!command) return;
  commandRegistry.execute(commandName, commandArguments, message);
  // command.execute(message, commandArguments);
});

BindDatabase();
init();
