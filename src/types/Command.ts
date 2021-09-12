import { Client } from 'discord.js';
import { Message } from 'discord.js';

export interface Command {
    name: string; // short descriptive name
    description: string; // full description
    invocations?: string[]; // ways to invoke the command
    cooldown?: number;
    args?: boolean; // argument params
    usage?: string, // example usage

    execute: (message: Message, args: string[], client: Client) => void; // todo: don't pass client here, I'm just being lazy and using it to get emotes from all servers. Use a class instead.
}