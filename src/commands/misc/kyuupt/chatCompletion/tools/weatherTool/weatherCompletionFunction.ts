import { getGeoLocation, getWeather } from '../../../../../../utils/weather/utils';

export async function handleWeatherFunction(location: string) {
  const geoCoords = await getGeoLocation(location);
  if (!geoCoords) {
    throw new Error(`Could not find location: ${location}`);
  }

  const lat = geoCoords.geometry?.location?.lat;
  const lng = geoCoords.geometry?.location?.lng;
  if (!lat || !lng) {
    throw new Error(`Incomplete geo data for: ${location}`);
  }

  const latlngString = `${lat},${lng}`;
  const weatherData = await getWeather({ latlng: latlngString, address: geoCoords.formatted_address });

  return weatherData;
}
