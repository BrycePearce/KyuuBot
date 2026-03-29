import { Message } from 'discord.js';
import { findOrCreateUser } from '../../database/api/userApi';
import { User } from '../../database/entities';
import { Location } from '../../types/OpenWeatherApi';
import { getDbContext } from '../../database';
import { getRandomEmotePath } from '../../utils/files';
import { getGeoLocation } from '../../utils/weather/utils';

export const resolveLocation = async (
  message: Message,
  args: string[],
  invocation: string
): Promise<Location | null> => {
  const channel = message.channel;
  if (!channel.isSendable()) return null;

  const user = await findOrCreateUser(message.author.id);
  const isUpdatingLocation = args[0]?.toLowerCase().trim() === 'set' && !!args[1]?.length;
  const isStoredLocationRequest = args.length === 0;
  const userHasNoLocation = !user?.latlng && !user?.address;

  if (userHasNoLocation && isStoredLocationRequest) {
    channel.send(`Set your default location with .${invocation} set YOUR_LOCATION`);
    return null;
  }

  let requestedLocation: Location = null;
  if (isStoredLocationRequest) {
    requestedLocation = { latlng: user.latlng, address: user.address };
  } else {
    const parsedLocation = isUpdatingLocation ? args.slice(1).join(' ') : args.join(' ');
    const geoCoords = await getGeoLocation(parsedLocation);

    if (!geoCoords) {
      channel.send({ content: 'Coordinates not found', files: [await getRandomEmotePath()] });
      return null;
    }
    requestedLocation = {
      latlng: `${geoCoords.geometry.location.lat},${geoCoords.geometry.location.lng}`,
      address: geoCoords.formatted_address,
    };
  }

  if (isUpdatingLocation) {
    await saveUserLocation(user, message.author.id, message.author.username, requestedLocation);
    channel.send(`Updated ${message.author.displayName}'s location to ${requestedLocation.address}`);
  }

  return requestedLocation;
};

const saveUserLocation = async (user: User, userId: string, username: string, location: Location) => {
  const { em } = getDbContext();
  if (!user) {
    user = new User();
    user.id = userId;
    user.username = username;
  }
  user.latlng = location.latlng;
  user.address = location.address;
  await em.persistAndFlush(user);
};
