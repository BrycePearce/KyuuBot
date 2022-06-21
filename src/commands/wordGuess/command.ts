import { Message } from 'discord.js';
import { wordlist } from '../../utils/wordlist';
import { Command } from './../../types/Command';

let hintText = '';

const command: Command = {
  name: 'WordGuess',
  description: 'Player guesses the word to unscramble',
  invocations: ['guess', 'wordguess', 'scramble', 'unscramble'],
  args: false,
  enabled: true,
  usage: '[invocation]',
  async execute(message) {
    const word = wordlist[Math.floor(Math.random() * wordlist.length)];
    if (word.length <= 2) return;
    const scrambledWord = getshuffledWord(word); // 'raw' breaks it SOMETIMES
    hintText = ''.padStart(word.length, '*');
    let hasAnswerBeenGuessed = false;

    // begin quiz
    message.channel.send(`Unscramble this word: **${scrambledWord}**`);
    const collector = message.channel.createMessageCollector({ time: 32000 });

    // hint timers
    const numHints = getHintAmount(word);
    const firstHintTimeout = revealHintAtTime(message, hintText, word, numHints, 12000);
    const secondHintTimeout = revealHintAtTime(message, hintText, word, numHints, 23000);

    // listen for collection events
    collector.on('collect', (guess) => {
      if (guess.content.toLowerCase() === word.toLowerCase()) {
        hasAnswerBeenGuessed = true;
        message.channel.send(`${guess.author}'s answer ${word} was correct!`);
        collector.stop();
      }
    });

    collector.on('end', () => {
      clearTimeout(firstHintTimeout);
      clearTimeout(secondHintTimeout);
      if (!hasAnswerBeenGuessed) message.channel.send(`Time's up! The answer was ${word}`);
    });
  },
};

const getshuffledWord = (word: string) => {
  const shuffledWord = shuffle([...word]);
  while (shuffledWord !== word) {
    return shuffledWord;
  }
};

// Fisher-Yates
const shuffle = (word: string[]) => {
  let currentIndex = word.length;
  let randomIndex: number;

  // While there remain elements to shuffle.
  while (currentIndex != 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [word[currentIndex], word[randomIndex]] = [word[randomIndex], word[currentIndex]];
  }

  return word.join('');
};

const getHintAmount = (word: string) => {
  if (word.length <= 5) {
    return 1;
  } else if (word.length <= 10) {
    return 2;
  } else {
    return 3;
  }
};

const revealHintAtTime = (message: Message, hintText: string, answer: string, numHints: number, interval: number) => {
  const hintCharacters = hintText.split('');

  // get random characters to reveal
  for (let i = 0; i < numHints; i++) {
    const { randomIndex, letter } = getUnobfuscatedLetterIndex(answer, hintText);
    hintCharacters[randomIndex] = letter;
  }

  // rejoin hint
  const hintString = hintCharacters.join('');

  // print hint at interval
  return setTimeout(() => {
    const formattedHintString = hintString.replaceAll('*', '\\*');
    message.channel.send(`hint: ${formattedHintString}`);
  }, interval);
};

/*

  much more sane idea:
  when word is generated you randomly select [num characters to hide] indexes and store them
  
  revealHintAtTime takes a param [num indexes to reveal] the are generated when the word is
  e.g. if there are 6 hidden characters you would pass 3 for the first hint to reveal three
  
  the second hint can reveal the rest of the 6, e.g. whatever is not shown in the first hint

  then, right before the hint is sent (in settimeout), just take original word
  and star everything that isn't those indexes

  Much more straight forward than what I did

*/

const getUnobfuscatedLetterIndex = (word: string, hintText: string) => {
  let letter = '*';
  let randomIndex = 0;

  while (letter === '*') {
    randomIndex = Math.floor(Math.random() * word.length);

    if (hintText[randomIndex] === '*') {
      letter = word[randomIndex];
      return { letter, randomIndex };
    }
  }

  return { letter, randomIndex };
};

export default command;
