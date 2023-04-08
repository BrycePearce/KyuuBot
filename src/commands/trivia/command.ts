import { addPoints, getPoints } from '../../database/api/triviaApi';
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
// 8.) [x] Add tracked point totals
// 9.) Question categories as optional second param?
// 10.) Difficulty rating for questions?

const maskCharacter = '∗';
const difficultyPts = {
  easy: 1,
  moderate: 2,
  difficult: 3,
};

type Difficulty = 'easy' | 'moderate' | 'difficult';

interface TriviaQuestion {
  question: string;
  answer: string;
  difficulty: Difficulty;
}

const command: Command = {
  name: 'Trivia',
  description: 'Trivia questions',
  invocations: ['trivia', 't', 'question'],
  args: false,
  enabled: true,
  usage: '[invocation]',
  async execute(message) {
    const {
      question,
      answer,
      difficulty = 'easy', // easy, moderate, difficult
    } = triviaQuestions.misc[Math.floor(Math.random() * triviaQuestions.misc.length)] as TriviaQuestion;

    const collector = message.channel.createMessageCollector({ time: 65000 });
    const startTime = new Date();

    // Ask the trivia question
    message.channel.send(decodeHTMLEntities(question));

    const hintIntervals = [15000, 25000, 40000];
    let hintMask = generateStrMask(answer);
    let hintPercentToReveal = answer.length > 9 ? 40 : 15; // todo: maybe could do this based off difficulty rating

    // start the hint timers, they will reveal after an interval amount of time
    const hintOutputTimers = hintIntervals.map((interval) =>
      setTimeout(() => {
        const revealedHint = revealHint(answer, hintMask, hintPercentToReveal);
        message.channel.send(`Hint: ${revealedHint}`);

        // update the hint mask
        hintMask = revealedHint;

        // give a flat 10% character reveal increase for the next hint
        hintPercentToReveal += 10;
      }, interval)
    );

    // start the timers for hints
    hintOutputTimers.forEach((hintTimer) => hintTimer);

    // listen for answers
    collector.on('collect', async (guess) => {
      // todo: levenshtein distance
      if (guess.content.toLowerCase() === answer.toLowerCase()) {
        const endTime = new Date();
        collector.stop('success');
        const pointsEarned = difficultyPts[difficulty] ?? 1;

        await addPoints(message.channelId, guess.author.id, pointsEarned);

        const toalpts = await getPoints(message.channelId, guess.author.id);
        const elapsedTime = parseFloat(((endTime.valueOf() - startTime.valueOf()) / 1000).toFixed(3));
        message.channel.send(
          `**Winner**: ${guess.author}; **Answer**: ${answer}; **Time**: ${elapsedTime}s; **Points**: ${pointsEarned}; **Total**: ${toalpts}`
        );
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

function decodeHTMLEntities(text: string) {
  const entities = {
    '&quot;': '"',
    '&apos;': "'",
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&#039;': "'",
  };

  return text.replace(/&#?\w+?;/g, (match) => entities[match] || match);
}

export default command;
