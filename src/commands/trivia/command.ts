import { addPoints, getPointsForUser, setPoints } from '../../database/api/triviaApi';
import { Command } from '../../types/Command';
import triviaQuestions from '../../utils/trivia.json';

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
  invocations: ['trivia', 't', 'question', 'addTriviaPts'],
  args: false,
  enabled: true,
  usage: '[invocation]',
  async execute(message) {
    const channel = message.channel;
    if (!channel.isSendable()) return;
    if (
      message.content.toLowerCase().includes('addTriviaPts'.toLowerCase()) &&
      message.author.id === '226100196675682304'
    ) {
      const [_, userId, pts] = message.content.split(' ').slice(1);
      setPoints(channel.id, userId, Number(pts));
      return;
    }
    const {
      question,
      answer: encodedAnswer,
      difficulty = 'easy', // easy, moderate, difficult
    } = (triviaQuestions as any).misc[
      Math.floor(Math.random() * (triviaQuestions as any).misc.length)
    ] as TriviaQuestion;

    const answer = decodeHTMLEntities(encodedAnswer).trim();

    const collector = channel.createMessageCollector({ time: 80000 });
    const startTime = new Date();

    // Ask the trivia question
    channel.send(decodeHTMLEntities(question));

    const hintIntervals = [25000, 45000, 60000];
    let hintMask = generateStrMask(answer);
    let hintPercentToReveal = answer.length > 9 ? 40 : 15; // todo: maybe could do this based off difficulty rating

    // start the hint timers, they will reveal after an interval amount of time
    const hintOutputTimers = hintIntervals.map((interval) =>
      setTimeout(() => {
        const revealedHint = revealHint(answer, hintMask, hintPercentToReveal);
        channel.send(`Hint: ${revealedHint}`);

        // update the hint mask
        hintMask = revealedHint;

        // give a flat 6% character reveal increase for the next hint
        hintPercentToReveal += 6;
      }, interval)
    );

    // start the timers for hints
    hintOutputTimers.forEach((hintTimer) => hintTimer);

    // listen for answers
    collector.on('collect', async (guess) => {
      try {
        if (guess.content.toLowerCase() === answer.toLowerCase()) {
          collector.stop('success');
          const endTime = new Date();
          const pointsEarned = difficultyPts[difficulty] ?? 1;

          await addPoints(message.channelId, guess.author.id, pointsEarned);

          const totalpts = await getPointsForUser(channel.id, guess.author.id);
          const elapsedTime = parseFloat(((endTime.valueOf() - startTime.valueOf()) / 1000).toFixed(3));
          await channel.send(
            `**Winner**: ${guess.author}; **Answer**: ${answer}; **Time**: ${elapsedTime}s; **Points**: ${pointsEarned}; **Total**: ${totalpts}`
          );
        }
      } catch (error) {
        console.error('Error when listening to trivia answers:', error);
      }
    });

    collector.on('end', async (_, msg) => {
      // clear out any hint timers left
      hintOutputTimers.forEach((timer) => clearTimeout(timer));

      if (msg.toLowerCase() === 'time') await channel.send(`Time's up! The answer was **${answer}**`);
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
    '&eacute;': 'é',
    '&atilde;': 'ã',
    '&micro;': 'µ',
  };

  return text.replace(/&#?\w+?;/g, (match) => entities[match] || match);
}

export default command;
