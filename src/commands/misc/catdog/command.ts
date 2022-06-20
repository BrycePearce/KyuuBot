import got from 'got';
import { Command } from './../../../types/Command';

const catInvocations = ['cat', 'meow'];
const percentOppositeChance = 10;

type Animal = 'cat' | 'dog';

const command: Command = {
  name: 'Catdog',
  description: 'Displays a cat or dog image',
  invocations: ['cat', 'dog', 'meow', 'woof'],
  args: false,
  enabled: true,
  usage: '[invocation]',
  async execute(message) {
    const shouldGiveOpposite = Math.random() * 100 <= percentOppositeChance;
    const animal = getAnimal(message.content, shouldGiveOpposite);

    try {
      const url = await getAnimalUrl(animal);
      await message.channel.send({
        content: shouldGiveOpposite ? `Have a ${animal} instead` : null,
        files: [url],
      });
    } catch (ex) {
      message.channel.send((ex && ex['message']) || 'Something really went wrong');
    }
  },
};

const getAnimal = (command: string, shouldGiveOpposite: boolean): Animal => {
  const requestedAnimal = catInvocations.includes(command.substring(1).toLowerCase()) ? 'cat' : 'dog';

  if (shouldGiveOpposite) return requestedAnimal === 'cat' ? 'dog' : 'cat';
  return requestedAnimal;
};

const getAnimalUrl = async (animal: Animal) => {
  try {
    const animalResponse = (await got(`https://api.the${animal}api.com/v1/images/search`).json()) as [{ url: string }];
    return animalResponse[0].url;
  } catch (ex) {
    throw new Error(`Failed to fetch from ${animal} api`);
  }
};

export default command;
