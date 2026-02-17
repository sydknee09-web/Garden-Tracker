/**
 * Fetch current weather via Open-Meteo.
 * Accepts optional user coordinates; falls back to Vista, CA defaults.
 */

export type WeatherSnapshot = {
  temp: number;
  condition: string;
  code: number;
  icon: string;
  wind_speed_mph: number;
} | null;

export type WeatherCoords = {
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
};

const DEFAULT_LAT = 33.2;
const DEFAULT_LNG = -117.2;
const DEFAULT_TZ = "America/Los_Angeles";

function weatherCodeToCondition(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 49) return "Fog";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  if (code <= 99) return "Thunderstorm";
  return "Clear";
}

function weatherCodeToIcon(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 49) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 86) return code <= 82 ? "🌦️" : "🌨️";
  return "⛈️";
}

function buildWeatherUrl(coords?: WeatherCoords | null): string {
  const lat = coords?.latitude ?? DEFAULT_LAT;
  const lng = coords?.longitude ?? DEFAULT_LNG;
  const tz = coords?.timezone ?? DEFAULT_TZ;
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&timezone=${encodeURIComponent(tz)}`;
}

/** Build the 7-day forecast URL (used by the dashboard). */
export function buildForecastUrl(coords?: WeatherCoords | null): string {
  const lat = coords?.latitude ?? DEFAULT_LAT;
  const lng = coords?.longitude ?? DEFAULT_LNG;
  const tz = coords?.timezone ?? DEFAULT_TZ;
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=${encodeURIComponent(tz)}&forecast_days=7`;
}

/** Fetch current weather. Optionally pass user coords; falls back to Vista, CA. */
export async function fetchWeatherSnapshot(coords?: WeatherCoords | null): Promise<WeatherSnapshot> {
  try {
    const res = await fetch(buildWeatherUrl(coords), { cache: "no-store" });
    const data = await res.json();
    const cur = data?.current;
    if (!cur) return null;
    const code = Number(cur.weather_code) || 0;
    const windKmh = Number(cur.wind_speed_10m) || 0;
    const windMph = Math.round(windKmh * 0.621371);
    return {
      temp: Number(cur.temperature_2m),
      condition: weatherCodeToCondition(code),
      code,
      icon: weatherCodeToIcon(code),
      wind_speed_mph: windMph,
    };
  } catch {
    return null;
  }
}

/** Format for "Weather at Planting" badge: e.g. "☀️ 68°F | 5mph Wind" */
export function formatWeatherBadge(snapshot: WeatherSnapshot | { temp?: number; icon?: string; wind_speed_mph?: number } | null): string {
  if (!snapshot || snapshot.temp == null) return "";
  const temp = Math.round(snapshot.temp);
  const icon = snapshot.icon ?? "🌤️";
  return `${icon} ${temp}°F${snapshot.wind_speed_mph != null ? ` | ${snapshot.wind_speed_mph}mph Wind` : ""}`;
}

// Re-export the helper functions for pages that render weather inline
export { weatherCodeToCondition, weatherCodeToIcon };
