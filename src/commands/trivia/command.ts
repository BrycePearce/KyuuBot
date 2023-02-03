import { Command } from '../../types/Command';
import triviaQuestions from '../../utils/trivia.json';

// :todo:
// 1.) up the hint percent shown based on the answer length
// 2.) make sure it shows spaces, special characters like ' by default. Currently blocks all
// 3.) [x] Actually listen for responses/answers
// 4.) Clear hint timeouts on answer
// 5.) Time's up! Handling
// 6.) Levenshtein distance on answer?
// 7.) Hints break on Batman answer
// 8.) Add tracked point totals
// 9.) More questions, question categories as optional param?

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
    message.channel.send(question);
    // message.channel.send(answer);
    const hintIntervals = [10000, 25000, 40000];
    let hintMask = generateMask(answer);
    const hintPercentToReveal = 10;

    const hintOutputTimers = hintIntervals.map((interval) =>
      setTimeout(() => {
        const revealedHint = revealHint(answer, hintMask, hintPercentToReveal);
        message.channel.send(`hint: ${revealedHint}`);
        hintMask = revealedHint;
      }, interval)
    );

    // start the timers for hints
    hintOutputTimers.forEach((hintTimer) => hintTimer);

    // listen for answers
    collector.on('collect', (guess) => {
      if (guess.content.toLowerCase() === answer.toLowerCase()) {
        message.channel.send(`Success! ${guess.author}`);
        hintOutputTimers.forEach((timer) => clearTimeout(timer));
        collector.stop();
      }
    });
  },
};

const generateMask = (str: string) => {
  return new Array(str.length).fill('∗').join('');
  // change all characters except special characters and spaces to asterisks
  // return str
  //   .split('')
  //   .map((character) => (/[^\s!-/:-@\[-`{-~]+/g.test(character) ? character : '*'))
  //   .join(',');
};

const revealHint = (word: string, mask: string, percent: number) => {
  let wordArray = [...word];
  let maskArray = [...mask];
  let indexesRevealable: string[] = maskArray.reduce(
    (accumulator, current, index) => (current === '∗' ? [index, ...accumulator] : accumulator),
    []
  );
  let numCharactersToReveal = Math.ceil((indexesRevealable.length * percent) / 100);

  while (numCharactersToReveal > 0) {
    const indexToReveal = Math.floor(Math.random() * maskArray.length);
    if (maskArray[indexToReveal] === '∗') {
      maskArray[indexToReveal] = wordArray[indexToReveal];
      numCharactersToReveal--;
    }
  }

  return maskArray.join('');
};

// const revealHintAtTime = (message: Message, answer: string, indexesToReveal: number[], interval: number) => {
//   // print hint at interval
//   return setTimeout(() => {
//     // generate hint string
//     const hintString = answer
//       .split('')
//       .map((character, answerIndex) => {
//         if (indexesToReveal.includes(answerIndex)) return character;
//         else if (character === ' ') return character;
//         return '*';
//       })
//       .join('');

//     const formattedHintString = hintString.replaceAll('*', '\\*');
//     message.channel.send(`hint: ${formattedHintString}`);
//   }, interval);
// };

export default command;
