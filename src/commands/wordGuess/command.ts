import { Message } from 'discord.js';
import { wordlist } from '../../utils/wordlist';
import { Command } from './../../types/Command';

const command: Command = {
  name: 'WordGuess',
  description: 'Player guesses the word to unscramble',
  invocations: ['guess', 'wordguess', 'scramble', 'unscramble'],
  args: false,
  enabled: true,
  usage: '[invocation]',
  async execute(message) {
    const channel = message.channel;
    if (!channel.isSendable()) return;
    const word = wordlist[Math.floor(Math.random() * wordlist.length)];
    const scrambledWord = getshuffledWord(word);

    let hasAnswerBeenGuessed = false;

    // begin quiz
    channel.send(`Unscramble this word: **${scrambledWord.join('')}**`);
    const collector = channel.createMessageCollector({ time: 60000 });

    // generate hints
    const numHints = Math.floor(word.length / 2);
    const hintIndexes = shuffle([...Array(word.length).keys()]).slice(0, numHints);
    const half = Math.floor(hintIndexes.length / 2);
    const [firstHintIndexes, secondHintIndexes] = [hintIndexes.slice(0, half), hintIndexes.slice(-half)];

    // set hint timers to reveal
    const firstHintTimeout = revealHintAtTime(message, word, firstHintIndexes, 20000);
    const secondHintTimeout = revealHintAtTime(message, word, [...firstHintIndexes, ...secondHintIndexes], 40000);

    // listen for collection events
    collector.on('collect', (guess) => {
      if (guess.content.toLowerCase() === word.toLowerCase()) {
        hasAnswerBeenGuessed = true;
        channel.send(`${guess.author}'s answer ${word} was correct!`);
        collector.stop();
      }
    });

    collector.on('end', () => {
      clearTimeout(firstHintTimeout);
      clearTimeout(secondHintTimeout);
      if (!hasAnswerBeenGuessed) channel.send(`Time's up! The answer was ${word}`);
    });
  },
};

const getshuffledWord = (word: string) => {
  if (word.length <= 1) return [...word];

  let shuffledWord = shuffle([...word]);

  while (shuffledWord.join('') === word) {
    shuffledWord = shuffle([...word]);
  }

  return shuffledWord;
};

// Fisher-Yates
function shuffle<T>(list: Array<T>) {
  for (let i = list.length - 1; i > 0; i--) {
    const rand = Math.floor(Math.random() * (i + 1));
    [list[i], list[rand]] = [list[rand], list[i]];
  }
  return list;
}

const revealHintAtTime = (message: Message, answer: string, indexesToReveal: number[], interval: number) => {
  const channel = message.channel;
  if (!channel.isSendable()) return;
  // print hint at interval
  return setTimeout(() => {
    // generate hint string
    const hintString = answer
      .split('')
      .map((character, answerIndex) => {
        if (indexesToReveal.includes(answerIndex)) return character;
        else if (character === ' ') return character;
        return '*';
      })
      .join('');

    const formattedHintString = hintString.replaceAll('*', '\\*');
    channel.send(`hint: ${formattedHintString}`);
  }, interval);
};

export default command;
