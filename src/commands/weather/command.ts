import { ColorResolvable, MessageEmbed } from 'discord.js';
import got from 'got';
import { User } from '../../database/entities';
import { OpenWeatherAQI, OpenWeatherResponse } from '../../types/OpenWeatherApi';
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
      const user = await DI.userRepository.findOne(message.author.id);
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
      const aqi = await getAirQualityIndex(requestedLocation);
      const weatherEmbed = generateOutputEmbed(weather, aqi, requestedLocation.address);
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

const getWeather = async (location: Location) => {
  const [lat, lng] = location.latlng.split(',');
  try {
    return (await got(
      `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lng}&appid=${process.env.openWeatherKey}`
    ).json()) as OpenWeatherResponse;
  } catch (ex) {
    console.error(ex);
    throw new Error('Open weather map is down');
  }
};

const getAirQualityIndex = async (location: Location) => {
  const [lat, lng] = location.latlng.split(',');
  const unixCurrentTime = Math.floor(Date.now() / 1000);
  const anHourFromNow = unixCurrentTime + 3600;

  try {
    return (await got(
      `http://api.openweathermap.org/data/2.5/air_pollution/history?lat=${lat}&lon=${lng}&start=${unixCurrentTime}&end=${anHourFromNow}&appid=${process.env.openWeatherKey}`
    ).json()) as OpenWeatherAQI;
  } catch {
    throw new Error('Open weather map AQI is down');
  }
};

const generateOutputEmbed = (
  weather: OpenWeatherResponse,
  aqi: OpenWeatherAQI,
  formattedAddress: string
): MessageEmbed => {
  const formattedAqi = getFormattedAirQualityLabel(aqi.list[0].main.aqi);
  const currentWeather = weather.current;
  const currentTemp = kelvinToFahrenheit(currentWeather.temp);
  const chanceRainToday = weather.daily[0].pop;

  const errors = weather?.alerts?.reduce((accum, alert) => {
    const dateIssued = new Date(alert.start);
    const timeIssued = dateIssued.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
    return (accum += `${alert.event} (${timeIssued})\n`);
  }, '');

  const embed = new MessageEmbed();
  embed.author = {
    iconURL: `https://openweathermap.org/img/wn/${currentWeather.weather[0].icon}.png`,
    name: formattedAddress,
  };

  embed.setDescription(`
        ${currentTemp}F / ${(((currentTemp - 32) * 5) / 9).toFixed(2)}C
        **Cloud Cover**: ${currentWeather.clouds}%
        **Windspeed**: ${currentWeather.wind_speed}mph
        **Humidity**: ${currentWeather.humidity}%
        **Chance of Rain**: ${convertDecimalToPercent(chanceRainToday).toFixed(0)}%
        **UV index**: ${weather.current.uvi} (${getUvIndexRisk(weather.current.uvi)})
        **AQI**: ${formattedAqi}
        **Forecast**: ${
          !!currentWeather.weather[0].description &&
          currentWeather.weather[0].description[0].toUpperCase() + currentWeather.weather[0].description.slice(1)
        }
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

function kelvinToFahrenheit(tempInKelvin: number) {
  const KELVIN_CONSTANT = 273.15;
  const tempInFahrenheit = (tempInKelvin - KELVIN_CONSTANT) * 1.8 + 32;
  return Number(tempInFahrenheit.toFixed(0));
}

const convertDecimalToPercent = (decimal: number, fixed: number = 2): number => {
  return Number(decimal.toFixed(fixed)) * 100;
};

function getUvIndexRisk(uvIndex: number): string {
  if (uvIndex < 2) {
    return 'Low';
  } else if (uvIndex >= 2 && uvIndex <= 5) {
    return 'Moderate';
  } else if (uvIndex >= 6 && uvIndex <= 7) {
    return 'High';
  } else if (uvIndex >= 8 && uvIndex <= 10) {
    return 'Very high';
  } else {
    return 'Extreme';
  }
}

function getFormattedAirQualityLabel(aqiIndex: 1 | 2 | 3 | 4 | 5) {
  switch (aqiIndex) {
    case 1:
      return 'Good';
    case 2:
      return 'Fair';
    case 3:
      return 'Moderate';
    case 4:
      return 'Poor';
    case 5:
      return 'Very Poor';
    default:
      return '😮‍💨🏭 (something went wrong!)';
  }
}

export default command;
