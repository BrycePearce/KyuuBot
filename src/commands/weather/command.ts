import { DarkSkyResponse } from '../../types/DarkSkyResponse';
import { getRandomEmotePath } from '../../utils/files';
import { Command } from './../../types/Command';
import { MessageEmbed } from 'discord.js';
import got from 'got';

const emojis = {
    "clear-night": "🌙",
    "rain": "☔️",
    "snow": "❄️",
    "sleet": "❄️",
    "wind": "💨",
    "fog": "🌫",
    "cloudy": "☁️",
    "partly-cloudy-day": "⛅️",
    "partly-cloudy-night": "☁️",
    "thunderstorm": "⛈",
    "tornado": "🌪"
};

export const command: Command = {
    name: 'Weather',
    description: 'Gets the weather',
    invocations: ['weather', 'we', 'w'],
    args: true,
    usage: '[invocation] [city | state | zip | etc]',
    async execute(message, args) {
        const userLocation = args.join(' ');
        try {
            const coords = await getGeoLocation(userLocation);
            if (!coords) {
                message.channel.send('Location was not found!', { files: [await getRandomEmotePath()] });
                return;
            }
            getWeather(coords);

            const exampleEmbed = new MessageEmbed()
        } catch (ex) {
            console.error(ex && ex['message'] || 'Something really went wrong');
        }
        // message.channel.send(`${lat} ${lng}`)
    }
};

const getGeoLocation = async (userLocation: string): Promise<google.maps.LatLng> => {
    return new Promise(async (resolve, reject) => {
        try {
            const geoCodeUri = encodeURI(`https://maps.googleapis.com/maps/api/geocode/json?address=${userLocation}&key=${process.env.googleGeoToken}`);
            const { results }: { results: google.maps.GeocoderResult[] } = await got(geoCodeUri).json();

            if (results?.length === 0) {
                resolve(null);
            };

            resolve(results[0].geometry.location);
        } catch (ex) {
            reject(new Error(`Failed to fetch coordinates. ${ex}`))
        }
    });
};

const getWeather = async ({ lat, lng }: google.maps.LatLng) => {
    console.log('wew', `https://api.darksky.net/forecast/${process.env.darkSkyToken}/${lat}/${lng}`)
    const darkskyApi = await got(`https://api.darksky.net/forecast/${process.env.darkSkyToken}/${lat},${lng}`).json() as DarkSkyResponse;
    console.log(darkskyApi.currently.apparentTemperature)
};

const generateOutputEmbed = (): MessageEmbed => {
    const exampleEmbed = new MessageEmbed()

    return exampleEmbed;
};