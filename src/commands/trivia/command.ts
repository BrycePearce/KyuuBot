import { Command } from '../../types/Command';
import triviaQuestions from '../../utils/trivia.json';

// :todo:
// 1.) [x] up the hint percent shown based on the answer length
// 2.) [x] make sure it shows spaces, special characters like ' by default. Currently blocks all
// 3.) [x] Actually listen for responses/answers
// 4.) [x] Clear hint timeouts on answer
// 5.) [x] Time's up! Handling
// 6.) Levenshtein distance on answer?
// 7.) [x] Hints break on Batman answer
// 8.) Add tracked point totals
// 9.) Question categories as optional second param?
// 10.) Difficulty rating for questions?

const maskCharacter = '∗';
const command: Command = {
  name: 'Trivia',
  description: 'Trivia questions',
  invocations: ['trivia', 't', 'question'],
  args: false,
  enabled: true,
  usage: '[invocation]',
  async execute(message) {
    const { question, answer } = triviaQuestions.misc[Math.floor(Math.random() * triviaQuestions.misc.length)];
    const collector = message.channel.createMessageCollector({ time: 60000 });

    // Ask the trivia question
    message.channel.send(question);

    const hintIntervals = [10000, 25000, 40000];
    let hintMask = generateStrMask(answer);
    let hintPercentToReveal = answer.length > 9 ? 40 : 15; // todo: maybe could do this based off difficulty rating

    // start the hint timers, they will reveal after an interval amount of time
    const hintOutputTimers = hintIntervals.map((interval) =>
      setTimeout(() => {
        const revealedHint = revealHint(answer, hintMask, hintPercentToReveal);
        message.channel.send(`hint: ${revealedHint}`);

        // update the hint mask
        hintMask = revealedHint;

        // give a flat 10% character reveal increase for the next hint
        hintPercentToReveal += 10;
      }, interval)
    );

    // start the timers for hints
    hintOutputTimers.forEach((hintTimer) => hintTimer);

    // listen for answers
    collector.on('collect', (guess) => {
      // todo: levenshtein distance
      if (guess.content.toLowerCase() === answer.toLowerCase()) {
        collector.stop('success');
        message.channel.send(`${guess.author} has the correct answer! `);
      }
    });

    collector.on('end', (_, msg) => {
      // clear out any hint timers left
      hintOutputTimers.forEach((timer) => clearTimeout(timer));

      if (msg.toLowerCase() === 'time') message.channel.send(`Time's up! The answer was **${answer}**`);
    });
  },
};

const generateStrMask = (str: string) => {
  // change all characters except special characters and spaces to asterisks
  const specialChars = '!@#$%^&*()_+-=[]{}\\|;\':",./<>?';
  return [...str].map((char) => (specialChars.includes(char) || char === ' ' ? char : maskCharacter)).join('');
};

const revealHint = (word: string, mask: string, percent: number) => {
  let wordArray = [...word];
  let maskArray = [...mask];

  // generate indexes to that are not already revealed
  let indexesRevealable: string[] = maskArray.reduce(
    (accumulator, current, index) => (current === maskCharacter ? [index, ...accumulator] : accumulator),
    []
  );

  // based on percent chance, determine the number of characters to reveal
  let numCharactersToReveal = Math.ceil((indexesRevealable.length * percent) / 100);

  if (numCharactersToReveal <= 0) return maskArray.join('');

  // if there are characters left to reveal, reveal them
  while (numCharactersToReveal > 0) {
    const indexToReveal = Math.floor(Math.random() * maskArray.length);
    if (maskArray[indexToReveal] === maskCharacter) {
      maskArray[indexToReveal] = wordArray[indexToReveal];
      numCharactersToReveal--;
    }
  }

  return maskArray.join('');
};

export default command;
