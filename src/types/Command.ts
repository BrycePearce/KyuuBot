import { Client } from 'discord.js';
import { Message } from 'discord.js';

export interface Command {
    name: string; // short descriptive name
    description: string; // full description
    enabled: boolean; // should command be loaded
    invocations?: string[]; // ways to invoke the command
    cooldown?: number;
    usage?: string, // example usage
    args?: boolean; // argument params

    execute: (message: Message, args: string[], client: Client) => void; // todo: don't pass client here, I'm just being lazy and using it to get emotes from all servers. Use a class instead.
}