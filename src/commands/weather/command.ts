import { EmbedBuilder } from 'discord.js';
import { OpenWeatherAQI, OpenWeatherResponse } from '../../types/OpenWeatherApi';
import { getRandomEmotePath } from '../../utils/files';
import {
  fahrenheitToCelsius,
  formatTime,
  getUvIndexRisk,
  getWindDirection,
  tempToColor,
} from '../../utils/weather/formatters';
import { getAirQualityIndex, getWeather } from '../../utils/weather/utils';
import { Command } from './../../types/Command';
import { resolveLocation } from './locationResolver';

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
      const location = await resolveLocation(message, args, 'weather');
      if (!location) return;

      const weather = await getWeather(location);
      const aqi = await getAirQualityIndex(location);
      const weatherEmbed = generateOutputEmbed(weather, aqi, location.address);
      channel.send({ embeds: [weatherEmbed] });
    } catch (ex) {
      console.error(ex);
      channel.send({ content: 'Something really went wrong', files: [await getRandomEmotePath()] });
    }
  },
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
  const chanceRainPercentage = ((weather?.daily?.[0]?.pop ?? 0) * 100).toFixed(0);

  const nowUnix = Math.floor(Date.now() / 1000);
  const alertsMessage = weather?.alerts
    ? weather.alerts
        .filter((alert) => nowUnix >= alert.start && nowUnix <= alert.end)
        .map((alert) => `${alert.event} (until ${formatTime(alert.end)})`)
        .join('\n')
    : '';

  const embed = new EmbedBuilder();
  embed.setAuthor({
    iconURL: `https://openweathermap.org/img/wn/${currentWeather.weather[0].icon}.png`,
    name: formattedAddress,
  });

  embed.setDescription(`
        ${currentTemp}F / ${fahrenheitToCelsius(currentTemp)}C  *(Feels like ${currentWeather.feels_like}F)*
        **High/Low**: ${weather.daily[0].temp.max.toFixed(1)}F / ${weather.daily[0].temp.min.toFixed(1)}F
        **Cloud Cover**: ${currentWeather.clouds}%
        **Windspeed**: ${currentWeather.wind_speed}mph ${getWindDirection(currentWeather.wind_deg)}
        **Humidity**: ${currentWeather.humidity}%
        **Chance of Rain**: ${chanceRainPercentage}%
        **UV index**: ${weather.current.uvi} (${getUvIndexRisk(weather.current.uvi)})
        **AQI**: ${formattedAqi}
        **Sunrise/Sunset**: ${formatTime(currentWeather.sunrise)} / ${formatTime(currentWeather.sunset)}
        **Forecast**: ${
          !!currentWeather.weather[0].description &&
          currentWeather.weather[0].description[0].toUpperCase() + currentWeather.weather[0].description.slice(1)
        }
        ${alertsMessage ? `\n**Alerts**:\n ${alertsMessage}` : ''}
    `);

  embed.setColor(tempToColor(currentTemp));
  return embed;
};

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
