import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { commands } from '../utils/commandUtils';
import { Command } from './../types/Command';
import { readdir } from "fs/promises"
import path from 'path';

export async function initCommands() {
    // create a tmp directory for short lived files
    if (!existsSync('tmp')) {
        mkdirSync('tmp');
    }

    // same with db
    if (!existsSync('db')) {
        mkdirSync('db');
        writeFileSync(path.normalize(path.join('db', 'dataStorage.json')), JSON.stringify({}));
    }

    // load commands (todo: export this function for hot reload/fixes. Add new commands and run !refreshCommands, and commands will be added with no downtime)
    for await (const file of getFiles(path.normalize(path.join(__dirname, '..', 'commands', '/')))) {
        // only load commands
        if (file.name !== 'command.ts') return;

        const command: Command = require(file.path).default;
        if (command.enabled) {
            console.log('initialized', command.name)
            commands.set(command.name, command);
        }
    }
};

async function* getFiles(rootDirectory: string) {
    const entries = await readdir(rootDirectory, { withFileTypes: true })

    for (const file of entries) {
        if (file.isDirectory()) {
            yield* getFiles(path.normalize(`${rootDirectory}${file.name}/`));
        } else {
            yield { ...file, path: rootDirectory + file.name };
        }
    }
};