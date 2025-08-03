import got from 'got';
import { Location, OpenWeatherAQI, OpenWeatherResponse } from '../../types/OpenWeatherApi';

type GeocoderResult = {
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
};

export const getGeoLocation = async (userLocation: string): Promise<GeocoderResult | null> => {
  return new Promise(async (resolve, reject) => {
    try {
      const geoCodeUri = encodeURI(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${userLocation}&key=${process.env.googleGeoToken}`
      );
      const { results }: { results: GeocoderResult[] } = await got(geoCodeUri).json();

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

export const getWeather = async (location: Location) => {
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

export const getAirQualityIndex = async (location: Location) => {
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
