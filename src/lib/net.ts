/* ------------------------------------------------------------------ */
/*  Aura · network: providers, resilient queue, timestamped cache      */
/* ------------------------------------------------------------------ */

import { City, CityBundle, CityRecord, LoadStatus, AirSeries } from "./data";

const OM_FORECAST = "https://api.open-meteo.com/v1/forecast";
const OM_AIR = "https://air-quality-api.open-meteo.com/v1/air-quality";
export const OM_GEOCODE = "https://geocoding-api.open-meteo.com/v1/search";
const WA_KEY = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_WEATHERAPI_KEY ?? "";

/* ------------------------------ fetch core ----------------------------- */

export class NetError extends Error {}

export async function fetchJSON<T>(url: string, opts: { timeout?: number; signal?: AbortSignal } = {}): Promise<T> {
  if (typeof navigator !== "undefined" && !navigator.onLine) throw new NetError("offline");
  const ctrl = new AbortController();
  const timeout = opts.timeout ?? 9000;
  const timer = setTimeout(() => ctrl.abort(new NetError("timeout")), timeout);
  const onOuter = () => ctrl.abort(new NetError("cancelled"));
  opts.signal?.addEventListener("abort", onOuter);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new NetError(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new NetError("timeout");
    throw e instanceof NetError ? e : new NetError((e as Error).message ?? "network");
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onOuter);
  }
}

/* ---------------------------- Open-Meteo ------------------------------- */

interface OMForecast {
  timezone: string;
  current: Record<string, number | string>;
  hourly: Record<string, (number | null)[] | string[]>;
  daily: Record<string, (number | null)[] | string[]>;
}

function parseOMForecast(j: OMForecast): CityBundle["weather"] {
  const h = j.hourly;
  const times = h.time as string[];
  const num = (k: string) => (h[k] as (number | null)[]) ?? [];
  const curT = String(j.current.time ?? "").slice(0, 13);
  const curIdx = Math.max(0, times.findIndex((t) => t.startsWith(curT)));
  const hours = times.map((time, i) => ({
    time,
    temp: num("temperature_2m")[i] ?? 0,
    feels: num("apparent_temperature")[i] ?? num("temperature_2m")[i] ?? 0,
    code: num("weather_code")[i] ?? 3,
    rainP: num("precipitation_probability")[i] ?? 0,
    precip: num("precipitation")[i] ?? 0,
    clouds: num("cloud_cover")[i] ?? 0,
    wind: num("wind_speed_10m")[i] ?? 0,
    humidity: num("relative_humidity_2m")[i] ?? 50,
    uv: num("uv_index")[i] ?? 0,
    vis: (num("visibility")[i] ?? 20000) / 1000,
    isDay: (num("is_day")[i] ?? 1) === 1,
  }));
  const cur = hours[curIdx];
  const d = j.daily;
  const dnum = (k: string) => (d[k] as (number | null)[]) ?? [];
  const days = (d.time as string[]).map((date, i) => ({
    date,
    code: dnum("weather_code")[i] ?? 3,
    tmax: dnum("temperature_2m_max")[i] ?? 20,
    tmin: dnum("temperature_2m_min")[i] ?? 10,
    sunrise: String((d.sunrise as string[])[i] ?? ""),
    sunset: String((d.sunset as string[])[i] ?? ""),
    uvMax: dnum("uv_index_max")[i] ?? 0,
    rainPMax: dnum("precipitation_probability_max")[i] ?? 0,
    precipSum: dnum("precipitation_sum")[i] ?? 0,
    windMax: dnum("wind_speed_10m_max")[i] ?? 0,
  }));
  return {
    timezone: j.timezone,
    current: {
      time: cur.time,
      temp: cur.temp, feels: cur.feels, humidity: cur.humidity, wind: cur.wind,
      windDir: Number(j.current.wind_direction_10m ?? 0), gusts: Number(j.current.wind_gusts_10m ?? 0),
      code: cur.code, clouds: cur.clouds, precip: Number(j.current.precipitation ?? 0),
      pressure: Number(j.current.pressure_msl ?? 1013), isDay: cur.isDay, uv: cur.uv, vis: cur.vis,
    },
    hours,
    days,
  };
}

async function omBundle(city: City, signal?: AbortSignal): Promise<CityBundle> {
  const base = `latitude=${city.lat}&longitude=${city.lon}&timezone=auto`;
  const wxUrl = `${OM_FORECAST}?${base}&forecast_days=8&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,cloud_cover,visibility,uv_index,wind_speed_10m,relative_humidity_2m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max,precipitation_sum,wind_speed_10m_max`;
  const airUrl = `${OM_AIR}?${base}&current=us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide&hourly=us_aqi,pm2_5&forecast_days=2`;

  const [wxRes, airRes] = await Promise.allSettled([
    fetchJSON<OMForecast>(wxUrl, { signal, timeout: 9000 }),
    fetchJSON<{
      current?: Record<string, number | string>;
      hourly?: Record<string, (number | null)[] | string[]>;
    }>(airUrl, { signal, timeout: 9000 }),
  ]);

  if (wxRes.status === "rejected") throw wxRes.reason instanceof Error ? wxRes.reason : new NetError("weather failed");
  const weather = parseOMForecast(wxRes.value);

  let air: CityBundle["air"];
  let airMissing = false;
  if (airRes.status === "fulfilled" && airRes.value.current) {
    const cur = airRes.value.current;
    const ht = (airRes.value.hourly?.time as string[]) ?? [];
    const series: AirSeries = {
      times: ht,
      aqi: ((airRes.value.hourly?.us_aqi as (number | null)[]) ?? []).map((v) => v ?? 0),
      pm25: ((airRes.value.hourly?.pm2_5 as (number | null)[]) ?? []).map((v) => v ?? 0),
    };
    air = {
      now: {
        time: String(cur.time ?? ""),
        aqi: Number(cur.us_aqi ?? 0),
        pm25: Number(cur.pm2_5 ?? 0),
        pm10: Number(cur.pm10 ?? 0),
        o3: Number(cur.ozone ?? 0),
        no2: Number(cur.nitrogen_dioxide ?? 0),
      },
      series,
    };
  } else {
    airMissing = true;
  }
  return { weather, air, airMissing, source: "open-meteo" };
}

/* --------------------------- WeatherAPI fallback ----------------------- */

async function waBundle(city: City, signal?: AbortSignal): Promise<CityBundle> {
  if (!WA_KEY) throw new NetError("no fallback key");
  const j = await fetchJSON<{
    current?: { temp_c: number; feelslike_c: number; humidity: number; wind_kph: number; uv: number; condition?: { code: number; text: string }; pressure_mb: number; cloud: number };
    location?: { tz_id: string; localtime: string };
  }>(`https://api.weatherapi.com/v1/current.json?key=${WA_KEY}&q=${city.lat},${city.lon}&aqi=yes`, { signal, timeout: 9000 });
  if (!j.current) throw new NetError("fallback empty");
  const c = j.current;
  const hourIso = (j.location?.localtime ?? new Date().toISOString()).slice(0, 13) + ":00";
  const mk = (code: number) => ({
    time: hourIso, temp: c.temp_c, feels: c.feelslike_c, code, rainP: 0, precip: 0,
    clouds: c.cloud, wind: c.wind_kph, humidity: c.humidity, uv: c.uv, vis: 10, isDay: true,
  });
  const hour = mk(c.condition?.code === 1000 ? 0 : 3);
  return {
    weather: {
      timezone: j.location?.tz_id ?? "UTC",
      current: {
        time: hourIso, temp: c.temp_c, feels: c.feelslike_c, humidity: c.humidity,
        wind: c.wind_kph, windDir: 0, gusts: 0, code: hour.code, clouds: c.cloud, precip: 0,
        pressure: c.pressure_mb, isDay: true, uv: c.uv, vis: 10,
      },
      hours: Array.from({ length: 24 }, (_, i) => ({ ...hour, time: hourIso.slice(0, 13) + `:${String(i).padStart(2, "0")}` })),
      days: [{
        date: hourIso.slice(0, 10), code: hour.code, tmax: c.temp_c + 2, tmin: c.temp_c - 4,
        sunrise: "", sunset: "", uvMax: c.uv, rainPMax: 0, precipSum: 0, windMax: c.wind_kph,
      }],
    },
    source: "weatherapi",
    limited: true,
    airMissing: true,
  };
}

/* ------------------------------ the queue ------------------------------ */

export type QueueUpdate = (id: string, status: LoadStatus, rec?: CityRecord) => void;

interface Task { city: City; priority: number }

export class PulseQueue {
  private tasks: Task[] = [];
  private active = 0;
  private inflight = new Set<string>();
  private cancelled = false;
  private onUpdate: QueueUpdate;
  private concurrency: number;
  private maxRetries: number;

  constructor(onUpdate: QueueUpdate, concurrency = 4, maxRetries = 2) {
    this.onUpdate = onUpdate;
    this.concurrency = concurrency;
    this.maxRetries = maxRetries;
  }

  enqueue(cities: City[], priority = 0): void {
    for (const city of cities) {
      if (this.inflight.has(city.id) || this.tasks.some((t) => t.city.id === city.id)) continue;
      this.tasks.push({ city, priority });
    }
    this.tasks.sort((a, b) => b.priority - a.priority);
    this.pump();
  }

  cancelAll(): void {
    this.cancelled = true;
    this.tasks = [];
  }

  /** queued + in-flight tasks - used to know when a global refresh has drained */
  get pending(): number {
    return this.tasks.length + this.active;
  }

  private pump(): void {
    while (this.active < this.concurrency && this.tasks.length && !this.cancelled) {
      const task = this.tasks.shift();
      if (!task) break;
      this.active++;
      this.run(task).finally(() => {
        this.active--;
        this.inflight.delete(task.city.id);
        this.pump();
      });
    }
  }

  private async run(task: Task): Promise<void> {
    const { city } = task;
    this.inflight.add(city.id);
    this.onUpdate(city.id, "loading");
    let lastErr: unknown = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const bundle = await omBundle(city);
        this.onUpdate(city.id, "live", { bundle, fetchedAt: Date.now() });
        return;
      } catch (e) {
        lastErr = e;
        if (this.cancelled) return;
        if (attempt < this.maxRetries) {
          const backoff = 500 * 2 ** attempt + Math.random() * 350; // exponential + jitter
          await new Promise((r) => setTimeout(r, backoff));
        }
      }
    }
    // provider fallback before declaring the city unavailable
    try {
      const bundle = await waBundle(city);
      this.onUpdate(city.id, "live", { bundle, fetchedAt: Date.now() });
      return;
    } catch {
      /* fall through */
    }
    if (!this.cancelled) this.onUpdate(city.id, "error");
    void lastErr;
  }
}

/* -------------------------------- cache -------------------------------- */

const CACHE_KEY = "aura.v2.snapshot";
const FRESH_MS = 15 * 60 * 1000;

export { FRESH_MS };

interface Snapshot { v: number; savedAt: number; entries: Record<string, CityRecord> }

export function loadSnapshot(): Record<string, CityRecord> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const snap = JSON.parse(raw) as Snapshot;
    if (snap.v !== 2 || !snap.entries) return {};
    // trim hourly arrays defensively
    for (const id of Object.keys(snap.entries)) {
      const rec = snap.entries[id];
      if (rec?.bundle?.weather?.hours) rec.bundle.weather.hours = rec.bundle.weather.hours.slice(0, 96);
      if (rec?.bundle?.air?.series) {
        rec.bundle.air.series.times = rec.bundle.air.series.times.slice(0, 96);
        rec.bundle.air.series.aqi = rec.bundle.air.series.aqi.slice(0, 96);
        rec.bundle.air.series.pm25 = rec.bundle.air.series.pm25.slice(0, 96);
      }
    }
    return snap.entries;
  } catch {
    return {};
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
export function saveSnapshotDebounced(entries: Record<string, CityRecord>): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const slim: Record<string, CityRecord> = {};
      for (const [id, rec] of Object.entries(entries)) {
        slim[id] = {
          fetchedAt: rec.fetchedAt,
          bundle: {
            ...rec.bundle,
            weather: { ...rec.bundle.weather, hours: rec.bundle.weather.hours.slice(0, 96) },
            air: rec.bundle.air
              ? {
                  now: rec.bundle.air.now,
                  series: {
                    times: rec.bundle.air.series.times.slice(0, 96),
                    aqi: rec.bundle.air.series.aqi.slice(0, 96),
                    pm25: rec.bundle.air.series.pm25.slice(0, 96),
                  },
                }
              : undefined,
          },
        };
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify({ v: 2, savedAt: Date.now(), entries: slim }));
    } catch {
      /* storage full - ignore */
    }
  }, 1200);
}

/* ------------------------------ geocoding ------------------------------ */

export interface GeoResult { id: string; name: string; country: string; region: string; lat: number; lon: number }

export async function geocode(name: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const j = await fetchJSON<{ results?: { id: number; name: string; country?: string; admin1?: string; latitude: number; longitude: number }[] }>(
    `${OM_GEOCODE}?name=${encodeURIComponent(name)}&count=6&language=en&format=json`,
    { signal, timeout: 7000 },
  );
  return (j.results ?? []).map((r) => ({
    id: `geo_${r.id}`,
    name: r.name,
    country: r.country ?? "",
    region: r.admin1 ?? "",
    lat: r.latitude,
    lon: r.longitude,
  }));
}

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const j = await fetchJSON<{ city?: string; locality?: string; principalSubdivision?: string; countryName?: string }>(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
      { timeout: 6000 },
    );
    return j.city || j.locality || j.principalSubdivision || "Your location";
  } catch {
    return "Your location";
  }
}
