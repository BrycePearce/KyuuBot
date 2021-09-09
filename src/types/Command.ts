import { Message } from 'discord.js';

export interface Command {
    name: string; // short descriptive name
    description: string; // full description
    invocations?: string[]; // ways to invoke the command
    cooldown?: number;
    args?: boolean; // argument params
    usage?: string, // example usage

    execute: (message: Message, args: string[]) => void;
}