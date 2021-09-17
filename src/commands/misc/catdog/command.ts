import got from 'got';
import { Command } from './../../../types/Command';

const catInvocations = ['cat', 'meow'];
const percentOppositeChance = 10;

type Animal = 'cat' | 'dog';

export const command: Command = {
    name: 'Catdog',
    description: 'Displays a cat or dog image',
    invocations: ['cat', 'dog', 'meow', 'woof'],
    args: false,
    enabled: true,
    usage: '[invocation]',
    async execute(message) {
        const hasRequestedCat = catInvocations.includes(message.content.slice(1, 4).toLowerCase());
        const requestedAnimal = hasRequestedCat ? 'cat' : 'dog';
        const shouldGiveOpposite = (Math.random() * 100) <= percentOppositeChance;

        let animalToGive: Animal = requestedAnimal;
        if (shouldGiveOpposite && requestedAnimal === 'cat') {
            animalToGive = 'dog';
        } else if (shouldGiveOpposite && 'dog') {
            animalToGive = 'cat';
        }

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

const getRandomAnimal = async (animal: Animal) => {
    try {
        const animalResponse = await got(`https://api.the${animal}api.com/v1/images/search`).json() as [{ url: string }];
        return animalResponse[0].url;
    } catch (ex) {
        throw new Error(`Failed to fetch from ${animal} api`);
    }
};