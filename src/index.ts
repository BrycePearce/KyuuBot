import { Client } from "discord.js";
import Mangadex from "mangadex-full-api";
import BindDatabase from "./database";
import { initCommands } from "./system/commandLoader";
import { findCommand } from "./utils/commandUtils";

require("dotenv").config();

export const client: Client = new Client();

async function init() {
  // todo: error handling, do not run if cannot connect
  await Promise.all([
    client.login(process.env.token),
    Mangadex.login(process.env.mangadexUser, process.env.mangadexPassword, "../cache"),
  ]);
}

client.on("ready", async () => {
  initCommands();
});

client.on("message", async (message) => {
  const guildPrefix = process.env.defaultPrefix; // todo: get server default

  if (message.author.bot || message.channel.type === "dm" || !message.content.startsWith(guildPrefix)) {
    return;
  }

  const commandArguments = message.content.slice(guildPrefix.length).trim().split(/ +/g);
  const commandName = commandArguments.shift().toLowerCase();
  const command = findCommand(commandName); // todo: probably do a validate command & arguments method

  if (!command) return;
  command.execute(message, commandArguments, client); // todo: do not pass client, use class instead for emotes
});

BindDatabase();
init();
