import { Command } from "../../types/Command";

export const command: Command = {
    name: 'Retrieve Chapter',
    description: 'Returns the the kyuu comic number specified by the user',
    aliases: ['k'],
    args: true,
    usage: '[chapterNumber]',
    async execute(message, args) {
        console.log('howdy :)', message, args)
    }
}