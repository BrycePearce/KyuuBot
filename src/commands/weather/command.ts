import { ColorResolvable, MessageEmbed } from 'discord.js';
import got from 'got';
import { Location, User } from '../../database/entities';
import { DarkSkyResponse } from '../../types/DarkSkyResponse';
import { getRandomEmotePath } from '../../utils/files';
import { DI } from './../../database';
import { Command } from './../../types/Command';

const weatherIcons = {
  'partly-cloudy-night': '☁️🌙',
  'partly-cloudy-day': '⛅️',
  'clear-night': '🌙',
  'clear-day': '☀️',
  thunderstorm: '⚡',
  sleet: '❄️🌨️',
  tornado: '🌪️',
  cloudy: '☁️',
  wind: '💨',
  snow: '❄️',
  rain: '☔️',
  fog: '🌫️',
};

const command: Command = {
  name: 'Weather',
  description: 'Gets the weather',
  invocations: ['weather', 'we', 'w'],
  args: true,
  enabled: true,
  usage: '[invocation] [city | state | zip | etc]',
  async execute(message, args) {
    try {
      let user = await DI.userRepository.findOne(message.author.id);
      const isUpdatingLocation = args[0]?.toLowerCase().trim() === 'set';
      const location = await getUserLocation(user, args, isUpdatingLocation);

      if (!location) {
        message.channel.send('Set your default location with .weather set YOUR_LOCATION');
        return;
      }

      if (isUpdatingLocation) {
        await updateOrCreateUser(user, message.author.id, message.author.username, isUpdatingLocation, location);
        message.channel.send(`Updated ${message.author.username}'s location to ${location.address}`);
      }

      const weather = await getWeather(location);
      const weatherEmbed = generateOutputEmbed(weather, location.address);
      message.channel.send(weatherEmbed);
    } catch (ex) {
      console.error(ex);
      message.channel.send((ex && ex['message']) || 'Something really went wrong', {
        files: [await getRandomEmotePath()],
      });
    }
  },
};

const getUserLocation = async (user: User, args: string[], isUpdatingLocation: boolean = false): Promise<Location> => {
  let requestedLocation = null;

  if (args.length === 0) {
    return user?.location || null;
  } else if (isUpdatingLocation) {
    requestedLocation = args.slice(1).join('');
  } else {
    requestedLocation = args.join('');
  }

  const geoData = await getGeoLocation(requestedLocation);
  if (!geoData) throw new Error('Location was not found!');

  const location = new Location();
  location.latlng = `${geoData.geometry.location.lat},${geoData.geometry.location.lng}`;
  location.address = geoData.formatted_address;

  return location;
};

const getGeoLocation = async (userLocation: string): Promise<google.maps.GeocoderResult> => {
  return new Promise(async (resolve, reject) => {
    try {
      const geoCodeUri = encodeURI(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${userLocation}&key=${process.env.googleGeoToken}`
      );
      const { results }: { results: google.maps.GeocoderResult[] } = await got(geoCodeUri).json();

      if (results?.length === 0) {
        resolve(null);
      }

      resolve(results[0]);
    } catch (ex) {
      console.error(ex);
      reject(new Error('Failed to fetch coordinates'));
    }
  });
};

const updateOrCreateUser = async (
  user: User,
  userId: string,
  username: string,
  isUpdatingLocation: boolean,
  location: Location
) => {
  if (!user) {
    user = new User();
    user.id = userId;
    user.username = username;
  }

  user.location = isUpdatingLocation ? location : null;
  await DI.userRepository.persistAndFlush(user);
};

const getWeather = async (location: Location): Promise<DarkSkyResponse> => {
  const [lat, lng] = location.latlng.split(',');
  try {
    return (await got(
      `https://api.darksky.net/forecast/${process.env.darkSkyToken}/${lat},${lng}`
    ).json()) as DarkSkyResponse;
  } catch (ex) {
    console.error(ex);
    throw new Error('DarkSky is down');
  }
};

const generateOutputEmbed = (weather: DarkSkyResponse, formattedAddress: string): MessageEmbed => {
  const currentWeather = weather.currently;
  const currentTemp = Number(currentWeather.temperature.toFixed(2));
  const chanceRainToday = weather.daily.data[0].precipProbability;

  const errors = weather?.alerts?.reduce((accum, alert) => {
    const dateIssued = new Date(alert.time);
    const timeIssued = dateIssued.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
    return (accum += `${alert.title} (${timeIssued})\n`);
  }, '');

  const embed = new MessageEmbed();
  embed.title = `${weatherIcons[currentWeather.icon] || ''} ${formattedAddress}`;
  embed.setDescription(`
        ${currentTemp}F / ${(((currentTemp - 32) * 5) / 9).toFixed(2)}C
        **Cloud Cover**: ${convertDecimalToPercent(currentWeather.cloudCover).toFixed(0)}%
        **Windspeed**: ${currentWeather.windSpeed}mph
        **Humidity**: ${convertDecimalToPercent(currentWeather.humidity).toFixed(0)}%
        **Chance of Rain**: ${convertDecimalToPercent(chanceRainToday).toFixed(0)}%
        **Forecast**: ${weather.daily.summary}
        ${errors ? `\n**Alerts**:\n ${errors}` : ''}
    `);

  let embedColor: ColorResolvable = '';
  if (currentTemp <= 20) embedColor = 'DARK_BLUE';
  else if (currentTemp <= 60) embedColor = 'AQUA';
  else if (currentTemp <= 75) embedColor = 'GREEN';
  else if (currentTemp <= 85) embedColor = 'ORANGE';
  else if (currentTemp <= 150) embedColor = 'RED';
  else embedColor = 'DARK_NAVY';

  embed.setColor(embedColor);
  return embed;
};

const convertDecimalToPercent = (decimal: number, fixed: number = 2): number => {
  return Number(decimal.toFixed(fixed)) * 100;
};

export default command;
