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

const isRevealableChar = (char: string) => /\p{L}|\p{N}/u.test(char);

const normalizeTriviaText = (str: string) =>
  str
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ');

const getRevealableIndexes = (str: string) =>
  [...str].map((char, idx) => (isRevealableChar(char) ? idx : -1)).filter((idx) => idx !== -1);

const getInitialHintPercent = (answer: string) => {
  const revealableCount = getRevealableIndexes(answer).length;

  if (revealableCount <= 2) return 0;
  if (revealableCount <= 4) return 20;
  if (revealableCount <= 8) return 25;
  return 35;
};

const getHintPercentStep = (answer: string) => {
  const revealableCount = getRevealableIndexes(answer).length;

  if (revealableCount <= 2) return 0;
  if (revealableCount <= 4) return 15;
  if (revealableCount <= 8) return 10;
  return 8;
};

const generateStrMask = (str: string) =>
  [...str].map((char) => (isRevealableChar(char) ? maskCharacter : char)).join('');

const shuffleArray = <T>(array: T[]) => {
  const copy = [...array];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
};

const getWordRevealableIndexes = (answer: string) => {
  const chars = [...answer];
  const words: number[][] = [];
  let currentWord: number[] = [];

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];

    if (char === ' ') {
      if (currentWord.length > 0) {
        words.push(currentWord);
        currentWord = [];
      }
      continue;
    }

    if (isRevealableChar(char)) {
      currentWord.push(i);
    }
  }

  if (currentWord.length > 0) {
    words.push(currentWord);
  }

  return words;
};

const revealHint = (answer: string, currentMask: string, percentToReveal: number) => {
  const answerChars = [...answer];
  const maskChars = [...currentMask];

  const revealableIndexes = answerChars
    .map((char, idx) => (isRevealableChar(char) ? idx : -1))
    .filter((idx) => idx !== -1);

  const totalRevealableChars = revealableIndexes.length;

  if (totalRevealableChars === 0) {
    return currentMask;
  }

  const currentlyRevealedCount = revealableIndexes.reduce((count, idx) => {
    return maskChars[idx] !== maskCharacter ? count + 1 : count;
  }, 0);

  const currentlyHiddenIndexes = revealableIndexes.filter((idx) => maskChars[idx] === maskCharacter);

  if (currentlyHiddenIndexes.length === 0) {
    return currentMask;
  }

  // Never fully reveal the answer through hints alone.
  // For 1-character answers, this means no character hints at all.
  const maxAllowedTotalRevealed = Math.max(0, totalRevealableChars - 1);

  let targetTotalRevealed = Math.floor((totalRevealableChars * percentToReveal) / 100);

  if (percentToReveal > 0 && totalRevealableChars > 2) {
    targetTotalRevealed = Math.max(1, targetTotalRevealed);
  }

  targetTotalRevealed = Math.min(targetTotalRevealed, maxAllowedTotalRevealed);

  let charsToRevealNow = targetTotalRevealed - currentlyRevealedCount;

  if (charsToRevealNow <= 0) {
    return currentMask;
  }

  const wordIndexes = getWordRevealableIndexes(answer);

  const wordsByRevealProgress = wordIndexes
    .map((indexes) => ({
      indexes: shuffleArray(indexes.filter((idx) => maskChars[idx] === maskCharacter)),
      revealedCount: indexes.filter((idx) => maskChars[idx] !== maskCharacter).length,
    }))
    .filter((word) => word.indexes.length > 0)
    .sort((a, b) => a.revealedCount - b.revealedCount);

  const prioritizedIndexes: number[] = [];

  // Reveal in rounds across words so hints feel more evenly distributed.
  let addedInRound = true;
  while (addedInRound) {
    addedInRound = false;

    for (const word of wordsByRevealProgress) {
      if (word.indexes.length > 0) {
        const idx = word.indexes.shift();
        if (idx !== undefined) {
          prioritizedIndexes.push(idx);
          addedInRound = true;
        }
      }
    }
  }

  for (let i = 0; i < prioritizedIndexes.length && charsToRevealNow > 0; i++) {
    const idx = prioritizedIndexes[i];
    maskChars[idx] = answerChars[idx];
    charsToRevealNow--;
  }

  return maskChars.join('');
};

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

    const guildId = message.guild?.id ?? message.guildId ?? null;

    if (message.author.id === '226100196675682304') {
      // expect: .trivia addTriviaPts <userId> <points>
      const adminMatch = message.content.trim().match(/^\S+\s+addTriviaPts\s+(\d+)\s+(-?\d+)$/i);
      if (adminMatch) {
        if (!guildId) {
          await channel.send('This command can only be used in a server.');
          return;
        }

        const userId = adminMatch[1];
        const pts = Number(adminMatch[2]);

        if (!Number.isFinite(pts)) {
          await channel.send('Invalid points value.');
          return;
        }

        await setPoints(guildId, userId, pts);
        await channel.send(`Set trivia points for <@${userId}> to ${pts} on this server.`);
        return;
      }
    }

    const allQuestions = triviaQuestions as TriviaQuestion[];
    if (!Array.isArray(allQuestions) || allQuestions.length === 0) {
      await channel.send('No trivia questions are available right now.');
      return;
    }

    const picked = allQuestions[Math.floor(Math.random() * allQuestions.length)];
    const { question: displayedQuestion, correct_answer: answer, difficulty = 'easy', category } = picked;

    const normalizedAnswer = normalizeTriviaText(answer);

    const collector = channel.createMessageCollector({
      time: 80000,
      filter: (collectedMessage) => !collectedMessage.author.bot,
    });

    const startTime = Date.now();

    await channel.send(category ? `**${category}**\n${displayedQuestion}` : displayedQuestion);

    const hintIntervals = [25000, 45000, 60000];
    let hintMask = generateStrMask(answer);
    let hintPercentToReveal = getInitialHintPercent(answer);
    const hintPercentStep = getHintPercentStep(answer);

    const hintOutputTimers = hintIntervals.map((interval) =>
      setTimeout(() => {
        void (async () => {
          const revealedHint = revealHint(answer, hintMask, hintPercentToReveal);

          if (revealedHint !== hintMask) {
            hintMask = revealedHint;
            await channel.send(`Hint: ${revealedHint}`);
          }

          hintPercentToReveal += hintPercentStep;
        })().catch((error) => {
          console.error('Error when sending trivia hint:', error);
        });
      }, interval)
    );

    collector.on('collect', async (guess) => {
      try {
        const normalizedGuess = normalizeTriviaText(guess.content);

        if (normalizedGuess === normalizedAnswer) {
          collector.stop('success');

          const endTime = Date.now();
          const elapsedTime = ((endTime - startTime) / 1000).toFixed(3);
          const pointsEarned = difficultyPts[difficulty] ?? 1;

          if (!guildId) {
            await channel.send(`**Winner**: ${guess.author}; **Answer**: ${answer}; **Time**: ${elapsedTime}s`);
            return;
          }

          await addPoints(guildId, guess.author.id, pointsEarned);
          const totalPts = await getPointsForUser(guildId, guess.author.id);

          await channel.send(
            `**Winner**: ${guess.author}; **Answer**: ${answer}; **Time**: ${elapsedTime}s; **Points**: ${pointsEarned}; **Total**: ${totalPts}`
          );
        }
      } catch (error) {
        console.error('Error when listening to trivia answers:', error);
      }
    });

    collector.on('end', async (_, reason) => {
      hintOutputTimers.forEach((timer) => clearTimeout(timer));

      if (reason === 'time') {
        try {
          await channel.send(`Time's up! The answer was **${answer}**`);
        } catch (error) {
          console.error('Error when sending trivia timeout message:', error);
        }
      }
    });
  },
};

export default command;
