import { readdir } from 'fs/promises';
import _ from 'lodash';
import path from 'path';
import { Measure } from '../decorators/measure';

export class CommandRegistry {
  private _commands: Map<string, ICommand> = new Map();

  /**
   * Deep scans all files, and directories at the root of this file for triggering command decorators for registration
   */
  @Measure('Command Discovery')
  async discover() {
    for await (const file of getFiles(__dirname)) {
      await import(file.path);
    }
  }
  /**
   * Registers a command into the command registry. Calling this method directly is often not needed and will be handled by the {@link discover} method
   * @param {@link ICommand} command
   */
  register(phrase: string, command: ICommand) {
    const existingCommand = _.find(
      Array.from(this._commands.values()),
      (cmd) => cmd.constructor.name == command.name
    ) as ICommand;
    if (this._commands.has(phrase)) {
      throw new Error(`command phrase "${phrase}" already in use by [${existingCommand.name}]`);
    }

    if (existingCommand) {
      // reuse instance if it is being used for an alias
      this._commands.set(phrase, existingCommand as ICommand);
    } else {
      // create new instance of the command and map it to the phrase
      const instance = new (command as any)();
      this._commands.set(phrase, instance);
      instance.onLoad?.();
    }
  }

  execute(...args) {
    // Root command instance
    const command = this._commands.get(args[0]);
    // Phrase after root command
    const subCommandPhrase = args[1][0];
    // if the 2nd phrase matches a subcommand then use it. Otherwise default to the default method for the command class.
    if (command['commands'].get(subCommandPhrase)) {
      command[command['commands'].get(subCommandPhrase)](args[1].splice(1), args[2]);
    } else {
      // gets the function where @Invoke() was parameterless
      const func = command[command['commands'].get(undefined)];
      // apply the command instance to the function call to perserve the 'this' context
      func.apply(command, [args[1], args[2]]);
    }
  }
}

//#region Decorators

export function Command(invokePhrase?: string | string[]): ClassDecorator {
  return function (target: any) {
    if (Array.isArray(invokePhrase)) {
      invokePhrase.forEach((phrase) => {
        commandRegistry.register(phrase, target);
      });
    } else {
      commandRegistry.register(invokePhrase, target);
    }
  };
}

export function Invoke(invokePhrase?: string | string[]) {
  return function (target: Object, propertyKey: string) {
    if (!target.hasOwnProperty('commands')) target['commands'] = new Map<string, string>();
    if (Array.isArray(invokePhrase)) {
      invokePhrase.forEach((phrase) => {
        target['commands'].set(phrase, propertyKey);
      });
    } else {
      target['commands'].set(invokePhrase, propertyKey);
    }
  };
}

//#endregion

//#region Types and Interfaces

export interface ICommand {
  name: string;
  onLoad?: () => void;
  unload?: () => void;
}

//#endregion

async function* getFiles(rootDirectory: string) {
  const entries = await readdir(rootDirectory, { withFileTypes: true });

  for (const file of entries) {
    if (file.isDirectory()) {
      yield* getFiles(path.join(rootDirectory, file.name));
    } else {
      yield { ...file, path: path.join(rootDirectory, file.name) };
    }
  }
}

export const commandRegistry = new CommandRegistry();
