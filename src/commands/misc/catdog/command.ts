import got from 'got';
import { Command } from './../../../types/Command';

const catInvocations = ['cat', 'meow'];

export const command: Command = {
    name: 'Catdog',
    description: 'Displays a cat or dog image',
    invocations: ['cat', 'dog', 'meow', 'woof'],
    args: false,
    enabled: true,
    usage: '[invocation]',
    async execute(message) {
        const shouldGiveOpposite = (Math.random() * 100) <= 10; // 10% chance of opposite
        const hasRequestedCat = catInvocations.includes(message.content.slice(1, 4).toLowerCase());
        const animalToGive = shouldGiveOpposite && hasRequestedCat ? 'dog' : 'cat';
        try {
            const url = await getRandomAnimal(animalToGive)
            await message.channel.send({
                content: shouldGiveOpposite ? `Have a ${animalToGive} instead` : '',
                files: [url]
            });
        } catch (ex) {
            message.channel.send(ex && ex['message'] || 'Something really went wrong');
        }
    }
};

const getRandomAnimal = async (animal: 'dog' | 'cat') => {
    try {
        const animalResponse = await got(`https://api.the${animal}api.com/v1/images/search`).json() as [{ url: string }];
        return animalResponse[0].url;
    } catch (ex) {
        throw new Error(`Failed to fetch from ${animal} api`);
    }
};