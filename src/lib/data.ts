/* ------------------------------------------------------------------ */
/*  Aura · data layer: types, city catalog, condition map, AQI bands  */
/* ------------------------------------------------------------------ */

export interface City {
  id: string;
  name: string;
  country: string;
  region: string; // NA SA EU AF ME IN EA SEA OC
  lat: number;
  lon: number;
  tier: 1 | 2 | 3;
  tags: string[];
  featured?: boolean;
  custom?: boolean;
}

export interface CurrentWx {
  time: string;
  temp: number;
  feels: number;
  humidity: number;
  wind: number;
  windDir: number;
  gusts: number;
  code: number;
  clouds: number;
  precip: number;
  pressure: number;
  isDay: boolean;
  uv: number;
  vis: number;
}

export interface HourPoint {
  time: string; // local ISO in city tz, e.g. 2025-06-01T14:00
  temp: number;
  feels: number;
  code: number;
  rainP: number;
  precip: number;
  clouds: number;
  wind: number;
  humidity: number;
  uv: number;
  vis: number;
  isDay: boolean;
}

export interface DayPoint {
  date: string;
  code: number;
  tmax: number;
  tmin: number;
  sunrise: string;
  sunset: string;
  uvMax: number;
  rainPMax: number;
  precipSum: number;
  windMax: number;
}

export interface AirNow {
  time: string;
  aqi: number;
  pm25: number;
  pm10: number;
  o3: number;
  no2: number;
}
export interface AirSeries {
  times: string[];
  aqi: number[];
  pm25: number[];
}

export interface CityBundle {
  weather: { current: CurrentWx; hours: HourPoint[]; days: DayPoint[]; timezone: string };
  air?: { now: AirNow; series: AirSeries };
  airMissing?: boolean;
  source: "open-meteo" | "weatherapi";
  limited?: boolean; // fallback provider: reduced intelligence
}

export interface CityRecord {
  bundle: CityBundle;
  fetchedAt: number;
}

export type LoadStatus = "idle" | "queued" | "loading" | "live" | "stale" | "error";

/* ------------------------------- catalog ------------------------------- */

const c = (
  id: string, name: string, country: string, region: string, lat: number, lon: number,
  tier: 1 | 2 | 3, tags: string[], featured = false,
): City => ({ id, name, country, region, lat, lon, tier, tags, featured });

export const CITIES: City[] = [
  c("nyc", "New York", "United States", "NA", 40.71, -74.01, 1, ["urban", "travel", "food"], true),
  c("lax", "Los Angeles", "United States", "NA", 34.05, -118.24, 1, ["urban", "beach", "photography"], true),
  c("mia", "Miami", "United States", "NA", 25.76, -80.19, 1, ["beach", "tropical", "travel"]),
  c("chi", "Chicago", "United States", "NA", 41.88, -87.63, 1, ["urban", "cold"]),
  c("sea", "Seattle", "United States", "NA", 47.61, -122.33, 1, ["urban", "running"]),
  c("sfo", "San Francisco", "United States", "NA", 37.77, -122.42, 1, ["urban", "photography"], true),
  c("hnl", "Honolulu", "United States", "NA", 21.31, -157.86, 2, ["beach", "tropical", "travel"], true),
  c("yyz", "Toronto", "Canada", "NA", 43.65, -79.38, 1, ["urban", "cold"]),
  c("yvr", "Vancouver", "Canada", "NA", 49.28, -123.12, 1, ["mountains", "urban", "running"], true),
  c("mex", "Mexico City", "Mexico", "NA", 19.43, -99.13, 1, ["urban", "food"]),
  c("gru", "São Paulo", "Brazil", "SA", -23.55, -46.63, 1, ["urban", "food"]),
  c("rio", "Rio de Janeiro", "Brazil", "SA", -22.91, -43.17, 1, ["beach", "travel", "photography"], true),
  c("eze", "Buenos Aires", "Argentina", "SA", -34.6, -58.38, 1, ["urban", "food", "travel"]),
  c("scl", "Santiago", "Chile", "SA", -33.45, -70.67, 1, ["mountains", "urban"]),
  c("lim", "Lima", "Peru", "SA", -12.05, -77.04, 1, ["urban", "food"]),
  c("bog", "Bogotá", "Colombia", "SA", 4.71, -74.07, 1, ["mountains", "urban"]),
  c("mde", "Medellín", "Colombia", "SA", 6.24, -75.58, 1, ["urban", "travel"]),
  c("mvd", "Montevideo", "Uruguay", "SA", -34.9, -56.16, 2, ["beach", "urban"]),
  c("lon", "London", "United Kingdom", "EU", 51.51, -0.13, 1, ["urban", "travel", "food"], true),
  c("par", "Paris", "France", "EU", 48.86, 2.35, 1, ["urban", "travel", "food", "photography"], true),
  c("lis", "Lisbon", "Portugal", "EU", 38.72, -9.14, 1, ["beach", "travel", "running", "photography"], true),
  c("mad", "Madrid", "Spain", "EU", 40.42, -3.7, 1, ["urban", "food", "dry"]),
  c("bcn", "Barcelona", "Spain", "EU", 41.39, 2.17, 1, ["beach", "urban", "travel"], true),
  c("rom", "Rome", "Italy", "EU", 41.9, 12.5, 1, ["urban", "travel", "food", "photography"]),
  c("ath", "Athens", "Greece", "EU", 37.98, 23.73, 1, ["travel", "photography", "dry"]),
  c("ist", "Istanbul", "Türkiye", "EU", 41.01, 28.98, 1, ["urban", "travel", "food"]),
  c("ams", "Amsterdam", "Netherlands", "EU", 52.37, 4.9, 1, ["urban", "cold", "running"]),
  c("ber", "Berlin", "Germany", "EU", 52.52, 13.4, 1, ["urban", "cold"]),
  c("cph", "Copenhagen", "Denmark", "EU", 55.68, 12.57, 1, ["urban", "cold", "running"]),
  c("sto", "Stockholm", "Sweden", "EU", 59.33, 18.07, 1, ["urban", "cold"]),
  c("osl", "Oslo", "Norway", "EU", 59.91, 10.75, 2, ["cold", "mountains"]),
  c("zrh", "Zürich", "Switzerland", "EU", 47.37, 8.54, 1, ["mountains", "urban"]),
  c("vie", "Vienna", "Austria", "EU", 48.21, 16.37, 1, ["urban", "food"]),
  c("prg", "Prague", "Czechia", "EU", 50.08, 14.44, 1, ["urban", "travel", "photography"]),
  c("dub", "Dublin", "Ireland", "EU", 53.35, -6.26, 1, ["urban"]),
  c("rek", "Reykjavík", "Iceland", "EU", 64.15, -21.94, 2, ["cold", "photography", "travel"], true),
  c("waw", "Warsaw", "Poland", "EU", 52.23, 21.01, 1, ["urban", "cold"]),
  c("edi", "Edinburgh", "United Kingdom", "EU", 55.95, -3.19, 1, ["urban", "photography", "cold"]),
  c("cai", "Cairo", "Egypt", "AF", 30.04, 31.24, 1, ["dry", "travel"]),
  c("cpt", "Cape Town", "South Africa", "AF", -33.92, 18.42, 1, ["beach", "mountains", "photography", "travel"], true),
  c("los", "Lagos", "Nigeria", "AF", 6.52, 3.38, 1, ["urban", "tropical"]),
  c("nbo", "Nairobi", "Kenya", "AF", -1.29, 36.82, 1, ["urban", "running"]),
  c("cas", "Casablanca", "Morocco", "AF", 33.57, -7.59, 1, ["beach", "urban"]),
  c("rak", "Marrakesh", "Morocco", "AF", 31.63, -8.01, 1, ["dry", "travel", "photography"], true),
  c("acc", "Accra", "Ghana", "AF", 5.6, -0.19, 1, ["beach", "tropical"]),
  c("dxb", "Dubai", "UAE", "ME", 25.2, 55.27, 1, ["urban", "dry", "travel"], true),
  c("tlv", "Tel Aviv", "Israel", "ME", 32.08, 34.78, 1, ["beach", "urban", "food"]),
  c("doh", "Doha", "Qatar", "ME", 25.29, 51.53, 1, ["urban", "dry"]),
  c("ruh", "Riyadh", "Saudi Arabia", "ME", 24.71, 46.68, 1, ["dry", "urban"]),
  c("mct", "Muscat", "Oman", "ME", 23.59, 58.54, 2, ["beach", "dry"]),
  c("amm", "Amman", "Jordan", "ME", 31.95, 35.93, 1, ["dry", "urban"]),
  c("bom", "Mumbai", "India", "IN", 19.08, 72.88, 1, ["urban", "tropical", "food"]),
  c("del", "Delhi", "India", "IN", 28.61, 77.21, 1, ["urban", "dry"]),
  c("blr", "Bengaluru", "India", "IN", 12.97, 77.59, 1, ["urban"], true),
  c("maa", "Chennai", "India", "IN", 13.08, 80.27, 1, ["beach", "tropical", "urban"]),
  c("goi", "Goa", "India", "IN", 15.49, 73.83, 2, ["beach", "tropical", "travel"], true),
  c("jai", "Jaipur", "India", "IN", 26.92, 75.79, 1, ["dry", "travel", "photography"]),
  c("tyo", "Tokyo", "Japan", "EA", 35.68, 139.69, 1, ["urban", "food", "travel", "photography"], true),
  c("sel", "Seoul", "South Korea", "EA", 37.57, 126.98, 1, ["urban", "food"]),
  c("sha", "Shanghai", "China", "EA", 31.23, 121.47, 1, ["urban"]),
  c("pek", "Beijing", "China", "EA", 39.9, 116.41, 1, ["urban", "cold", "dry"]),
  c("tpe", "Taipei", "Taiwan", "EA", 25.03, 121.57, 1, ["urban", "tropical", "food"]),
  c("hkg", "Hong Kong", "China", "EA", 22.32, 114.17, 1, ["urban", "tropical", "photography"], true),
  c("osa", "Osaka", "Japan", "EA", 34.69, 135.5, 1, ["urban", "food"]),
  c("spk", "Sapporo", "Japan", "EA", 43.06, 141.35, 1, ["cold", "photography"]),
  c("sin", "Singapore", "Singapore", "SEA", 1.35, 103.82, 1, ["urban", "tropical", "food", "travel"], true),
  c("bkk", "Bangkok", "Thailand", "SEA", 13.76, 100.5, 1, ["urban", "tropical", "food"]),
  c("kul", "Kuala Lumpur", "Malaysia", "SEA", 3.14, 101.69, 1, ["urban", "tropical"]),
  c("jkt", "Jakarta", "Indonesia", "SEA", -6.21, 106.85, 1, ["urban", "tropical"]),
  c("mnl", "Manila", "Philippines", "SEA", 14.6, 120.98, 1, ["urban", "tropical", "beach"]),
  c("sgn", "Ho Chi Minh City", "Vietnam", "SEA", 10.82, 106.63, 1, ["urban", "tropical", "food"]),
  c("dps", "Denpasar · Bali", "Indonesia", "SEA", -8.65, 115.22, 2, ["beach", "tropical", "travel", "photography"], true),
  c("syd", "Sydney", "Australia", "OC", -33.87, 151.21, 1, ["beach", "urban", "travel", "running"], true),
  c("mel", "Melbourne", "Australia", "OC", -37.81, 144.96, 1, ["urban", "food", "running"]),
  c("bne", "Brisbane", "Australia", "OC", -27.47, 153.03, 1, ["urban", "beach"]),
  c("per", "Perth", "Australia", "OC", -31.95, 115.86, 1, ["beach", "urban", "dry"]),
  c("akl", "Auckland", "New Zealand", "OC", -36.85, 174.76, 1, ["urban", "beach", "running"]),
  c("zqn", "Queenstown", "New Zealand", "OC", -45.03, 168.66, 3, ["mountains", "photography", "travel", "cold"], true),
];

export const REGION_LABELS: Record<string, string> = {
  NA: "North America", SA: "South America", EU: "Europe", AF: "Africa",
  ME: "Middle East", IN: "India", EA: "East Asia", SEA: "Southeast Asia", OC: "Oceania",
};

/* ------------------------------ interests ------------------------------ */

export interface Interest { id: string; label: string; glyph: string; mode: string }
export const INTERESTS: Interest[] = [
  { id: "outdoors", label: "Outdoor weather", glyph: "sun", mode: "overall" },
  { id: "running", label: "Running", glyph: "run", mode: "running" },
  { id: "walking", label: "Walking", glyph: "walk", mode: "walking" },
  { id: "travel", label: "Travel", glyph: "plane", mode: "travel" },
  { id: "air", label: "Clean air", glyph: "leaf", mode: "air" },
  { id: "photo", label: "Photography", glyph: "camera", mode: "overall" },
  { id: "food", label: "Food & cafés", glyph: "food", mode: "overall" },
  { id: "commute", label: "Commute", glyph: "commute", mode: "overall" },
];

/* --------------------------- condition mapping -------------------------- */

export type IconKind =
  | "sun" | "moon" | "part-day" | "part-night" | "cloud" | "fog"
  | "drizzle" | "rain" | "snow" | "thunder" | "wind" | "drop" | "eye" | "gauge"
  | "leaf" | "camera" | "run" | "walk" | "bike" | "plane" | "food" | "commute"
  | "star" | "pin" | "search" | "locate" | "compare" | "spark" | "arrow" | "check"
  | "alert" | "x" | "clock" | "compass" | "layers" | "refresh" | "thermo" | "uv";

export function codeInfo(code: number, isDay: boolean): { label: string; icon: IconKind } {
  if (code === 0) return isDay ? { label: "Clear sky", icon: "sun" } : { label: "Clear night", icon: "moon" };
  if (code <= 2) return isDay ? { label: "Partly cloudy", icon: "part-day" } : { label: "Partly cloudy", icon: "part-night" };
  if (code === 3) return { label: "Overcast", icon: "cloud" };
  if (code === 45 || code === 48) return { label: "Fog", icon: "fog" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", icon: "drizzle" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: "Rain", icon: "rain" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: "Snow", icon: "snow" };
  if (code >= 95) return { label: "Thunderstorm", icon: "thunder" };
  return { label: "Cloudy", icon: "cloud" };
}

/* -------------------------------- AQI ---------------------------------- */

export function aqiBand(aqi: number): { label: string; tone: "mint" | "acc" | "coral" | "lav"; advice: string } {
  if (aqi <= 50) return { label: "Good", tone: "mint", advice: "Air is clean - breathe easy." };
  if (aqi <= 100) return { label: "Moderate", tone: "acc", advice: "Fine for most people; sensitive groups take it easy." };
  if (aqi <= 150) return { label: "Unhealthy · sensitive", tone: "coral", advice: "Sensitive groups should shorten intense effort." };
  if (aqi <= 200) return { label: "Unhealthy", tone: "coral", advice: "Keep hard outdoor sessions short." };
  if (aqi <= 300) return { label: "Very unhealthy", tone: "lav", advice: "Move intense activity indoors." };
  return { label: "Hazardous", tone: "coral", advice: "Avoid prolonged outdoor exposure." };
}

export function scoreTone(score: number): "mint" | "acc" | "coral" | "lav" {
  if (score >= 80) return "mint";
  if (score >= 62) return "acc";
  if (score >= 42) return "coral";
  return "lav";
}

export const TONE_VAR: Record<string, string> = {
  mint: "var(--mint)", acc: "var(--acc)", coral: "var(--coral)", lav: "var(--lav)", cy: "var(--cy)",
};

/* ------------------------------ units (°C/°F) ---------------------------- */

export type TempUnit = "C" | "F";

let UNIT: TempUnit = "C";

export function setUnitGlobal(u: TempUnit): void {
  UNIT = u;
}
export function getUnit(): TempUnit {
  return UNIT;
}

/** Format a Celsius value for display in the active unit. */
export function tf(v: number): string {
  return UNIT === "F" ? `${Math.round((v * 9) / 5 + 32)}°` : `${Math.round(v)}°`;
}

/** Format a temperature *delta* (scales by 9/5 in F, no offset). */
export function td(v: number): string {
  const d = UNIT === "F" ? (v * 9) / 5 : v;
  const r = Math.round(d);
  return `${r > 0 ? "+" : ""}${r}°`;
}

/** Unit suffix for words like "cooler/warmer" contexts. */
export function unitWord(): string {
  return UNIT === "F" ? "F" : "C";
}
