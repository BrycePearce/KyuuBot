import { Message } from 'discord.js';

export interface Command {
    name: string; // vanity name
    description: string;
    invocations?: string[]; // ways to invoke the command
    cooldown?: number;
    args?: boolean; // argument params
    usage?: string, // example usage

    execute: (message: Message, args: string[]) => void;
}