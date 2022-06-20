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
    const word = wordlist[Math.floor(Math.random() * wordlist.length)];
    const scrambledWord = shuffle([...word]).join('');
    let hasAnswerBeenGuessed = false;

    // begin quiz
    message.channel.send(`Unscramble this word: **${scrambledWord}**`);
    const collector = message.channel.createMessageCollector({ time: 32000 });

    // hint timers
    const firstHint = handleHint(scrambledWord, 12000);
    const secondHint = handleHint(scrambledWord, 23000);

    // listen for collection events
    collector.on('collect', (guess) => {
      if (guess.content.toLowerCase() === word.toLowerCase()) {
        hasAnswerBeenGuessed = true;
        message.channel.send(`${guess.author}'s answer ${word} was correct!`);
        collector.stop();
      }
    });

    collector.on('end', () => {
      [firstHint, secondHint].forEach((timer) => clearInterval(timer));
      if (!hasAnswerBeenGuessed) message.channel.send(`Time's up! The answer was ${word}`);
    });
  },
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

  return word;
};

const handleHint = (scrambledWord: string, interval: number) => {
  return setTimeout(() => {
    console.log('hint', interval);
  }, interval);
};

export default command;
