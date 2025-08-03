import { getDbContext } from '..';
import { TriviaStats } from '../entities';
import { findOrCreateUser } from './userApi';
/*
userid - pts
177112397872365568 42052
226100196675682304 996
182320583491452928 804
85078157660524544  394
220707155060326400 29
203616025147604993 23
225435115923177472 15
785257081925926922 12
217050307769794571 11
816115581966090270 7
234423492777345026 6
136671110883180545 3
*/
export async function addPoints(channelId: string, authorId: string, pointsEarned: number) {
  const { em, triviaStatsRepository } = getDbContext();
  console.log('in add pts');
  const user = await findOrCreateUser(authorId);
  console.log('found or made user user', JSON.stringify(user));
  const trivia = await triviaStatsRepository.findOne({ channelId, user }, { populate: ['user'] });
  console.log('meow meow found trivia', trivia);
  if (!trivia) {
    console.log('not block');
    const userTriviaPoints = new TriviaStats();
    userTriviaPoints.channelId = channelId;
    userTriviaPoints.user = user;
    userTriviaPoints.points = pointsEarned;
    await em.persistAndFlush(userTriviaPoints);
  } else {
    console.log({"else block"})
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
  const { triviaStatsRepository } = getDbContext();
  const trivia = await triviaStatsRepository.findOne({ channelId, user: { id: winnerId } }, { populate: ['user'] });
  return trivia ? trivia.points : 0;
}
