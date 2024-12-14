import { ColorResolvable, EmbedBuilder } from 'discord.js';
import got from 'got';
import { User } from '../../database/entities';
import { OpenWeatherAQI, OpenWeatherResponse } from '../../types/OpenWeatherApi';
import { getRandomEmotePath } from '../../utils/files';
import { DI } from './../../database';
import { Command } from './../../types/Command';

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
    const channel = message.channel;
    if (!channel.isSendable()) return;
    try {
      const user = await DI.userRepository.findOne(message.author.id);
      const isUpdatingLocation = args[0]?.toLowerCase().trim() === 'set' && !!args[1]?.length;
      const isStoredLocation = args.length === 0;

      if (!user && isStoredLocation) {
        channel.send('Set your default location with .weather set YOUR_LOCATION');
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
          channel.send({ content: 'Coordinates not found', files: [await getRandomEmotePath()] });
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
        channel.send(`Updated ${message.author.username}'s location to ${requestedLocation.address}`);
      }

      const weather = await getWeather(requestedLocation);
      const aqi = await getAirQualityIndex(requestedLocation);
      const weatherEmbed = generateOutputEmbed(weather, aqi, requestedLocation.address);
      channel.send({ embeds: [weatherEmbed] });
    } catch (ex) {
      console.error(ex);
      const errmsg = ex && ex['message'] ? 'Something really went wrong' : '';
      channel.send({ content: errmsg, files: [await getRandomEmotePath()] });
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
        return resolve(null);
      }

      return resolve(results[0]);
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
      `https://api.openweathermap.org/data/3.0/onecall?units=imperial&lat=${lat}&lon=${lng}&appid=${process.env.openWeatherKey}`
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
): EmbedBuilder => {
  const hasAqi = aqi?.list[0]?.main?.aqi;
  const formattedAqi = hasAqi ? getFormattedAirQualityLabel(aqi.list[0].main.aqi) : 'Error';
  const currentWeather = weather.current;
  const currentTemp = currentWeather.temp;
  const chanceRainToday = weather?.daily?.[0]?.pop ?? 0;
  const chanceRainPercentage = (chanceRainToday * 100).toFixed(0);

  const alertsMessage = weather?.alerts
    ? weather.alerts
        .map((alert) => {
          const dateIssued = new Date(alert.start);
          const timeIssued = dateIssued.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
          return `${alert.event} (${timeIssued})`;
        })
        .join('\n')
    : '';

  const embed = new EmbedBuilder();
  embed.setAuthor({
    iconURL: `https://openweathermap.org/img/wn/${currentWeather.weather[0].icon}.png`,
    name: formattedAddress,
  });

  embed.setDescription(`
        ${currentTemp}F / ${fahrenheitToCelsius(currentTemp)}C
        **Cloud Cover**: ${currentWeather.clouds}%
        **Windspeed**: ${currentWeather.wind_speed}mph
        **Humidity**: ${currentWeather.humidity}%
        **Chance of Rain**: ${chanceRainPercentage}%
        **UV index**: ${weather.current.uvi} (${getUvIndexRisk(weather.current.uvi)})
        **AQI**: ${formattedAqi}
        **Forecast**: ${
          !!currentWeather.weather[0].description &&
          currentWeather.weather[0].description[0].toUpperCase() + currentWeather.weather[0].description.slice(1)
        }
        ${alertsMessage ? `\n**Alerts**:\n ${alertsMessage}` : ''}
    `);

  let embedColor: ColorResolvable;
  if (currentTemp <= 20) embedColor = 'DarkBlue';
  else if (currentTemp <= 60) embedColor = 'Aqua';
  else if (currentTemp <= 75) embedColor = 'Green';
  else if (currentTemp <= 85) embedColor = 'Orange';
  else if (currentTemp <= 150) embedColor = 'Red';
  else embedColor = 'DarkNavy';

  embed.setColor(embedColor);
  return embed;
};

function fahrenheitToCelsius(f: number) {
  return ((f - 32) * (5 / 9)).toFixed(2);
}

function getUvIndexRisk(uvIndex: number): string {
  if (uvIndex < 2) {
    return 'Low';
  } else if (uvIndex <= 5) {
    return 'Moderate';
  } else if (uvIndex <= 7) {
    return 'High';
  } else if (uvIndex <= 10) {
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
