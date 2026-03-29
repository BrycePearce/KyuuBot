import { ColorResolvable } from 'discord.js';

export function fahrenheitToCelsius(f: number): string {
  return ((f - 32) * (5 / 9)).toFixed(1);
}

export function getWindDirection(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

export function formatTime(unix: number): string {
  return new Date(unix * 1000).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function getUvIndexRisk(uvIndex: number): string {
  if (uvIndex < 2) return 'Low';
  else if (uvIndex <= 5) return 'Moderate';
  else if (uvIndex <= 7) return 'High';
  else if (uvIndex <= 10) return 'Very high';
  else return 'Extreme';
}

export function tempToColor(temp: number): ColorResolvable {
  if (temp <= 20) return 'DarkBlue';
  else if (temp <= 60) return 'Aqua';
  else if (temp <= 75) return 'Green';
  else if (temp <= 85) return 'Orange';
  else if (temp <= 150) return 'Red';
  else return 'DarkNavy';
}
