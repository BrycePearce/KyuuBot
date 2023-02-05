import { DI } from '../../database';
import { TriviaPoints } from '../entities';

export async function addPoints(channelId: string, userId: string, points: number) {
  const trivia = await DI.triviaPointsRepository.findOne({
    channelId,
    userId,
  });

  if (!trivia) {
    const userTriviaPoints = new TriviaPoints();
    userTriviaPoints.channelId = channelId;
    userTriviaPoints.userId = userId;
    userTriviaPoints.points = points;

    await DI.triviaPointsRepository.persistAndFlush(userTriviaPoints);
  } else {
    trivia.points += points;

    await DI.triviaPointsRepository.persistAndFlush(trivia);
  }
}

export async function getPoints(channelId: string, userId: string) {
  const trivia = await DI.triviaPointsRepository.findOne({ channelId, userId });

  if (!trivia) {
    return 0;
  }

  return trivia.points;
}
