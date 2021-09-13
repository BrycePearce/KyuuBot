import { Command } from './../types/Command';
import { existsSync, mkdirSync } from 'fs';
import { readdir } from "fs/promises"
import path from 'path';
import { commands } from '../utils/commandUtils';

export async function initCommands() {
    // create a tmp directory for short lived files
    if (!existsSync('tmp')) {
        mkdirSync('tmp');
    }

    // load commands
    for await (const file of getFiles(path.normalize(path.join(__dirname, '..', 'commands', '/')))) {
        const { command }: { command: Command } = require(file.path);
        commands.set(command.name, command);
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