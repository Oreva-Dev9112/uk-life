// Real London: time of day, weather and daylight.
// Weather and sun times come from Open-Meteo (free, no API key). The data is CC BY 4.0 and is credited on the title screen.
import type { WeatherKind } from "./store";

const FORECAST_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=51.5072&longitude=-0.1276" +
  "&current=weather_code&hourly=weather_code&daily=sunrise,sunset&timezone=Europe%2FLondon&timeformat=unixtime&forecast_days=16";

interface Forecast {
  hourStart: number; // unix seconds of the first hourly entry
  kinds: WeatherKind[]; // one per hour from hourStart
  days: { start: number; sunrise: number; sunset: number }[]; // start in unix seconds (London midnight); sun times in London hours
}

let forecast: Forecast | null = null;

// WMO weather codes to the game's four kinds.
const kindOf = (code: number | null): WeatherKind => {
  const c = code ?? 3;
  return c <= 2 ? "clear" // clear to partly cloudy
    : c <= 48 ? "overcast" // overcast, fog
    : c <= 57 || c === 61 || c === 80 ? "drizzle" // drizzle, light rain, light showers
    : c <= 67 || c === 81 || c === 82 || c >= 95 ? "rain" // rain, heavy showers, thunder
    : "drizzle"; // snow (71-77, 85-86): there's no snow yet
};

/** Fetches London's 16-day forecast. Resolves false when offline or blocked, and the game makes up its own weather. */
export async function loadLondonForecast(): Promise<boolean> {
  try {
    const res = await fetch(FORECAST_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return false;
    const { current, hourly, daily } = await res.json();
    const kinds: WeatherKind[] = hourly.weather_code.map(kindOf);
    // The hourly forecast can differ from what's happening now, so the current hour uses the latest 15-minute reading.
    const nowHour = current ? Math.floor((current.time - hourly.time[0]) / 3600) : -1;
    if (nowHour >= 0 && nowHour < kinds.length) kinds[nowHour] = kindOf(current.weather_code);
    forecast = {
      hourStart: hourly.time[0],
      kinds,
      days: daily.time.map((start: number, i: number) => ({
        start,
        sunrise: (daily.sunrise[i] - start) / 3600,
        sunset: (daily.sunset[i] - start) / 3600,
      })),
    };
    return true;
  } catch {
    return false;
  }
}

/** London's weather at a real moment, and the minutes until the next forecast hour. Null when the forecast doesn't cover it. */
export function londonWeatherAt(ms: number): { kind: WeatherKind; minutesLeft: number } | null {
  if (!forecast) return null;
  const sec = ms / 1000 - forecast.hourStart;
  const i = Math.floor(sec / 3600);
  if (i < 0 || i >= forecast.kinds.length) return null;
  return { kind: forecast.kinds[i], minutesLeft: Math.max(1, 60 - (sec % 3600) / 60) };
}

/** Sunrise and sunset (London hours) on the day of a real moment; past the forecast it keeps the last day's. */
export function londonDaylightAt(ms: number): { sunrise: number; sunset: number } | null {
  if (!forecast) return null;
  const sec = ms / 1000;
  let day = forecast.days[0];
  for (const d of forecast.days) if (d.start <= sec) day = d;
  return day;
}

const londonClock = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "numeric", minute: "numeric", hourCycle: "h23" });

/** Minutes past midnight in London right now. */
export function londonMinutesNow(): number {
  const parts = londonClock.formatToParts(new Date());
  const num = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return num("hour") * 60 + num("minute");
}
