export interface DarkSkyResponse {
    latitude: number;
    longitude: number;
    timezone: string;
    currently: Currently;
    minutely: Minutely;
    hourly: Hourly;
    daily: Daily;
    alerts: Alert[];
}

export interface Alert {
    title: string;
    time: number;
    expires: number;
    description: string;
    uri: string;
}

export interface Currently {
    time: number;
    summary: string;
    icon: string;
    nearestStormDistance?: number;
    precipIntensity: number;
    precipIntensityError?: number;
    precipProbability: number;
    precipType: string;
    temperature: number;
    apparentTemperature: number;
    dewPoint: number;
    humidity: number;
    pressure: number;
    windSpeed: number;
    windGust: number;
    windBearing: number;
    cloudCover: number;
    uvIndex: number;
    visibility: number;
    ozone: number;
}

export interface Daily {
    summary: string;
    icon: string;
    data: DailyDatum[];
}

export interface DailyDatum {
    time: number;
    summary: string;
    icon: string;
    sunriseTime: number;
    sunsetTime: number;
    moonPhase: number;
    precipIntensity: number;
    precipIntensityMax: number;
    precipIntensityMaxTime: number;
    precipProbability: number;
    precipType: string;
    temperatureHigh: number;
    temperatureHighTime: number;
    temperatureLow: number;
    temperatureLowTime: number;
    apparentTemperatureHigh: number;
    apparentTemperatureHighTime: number;
    apparentTemperatureLow: number;
    apparentTemperatureLowTime: number;
    dewPoint: number;
    humidity: number;
    pressure: number;
    windSpeed: number;
    windGust: number;
    windGustTime: number;
    windBearing: number;
    cloudCover: number;
    uvIndex: number;
    uvIndexTime: number;
    visibility: number;
    ozone: number;
    temperatureMin: number;
    temperatureMinTime: number;
    temperatureMax: number;
    temperatureMaxTime: number;
    apparentTemperatureMin: number;
    apparentTemperatureMinTime: number;
    apparentTemperatureMax: number;
    apparentTemperatureMaxTime: number;
}

export interface Hourly {
    summary: string;
    icon: string;
    data: Currently[];
}

export interface Minutely {
    summary: string;
    icon: string;
    data: MinutelyDatum[];
}

export interface MinutelyDatum {
    time: number;
    precipIntensity: number;
    precipIntensityError: number;
    precipProbability: number;
    precipType: string;
}
