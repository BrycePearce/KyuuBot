import { Message } from 'discord.js';

export interface Command {
  name: string; // short descriptive name
  description: string; // full description
  enabled: boolean; // should command be loaded
  invocations?: string[]; // ways to invoke the command
  cooldown?: number;
  usage?: string; // example usage
  args?: boolean; // argument params

  onload?: () => void;
  execute: (message: Message, args: string[]) => void;
  unload?: () => void;
}
