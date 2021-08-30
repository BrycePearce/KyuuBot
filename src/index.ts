import { Client } from "discord.js";
import { initCommands } from "./system/commandLoader";
import { findCommand } from "./utils/commandUtils";

require('dotenv').config();

const client = new Client()

async function init() {
	client.login(process.env.token);
}

client.on('ready', async () => {
	initCommands();
});

client.on('message', async message => {
	const guildPrefix = process.env.defaultPrefix; // todo: get server default

	if (message.author.bot || message.channel.type === 'dm' || !message.content.startsWith(guildPrefix)) {
		return;
	}

	const commandArguments = message.content.slice(guildPrefix.length).trim().split(/ +/g);
	const commandName = commandArguments.shift().toLowerCase();
	let command = findCommand(commandName);

})

init();
