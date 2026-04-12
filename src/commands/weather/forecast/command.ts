import { EmbedBuilder } from 'discord.js';
import { Command } from '../../../types/Command';
import { Daily, OpenWeatherResponse } from '../../../types/OpenWeatherApi';
import { getRandomEmotePath } from '../../../utils/files';
import { formatTime, tempToColor } from '../../../utils/weather/formatters';
import { getWeather } from '../../../utils/weather/utils';
import { resolveLocation } from '../locationResolver';

const command: Command = {
  name: 'Forecast',
  description: 'Gets a 5-day weather forecast',
  invocations: ['f', 'forecast', 'fc'],
  args: false,
  enabled: true,
  usage: '[invocation] [city | state | zip | etc]',
  async execute(message, args) {
    const channel = message.channel;
    if (!channel.isSendable()) return;
    try {
      const location = await resolveLocation(message, args, 'forecast');
      if (!location) return;

      const weather = await getWeather(location);
      const embed = generateForecastEmbed(weather, location.address);
      channel.send({ embeds: [embed] });
    } catch (ex) {
      console.error(ex);
      channel.send({ content: 'Something really went wrong', files: [await getRandomEmotePath()] });
    }
  },
};

const generateForecastEmbed = (weather: OpenWeatherResponse, formattedAddress: string): EmbedBuilder => {
  const embed = new EmbedBuilder();
  embed.setAuthor({ name: `5-Day Forecast — ${formattedAddress}` });

  for (const day of weather.daily.slice(0, 5)) {
    embed.addFields({ name: getDayLabel(day, weather.timezone), value: formatDayField(day), inline: true });
  }

  embed.setColor(tempToColor(weather.daily[0].temp.max));
  return embed;
};

function getDayLabel(day: Daily, timezone: string): string {
  const name = new Date(day.dt * 1000).toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone });
  const sunrise = formatTime(day.sunrise, timezone);
  const sunset = formatTime(day.sunset, timezone);
  return `${name}  (${sunrise} / ${sunset})`;
}

function formatDayField(day: Daily): string {
  const rainChance = (day.pop * 100).toFixed(0);
  return [
    day.weather[0].description[0].toUpperCase() + day.weather[0].description.slice(1),
    `Hi ${day.temp.max.toFixed(1)}F / Lo ${day.temp.min.toFixed(1)}F`,
    `Rain: ${rainChance}%`,
  ].join('\n');
}

export default command;
