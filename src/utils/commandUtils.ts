import { Collection } from 'discord.js';
import { Command } from '../types/Command';

export const CommandRegistry = {
  commands: new Collection<string, Command>(),

  add(command: Command) {
    this.commands.set(command.name.toLowerCase(), command);
  },

  find(query: string): Command | undefined {
    let command = this.commands.get(query.toLowerCase());
    if (!command) {
      const cmdArray = [...this.commands.values()];
      command = cmdArray.find((cmd) => cmd.invocations?.find((alias) => alias.toLowerCase() === query.toLowerCase()));
    }
    return command;
  },

  getAll(): Command[] {
    return [...this.commands.values()];
  },

  clear() {
    this.commands.clear();
  },
};
