import { DI } from '../../database';
import { TriviaPoints } from '../entities';

export async function addPoints(guildId: string, userId: string, points: number) {
  const trivia = await DI.triviaPointsRepository.findOne({
    channelId: guildId,
    userId,
  });

  if (!trivia) {
    const userTriviaPoints = new TriviaPoints();
    userTriviaPoints.channelId = guildId;
    userTriviaPoints.userId = userId;
    userTriviaPoints.points = points;

    await DI.triviaPointsRepository.persistAndFlush(userTriviaPoints);
  } else {
    trivia.points += points;

    await DI.triviaPointsRepository.persistAndFlush(trivia);
  }
}

export async function getPoints(guildId: string, userId: string) {
  const trivia = await DI.triviaPointsRepository.findOne({ channelId: guildId, userId });

  if (!trivia) {
    return 0;
  }

  return trivia.points;
}
