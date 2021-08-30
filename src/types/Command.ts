import { Message } from 'discord.js';

export interface Command {
    name: string;
    description: string;
    aliases?: string[];
    cooldown?: number;
    args?: boolean;
    usage?: string,

    execute: (message: Message, args: string[]) => void;
}