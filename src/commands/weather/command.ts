import { DarkSkyResponse } from '../../types/DarkSkyResponse';
import { ColorResolvable, MessageEmbed } from 'discord.js';
import { getRandomEmotePath } from '../../utils/files';
import { Command } from './../../types/Command';
import { readFile } from 'fs/promises';
import path from 'path';
import got from 'got';

const weatherIcons = {
    "clear-night": "🌙",
    "rain": "☔️",
    "snow": "❄️",
    "sleet": "❄️🌨️",
    "wind": "💨",
    "fog": "🌫️",
    "cloudy": "☁️",
    "partly-cloudy-day": "⛅️",
    "partly-cloudy-night": "☁️",
    "thunderstorm": "⚡",
    "tornado": "🌪️"
};

export const command: Command = {
    name: 'Weather',
    description: 'Gets the weather',
    invocations: ['weather', 'we', 'w'],
    args: true,
    enabled: false,
    usage: '[invocation] [city | state | zip | etc]',
    async execute(message, args) {
        const userLocation = await getUserLocation(message.author.username, args);
        if (!userLocation) {
            message.channel.send('Set your default location with .weather set YOUR_LOCATION')
        }

        try {
            const geoData = await getGeoLocation(userLocation);
            if (!geoData) {
                message.channel.send('Location was not found!', { files: [await getRandomEmotePath()] });
                return;
            }

            const weather = await getWeather(geoData.geometry.location);
            const weatherEmbed = generateOutputEmbed(weather, geoData.formatted_address);
            message.channel.send(weatherEmbed);
        } catch (ex) {
            console.error(ex);
            message.channel.send(ex && ex['message'] || 'Something really went wrong');
        }
    }
};

const getUserLocation = async (username: string, args: string[]): Promise<string> => {
    if (args.length === 0) {
        const pathToDb = path.normalize(path.join(path.join(__dirname, '../../../', 'db', 'DataStorage.json')));
        const storedUsers = JSON.parse(await readFile(pathToDb, "utf8"));
        const storedLocation = storedUsers[username];
        return storedLocation || '';
    }
    if (args[1].toLowerCase() === 'set') {
        // todo: implement
    }
    return args.join(' ');
};

const getGeoLocation = async (userLocation: string): Promise<google.maps.GeocoderResult> => {
    return new Promise(async (resolve, reject) => {
        try {
            const geoCodeUri = encodeURI(`https://maps.googleapis.com/maps/api/geocode/json?address=${userLocation}&key=${process.env.googleGeoToken}`);
            const { results }: { results: google.maps.GeocoderResult[] } = await got(geoCodeUri).json();

            if (results?.length === 0) {
                resolve(null);
            };
            resolve(results[0]);
        } catch (ex) {
            console.error(ex);
            reject(new Error('Failed to fetch coordinates'))
        }
    });
};

const getWeather = async ({ lat, lng }: google.maps.LatLng): Promise<DarkSkyResponse> => {
    try {
        return await got(`https://api.darksky.net/forecast/${process.env.darkSkyToken}/${lat},${lng}`).json() as DarkSkyResponse;
    } catch (ex) {
        console.error(ex);
        throw new Error('DarkSky is down');
    }
};

const generateOutputEmbed = (weather: DarkSkyResponse, formattedAddress: string): MessageEmbed => {
    const currentWeather = weather.currently;
    const currentTemp = Number(currentWeather.temperature.toFixed(2));
    const chanceRainToday = weather.daily.data.reduce((accum, curr) => accum + curr.precipProbability, 0) / weather.daily.data.length;
    const embed = new MessageEmbed();
    embed.title = `${weatherIcons[currentWeather.icon]} ${formattedAddress}`;
    embed.setDescription(`
        ${currentTemp}F / ${((currentTemp - 32) * 5 / 9).toFixed(2)}C
        **Cloud Cover**: ${convertDecimalToPercent(currentWeather.cloudCover)}%
        **Windspeed**: ${currentWeather.windSpeed}mph
        **Humidity**: ${convertDecimalToPercent(currentWeather.humidity)}%
        **Chance of Rain**: ${convertDecimalToPercent(chanceRainToday)}%
        **Forecast**: ${weather.daily.summary}
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