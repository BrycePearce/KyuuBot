import { ChannelType, Client, GatewayIntentBits } from 'discord.js';
import { loginPersonal } from 'mangadex-full-api';
import { initComix } from './comixPreloader';
import { initCommands } from './commands';
import BindDatabase from './database';
import { CommandRegistry } from './utils/commandUtils';
import { initializedComix } from './utils/constants';

const dotenv = require('dotenv');
dotenv.config();

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

async function init() {
  await BindDatabase();

  const res = await Promise.allSettled([
    client.login(process.env.token),
    loginPersonal({
      username: process.env.mangadexUser,
      password: process.env.mangadexPassword,
      clientId: process.env.mangadexClientId,
      clientSecret: process.env.mangadexSecret,
    }),
  ]);

  res.forEach((login, i) => {
    if (login.status === 'rejected') console.warn(`Login failed for ${i === 0 ? 'Discord' : 'Mangadex'}`);
  });
}

client.on('ready', async () => {
  try {
    await initCommands();
    await initComix(initializedComix);
    console.log('😺 Kyuubot is ready! 😺');
  } catch (err) {
    const errorMsg = '😿 Failed to initialize Kyuubot 😿';
    console.error(errorMsg, err);
  }
});

client.on('messageCreate', async (message) => {
  const guildPrefix = process.env.defaultPrefix; // todo: get server default
  if (message.author.bot || message.channel.type === ChannelType.DM || !message.content.startsWith(guildPrefix)) {
    return;
  }

  const commandArguments = message.content.slice(guildPrefix.length).trim().split(/ +/g);
  const commandName = commandArguments.shift()?.toLowerCase();

  const command = CommandRegistry.find(commandName);
  if (!command) return;
  command.execute(message, commandArguments);
});

(async () => {
  try {
    await init();
  } catch (err) {
    console.error('Fatal error during initialization:', err);
    process.exit(1);
  }
})();
