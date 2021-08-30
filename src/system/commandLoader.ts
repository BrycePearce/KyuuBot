import { Command } from './../types/Command';
import { readdirSync } from 'fs';
import path from 'path';
import { commands } from '../utils/commandUtils';

export function initCommands() {
    readdirSync(path.join(__dirname, '..', 'commands')).map(commandFolder => {
        readdirSync(path.join(__dirname, '..', 'commands', commandFolder)).map(file => {
            const { command }: { command: Command } = require(path.normalize(path.join(__dirname, '..', 'commands', commandFolder, file)));
            commands.set(command.name, command) // todo: instead of command name, maybe do command key?
        });
    });
}