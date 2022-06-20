import { ColorResolvable, MessageEmbed } from 'discord.js';
import got from 'got';
import { User } from '../../database/entities';
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

type Location = {
  latlng: string;
  address: string;
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
      const isUpdatingLocation = args[0]?.toLowerCase().trim() === 'set' && !!args[1]?.length;
      const isStoredLocation = args.length === 0;

      if (!user && isStoredLocation) {
        message.channel.send('Set your default location with .weather set YOUR_LOCATION');
        return;
      }

      let requestedLocation: Location = null;
      if (isStoredLocation) {
        const storedLocation = { latlng: user.latlng, address: user.address };
        requestedLocation = storedLocation;
      } else {
        const parsedLocation = isUpdatingLocation ? args.slice(1).join('') : args.join('');
        const geoCoords = await getGeoLocation(parsedLocation);

        if (!geoCoords) {
          message.channel.send({ content: 'No chapter was found', files: [await getRandomEmotePath()] });
          return;
        }
        requestedLocation = {
          latlng: `${geoCoords.geometry.location.lat},${geoCoords.geometry.location.lng}`,
          address: geoCoords.formatted_address,
        };
      }

      if (isUpdatingLocation) {
        await updateOrCreateUser(
          user,
          message.author.id,
          message.author.username,
          isUpdatingLocation,
          requestedLocation
        );
        message.channel.send(`Updated ${message.author.username}'s location to ${requestedLocation.address}`);
      }

      const weather = await getWeather(requestedLocation);
      const weatherEmbed = generateOutputEmbed(weather, requestedLocation.address);
      message.channel.send({ embeds: [weatherEmbed] });
    } catch (ex) {
      console.error(ex);
      const errmsg = ex && ex['message'] ? 'Something really went wrong' : '';
      message.channel.send({ content: errmsg, files: [await getRandomEmotePath()] });
    }
  },
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
  if (isUpdatingLocation) {
    user.latlng = location.latlng;
    user.address = location.address;
  }
  await DI.userRepository.persistAndFlush(user);
};

const getWeather = async (location: Location): Promise<DarkSkyResponse> => {
  try {
    return (await got(
      `https://api.darksky.net/forecast/${process.env.darkSkyToken}/${location.latlng}`
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

  let embedColor: ColorResolvable;
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
