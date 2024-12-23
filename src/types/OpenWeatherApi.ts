export interface OpenWeatherResponse {
  alerts?: {
    start: number;
    description: number;
    event: string;
  }[];
  lat: number;
  lon: number;
  timezone: string;
  timezone_offset: number;
  current: Current;
  hourly: Current[];
  daily: Daily[];
}

export interface Current {
  dt: number;
  sunrise?: number;
  sunset?: number;
  temp: number;
  feels_like: number;
  pressure: number;
  humidity: number;
  dew_point: number;
  uvi: number;
  clouds: number;
  visibility: number;
  wind_speed: number;
  wind_deg: number;
  wind_gust: number;
  weather: Weather[];
  pop?: number;
  rain?: Rain;
}

export interface Rain {
  '1h': number;
}

export interface Weather {
  id: number;
  main: Main;
  description: Description;
  icon: Icon;
}

export enum Description {
  BrokenClouds = 'broken clouds',
  ClearSky = 'clear sky',
  LightRain = 'light rain',
  ModerateRain = 'moderate rain',
  OvercastClouds = 'overcast clouds',
}

export enum Icon {
  The01D = '01d',
  The04D = '04d',
  The04N = '04n',
  The10D = '10d',
  The10N = '10n',
}

export enum Main {
  Clear = 'Clear',
  Clouds = 'Clouds',
  Rain = 'Rain',
}

export interface Daily {
  dt: number;
  sunrise: number;
  sunset: number;
  moonrise: number;
  moonset: number;
  moon_phase: number;
  temp: Temp;
  feels_like: FeelsLike;
  pressure: number;
  humidity: number;
  dew_point: number;
  wind_speed: number;
  wind_deg: number;
  wind_gust: number;
  weather: Weather[];
  clouds: number;
  pop: number;
  rain?: number;
  uvi: number;
}

export interface FeelsLike {
  day: number;
  night: number;
  eve: number;
  morn: number;
}

export interface Temp {
  day: number;
  min: number;
  max: number;
  night: number;
  eve: number;
  morn: number;
}

export type OpenWeatherAQI = {
  coord: [number, number];
  list: {
    dt: number;
    main: {
      aqi: 1 | 2 | 3 | 4 | 5;
    };
    components: {
      co: number;
      no: number;
      no2: number;
      o3: number;
      so2: number;
      pm2_5: number;
      pm10: number;
      nh3: number;
    };
  }[];
};

export type Location = {
  latlng: string;
  address: string;
};
