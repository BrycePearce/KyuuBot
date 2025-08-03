import { getDbContext } from '..';
import { TriviaStats } from '../entities';
import { findOrCreateUser } from './userApi';

export async function addPoints(channelId: string, authorId: string, pointsEarned: number) {
  const { em, triviaStatsRepository } = getDbContext();
  const user = await findOrCreateUser(authorId);
  const trivia = await triviaStatsRepository.findOne({ channelId, user }, { populate: ['user'] });
  if (!trivia) {
    const userTriviaPoints = new TriviaStats();
    userTriviaPoints.channelId = channelId;
    userTriviaPoints.user = user;
    userTriviaPoints.points = pointsEarned;
    await em.persistAndFlush(userTriviaPoints);
  } else {
    trivia.points += pointsEarned;
    await em.persistAndFlush(trivia);
  }
}

export async function setPoints(channelId: string, userId: string, points: number) {
  const { em, triviaStatsRepository } = getDbContext();
  const user = await findOrCreateUser(userId);
  const trivia = await triviaStatsRepository.findOne(
    {
      channelId,
      user,
    },
    { populate: ['user'] }
  );

  if (!trivia) {
    const newStats = new TriviaStats();
    newStats.channelId = channelId;
    newStats.user = user;
    newStats.points = points;

    await em.persistAndFlush(newStats);
  } else {
    trivia.points = points;

    await em.persistAndFlush(trivia);
  }
}

export async function getPointsForUser(channelId: string, winnerId: string) {
  const user = await findOrCreateUser(winnerId);
  const { triviaStatsRepository } = getDbContext();
  const trivia = await triviaStatsRepository.findOne({ channelId, user }, { populate: ['user'] });
  return trivia ? trivia.points : 0;
}
