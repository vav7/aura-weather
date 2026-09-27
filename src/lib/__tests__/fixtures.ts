/* Deterministic fixtures for engine/data unit tests (no network, no clocks). */
import { City, CityRecord, DayPoint, HourPoint } from "../data";

export const iso = (day: number, h: number) =>
  `2026-01-0${day}T${String(h).padStart(2, "0")}:00`;

export function hour(day: number, h: number, over: Partial<HourPoint> = {}): HourPoint {
  return {
    time: iso(day, h),
    temp: 20, feels: 19, code: 1, rainP: 5, precip: 0, clouds: 20,
    wind: 8, humidity: 55, uv: 3, vis: 22, isDay: h >= 7 && h < 19,
    ...over,
  };
}

export function day(idx: number, over: Partial<DayPoint> = {}): DayPoint {
  return {
    date: `2026-01-0${idx + 1}`, code: 1, tmax: 22, tmin: 14,
    sunrise: iso(idx + 1, 6), sunset: iso(idx + 1, 18),
    uvMax: 4, rainPMax: 10, precipSum: 0, windMax: 15,
    ...over,
  };
}

export interface RecOpts {
  temp?: number; feels?: number; rainP?: number; wind?: number; uv?: number;
  humidity?: number; aqi?: number | null; code?: number; vis?: number;
  hours?: HourPoint[]; days?: DayPoint[]; fetchedAt?: number; limited?: boolean;
}

/** A 48h / 7d record centred on "now" = 2026-01-01T12:00. */
export function record(o: RecOpts = {}): CityRecord {
  const t = o.temp ?? 21;
  const nowTime = iso(1, 12);
  const hours =
    o.hours ??
    Array.from({ length: 48 }, (_, i) => hour(Math.floor(i / 24) + 1, i % 24, i === 12 ? { temp: t, rainP: o.rainP ?? 5 } : {}));
  const days = o.days ?? Array.from({ length: 7 }, (_, i) => day(i));
  const aqi = o.aqi === undefined ? 25 : o.aqi;
  const air =
    aqi == null
      ? undefined
      : {
          now: { time: nowTime, aqi, pm25: aqi / 3, pm10: aqi / 2, o3: 40, no2: 8 },
          series: { times: hours.map((h) => h.time), aqi: hours.map(() => aqi), pm25: hours.map(() => aqi / 3) },
        };
  return {
    bundle: {
      weather: {
        current: {
          time: nowTime, temp: t, feels: o.feels ?? t - 1, humidity: o.humidity ?? 55,
          wind: o.wind ?? 10, windDir: 90, gusts: 0, code: o.code ?? 1, clouds: 20,
          precip: 0, pressure: 1013, isDay: true, uv: o.uv ?? 3, vis: o.vis ?? 24,
        },
        hours, days, timezone: "UTC",
      },
      air,
      source: "open-meteo",
      limited: o.limited,
    },
    fetchedAt: o.fetchedAt ?? Date.now(),
  };
}

export function city(id: string, over: Partial<City> = {}): City {
  return { id, name: id.toUpperCase(), country: "Testland", region: "EU", lat: 48, lon: 2, tier: 1, tags: [], ...over };
}

export const PERFECT: RecOpts = { temp: 22, feels: 21, humidity: 48, wind: 7, uv: 3, rainP: 0, aqi: 18, vis: 25, code: 0 };
export const HARSH: RecOpts = { temp: -12, feels: -18, humidity: 90, wind: 55, uv: 0, rainP: 95, aqi: 260, vis: 4, code: 95 };
