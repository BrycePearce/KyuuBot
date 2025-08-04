import { addPoints, getPointsForUser, setPoints } from '../../database/api/triviaApi';
import { Command } from '../../types/Command';
import triviaQuestions from '../../utils/trivia.json';

const maskCharacter = '∗';
const difficultyPts: Record<string, number> = {
  easy: 1,
  moderate: 2,
  difficult: 3,
};

type Difficulty = 'easy' | 'moderate' | 'difficult';

interface TriviaQuestion {
  type: string;
  difficulty: Difficulty;
  category: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
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

    if (message.content.toLowerCase().includes('addtriviapts') && message.author.id === '226100196675682304') {
      const parts = message.content.split(' ').slice(1);
      const [userId, ptsRaw] = parts;
      const pts = Number(ptsRaw);
      if (userId && !isNaN(pts)) {
        setPoints(message.guildId, userId, pts);
      }
      return;
    }

    const allQuestions = triviaQuestions as TriviaQuestion[];
    if (!Array.isArray(allQuestions) || allQuestions.length === 0) return;

    const picked = allQuestions[Math.floor(Math.random() * allQuestions.length)];
    const { question: displayedQuestion, correct_answer: answer, difficulty = 'easy' } = picked;

    const collector = channel.createMessageCollector({ time: 80000 });
    const startTime = new Date();

    await channel.send(displayedQuestion);

    const hintIntervals = [25000, 45000, 60000];
    let hintMask = generateStrMask(answer);
    let hintPercentToReveal = answer.length > 9 ? 40 : 15;

    const hintOutputTimers = hintIntervals.map((interval) =>
      setTimeout(() => {
        const revealedHint = revealHint(answer, hintMask, hintPercentToReveal);
        channel.send(`Hint: ${revealedHint}`);
        hintMask = revealedHint;
        hintPercentToReveal += 6;
      }, interval)
    );

    collector.on('collect', async (guess) => {
      try {
        if (guess.content.trim().toLowerCase() === answer.toLowerCase()) {
          collector.stop('success');
          const endTime = new Date();
          const pointsEarned = difficultyPts[difficulty] ?? 1;

          await addPoints(message.guildId, guess.author.id, pointsEarned);
          const totalpts = await getPointsForUser(message.guildId, guess.author.id);
          const elapsedTime = parseFloat(((endTime.valueOf() - startTime.valueOf()) / 1000).toFixed(3));

          await channel.send(
            `**Winner**: ${guess.author}; **Answer**: ${answer}; **Time**: ${elapsedTime}s; **Points**: ${pointsEarned}; **Total**: ${totalpts}`
          );
        }
      } catch (error) {
        console.error('Error when listening to trivia answers:', error);
      }
    });

    collector.on('end', async (_, reason) => {
      hintOutputTimers.forEach((timer) => clearTimeout(timer));
      if (reason === 'time') {
        await channel.send(`Time's up! The answer was **${answer}**`);
      }
    });
  },
};

const generateStrMask = (str: string) => {
  const specialChars = '!@#$%^&*()_+-=[]{}\\|;\':",./<>?';
  return [...str].map((char) => (specialChars.includes(char) || char === ' ' ? char : maskCharacter)).join('');
};

const revealHint = (word: string, mask: string, percent: number) => {
  const wordArray = [...word];
  const maskArray = [...mask];

  const indexesRevealable = maskArray.map((c, idx) => (c === maskCharacter ? idx : -1)).filter((i) => i !== -1);

  let numCharactersToReveal = Math.ceil((indexesRevealable.length * percent) / 100);
  if (numCharactersToReveal <= 0) return maskArray.join('');

  while (numCharactersToReveal > 0 && indexesRevealable.length > 0) {
    const idx = indexesRevealable[Math.floor(Math.random() * indexesRevealable.length)];
    if (maskArray[idx] === maskCharacter) {
      maskArray[idx] = wordArray[idx];
      numCharactersToReveal--;
    }
  }

  return maskArray.join('');
};

export default command;
