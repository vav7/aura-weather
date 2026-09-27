/* ------------------------------------------------------------------ */
/*  Aura · intelligence engine: scoring, rankings, best hours, chat   */
/* ------------------------------------------------------------------ */

import {
  City, CityRecord, HourPoint, IconKind, aqiBand, codeInfo, scoreTone, tf, td,
} from "./data";

/* ------------------------------ helpers ------------------------------ */

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

function piecewise(v: number, pts: number[][]): number {
  if (v <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (v <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return y0 + ((v - x0) / (x1 - x0 || 1)) * (y1 - y0);
    }
  }
  return pts[pts.length - 1][1];
}

export interface Metrics {
  temp: number; feels: number; humidity: number; wind: number; uv: number;
  rainP: number; precip: number; clouds: number; vis: number; aqi: number | null;
}

export function metricsFromHour(h: HourPoint, aqi?: number | null): Metrics {
  return {
    temp: h.temp, feels: h.feels, humidity: h.humidity, wind: h.wind, uv: h.uv,
    rainP: h.rainP, precip: h.precip, clouds: h.clouds, vis: h.vis, aqi: aqi ?? null,
  };
}
export function metricsFromCurrent(r: CityRecord): Metrics {
  const c = r.bundle.weather.current;
  return {
    temp: c.temp, feels: c.feels, humidity: c.humidity, wind: c.wind, uv: c.uv,
    rainP: r.bundle.weather.hours.find((h: HourPoint) => h.time === c.time)?.rainP ?? 0,
    precip: c.precip, clouds: c.clouds, vis: c.vis,
    aqi: r.bundle.air ? r.bundle.air.now.aqi : null,
  };
}

/* --------------------------- component scores ------------------------- */

type CompKey = "temp" | "feels" | "warmth" | "humidity" | "wind" | "uv" | "rain" | "clouds" | "sun" | "clarity" | "vis" | "aqi";

const COMP: Record<CompKey, { label: string; good: string; bad: string; score: (m: Metrics) => number; show: (m: Metrics) => string }> = {
  temp: {
    label: "Temperature", good: "Comfortable temperature", bad: "Temperature out of comfort zone",
    score: (m) => piecewise(m.temp, [[-15, 0], [-5, 25], [5, 55], [12, 76], [18, 95], [22, 100], [26, 92], [30, 74], [35, 50], [42, 20], [50, 2]]),
    show: (m) => tf(m.temp),
  },
  feels: {
    label: "Outdoor comfort", good: "Comfortable out there", bad: "Feels harsh outside",
    score: (m) => piecewise(m.feels, [[-20, 0], [-10, 22], [0, 46], [8, 66], [14, 83], [18, 94], [21, 100], [24, 96], [27, 87], [31, 68], [36, 44], [43, 15], [50, 0]]),
    show: (m) => `feels ${tf(m.feels)}`,
  },
  warmth: {
    label: "Warmth", good: "Beautifully warm", bad: "Too cool for the beach",
    score: (m) => piecewise(m.feels, [[0, 4], [10, 25], [18, 55], [24, 82], [28, 100], [32, 94], [36, 68], [42, 32], [48, 6]]),
    show: (m) => `feels ${tf(m.feels)}`,
  },
  humidity: {
    label: "Humidity", good: "Comfortable humidity", bad: "Humidity is taxing",
    score: (m) => piecewise(m.humidity, [[0, 45], [15, 62], [30, 86], [45, 100], [55, 94], [65, 80], [75, 62], [85, 44], [100, 28]]),
    show: (m) => `${Math.round(m.humidity)}%`,
  },
  wind: {
    label: "Wind", good: "Light wind", bad: "Wind is a factor",
    score: (m) => piecewise(m.wind, [[0, 100], [8, 95], [14, 86], [22, 70], [30, 52], [40, 34], [55, 15], [75, 3], [100, 0]]),
    show: (m) => `${Math.round(m.wind)} km/h`,
  },
  uv: {
    label: "UV index", good: "Gentle UV", bad: "High UV - protect skin",
    score: (m) => piecewise(m.uv, [[0, 100], [2, 96], [4, 82], [6, 62], [8, 42], [10, 24], [12, 10], [14, 4]]),
    show: (m) => `UV ${Math.round(m.uv)}`,
  },
  rain: {
    label: "Rain risk", good: "Low rain risk", bad: "Real rain risk",
    score: (m) => {
      let s = piecewise(m.rainP, [[0, 100], [8, 93], [20, 80], [35, 62], [50, 45], [70, 25], [90, 10], [100, 4]]);
      if (m.precip > 2) s -= 12;
      return clamp(s);
    },
    show: (m) => `${Math.round(m.rainP)}%`,
  },
  clouds: {
    label: "Light quality", good: "Photogenic sky", bad: "Flat, heavy sky",
    score: (m) => piecewise(m.clouds, [[0, 70], [15, 88], [35, 100], [55, 92], [75, 62], [90, 44], [100, 30]]),
    show: (m) => `${Math.round(m.clouds)}% cloud`,
  },
  sun: {
    label: "Sunshine", good: "Plenty of sun", bad: "Little sunshine",
    score: (m) => clamp((100 - m.clouds) * 0.72 + (Math.min(m.uv, 9) / 9) * 100 * 0.28),
    show: (m) => `${Math.round(100 - m.clouds)}% clear`,
  },
  clarity: {
    label: "Night clarity", good: "Clear, dark skies", bad: "Clouds block the stars",
    score: (m) => clamp((100 - m.clouds) * 0.78 + piecewise(m.vis, [[0, 15], [5, 55], [12, 85], [25, 100]]) * 0.22),
    show: (m) => `${Math.round(m.clouds)}% cloud`,
  },
  vis: {
    label: "Visibility", good: "Long views", bad: "Poor visibility",
    score: (m) => piecewise(m.vis, [[0, 15], [1, 30], [4, 55], [8, 75], [12, 88], [18, 96], [25, 100], [40, 100]]),
    show: (m) => `${Math.round(m.vis)} km`,
  },
  aqi: {
    label: "Air quality", good: "Clean air", bad: "Polluted air",
    score: (m) => (m.aqi == null ? 55 : piecewise(m.aqi, [[0, 100], [20, 94], [40, 84], [60, 70], [80, 56], [100, 44], [130, 32], [160, 22], [200, 12], [300, 3], [400, 0]])),
    show: (m) => (m.aqi == null ? "AQI n/a" : `AQI ${Math.round(m.aqi)}`),
  },
};

/* ---------------------------- activity profiles ------------------------ */

export type ActivityId =
  | "overall" | "running" | "walking" | "cycling" | "travel" | "photography"
  | "beach" | "dining" | "commute" | "stargazing" | "gardening" | "workout";

const W: Record<ActivityId, [CompKey, number][]> = {
  overall: [["feels", 30], ["aqi", 25], ["rain", 15], ["temp", 10], ["humidity", 5], ["wind", 5], ["uv", 5], ["vis", 5]],
  running: [["temp", 22], ["humidity", 16], ["aqi", 18], ["rain", 18], ["wind", 12], ["uv", 8], ["feels", 6]],
  walking: [["rain", 22], ["temp", 20], ["aqi", 18], ["vis", 12], ["wind", 12], ["uv", 8], ["humidity", 8]],
  cycling: [["wind", 22], ["rain", 20], ["temp", 18], ["aqi", 15], ["humidity", 10], ["uv", 10], ["feels", 5]],
  travel: [["rain", 20], ["temp", 18], ["aqi", 15], ["vis", 15], ["uv", 10], ["wind", 10], ["humidity", 12]],
  photography: [["clouds", 25], ["vis", 25], ["rain", 20], ["temp", 15], ["uv", 10], ["wind", 5]],
  beach: [["warmth", 35], ["sun", 25], ["rain", 20], ["wind", 12], ["vis", 8]],
  dining: [["rain", 25], ["temp", 25], ["wind", 20], ["aqi", 15], ["humidity", 10], ["uv", 5]],
  commute: [["rain", 30], ["vis", 15], ["wind", 15], ["temp", 15], ["aqi", 15], ["humidity", 10]],
  stargazing: [["clarity", 45], ["vis", 25], ["rain", 20], ["humidity", 10]],
  gardening: [["temp", 25], ["humidity", 20], ["wind", 15], ["uv", 15], ["rain", 15], ["aqi", 10]],
  workout: [["temp", 25], ["humidity", 20], ["aqi", 20], ["rain", 15], ["wind", 10], ["uv", 10]],
};

export const ACTIVITY_LABEL: Record<ActivityId, string> = {
  overall: "being outdoors", running: "a run", walking: "a walk", cycling: "a ride",
  travel: "exploring", photography: "photography", beach: "the beach", dining: "dining outside",
  commute: "the commute", stargazing: "stargazing", gardening: "gardening", workout: "a workout",
};

export interface ScorePart { key: CompKey; label: string; weight: number; score: number; display: string }
export interface ScoreResult { total: number; parts: ScorePart[] }

export function calculateWeatherScore(m: Metrics, activity: ActivityId = "overall"): ScoreResult {
  const weights = W[activity];
  let total = 0;
  const parts: ScorePart[] = weights.map(([key, weight]) => {
    const score = Math.round(COMP[key].score(m));
    total += (score * weight) / 100;
    return { key, label: COMP[key].label, weight, score, display: COMP[key].show(m) };
  });
  return { total: Math.round(total), parts };
}

export function whyFromScore(res: ScoreResult): { strengths: string[]; cautions: string[] } {
  const sorted = [...res.parts].sort((a, b) => b.score - a.score);
  const strengths = sorted.filter((p) => p.score >= 80).slice(0, 3).map((p) => COMP[p.key].good);
  const cautions = sorted.filter((p) => p.score < 55).sort((a, b) => a.score - b.score).slice(0, 2).map((p) => COMP[p.key].bad);
  return { strengths, cautions };
}

/* --------------------------- aqi actions ---------------------------- */

export function aqiAction(aqi: number | null): string {
  if (aqi == null) return "Air quality is unmeasured right now - unknown, not assumed clean.";
  if (aqi <= 50) return "Great for outdoor exercise.";
  if (aqi <= 100) return "Fine for normal outdoor activity.";
  if (aqi <= 150) return "Sensitive users may want a shorter outdoor session.";
  if (aqi <= 200) return "Consider moving intense exercise indoors.";
  return "Heavy pollution - keep time outdoors brief.";
}

/* -------------------------- ranking model --------------------------- */

export interface WeightRow { label: string; pct: number }

export function modeWeights(mode: ModeId): { rows: WeightRow[]; note: string } {
  const from = (act: ActivityId): WeightRow[] => W[act].map(([k, pct]) => ({ label: COMP[k].label, pct }));
  switch (mode) {
    case "air":
      return { rows: [{ label: "US AQI (current)", pct: 100 }], note: "Pure air ranking - the lower the AQI reading, the higher the city climbs." };
    case "warm":
      return { rows: [{ label: "Current temperature", pct: 100 }], note: "A straight thermometer - highest current temperature first." };
    case "cool":
      return { rows: [{ label: "Current temperature", pct: 100 }], note: "A straight thermometer - lowest current temperature first." };
    case "dry":
      return { rows: [{ label: "Rain-risk score", pct: 100 }], note: "Built from current precipitation probability - lower is better." };
    case "wet":
      return { rows: [{ label: "Rain risk (inverted)", pct: 100 }], note: "Built from current precipitation probability - higher is better." };
    case "life":
      return { rows: [{ label: "Overall outdoor score", pct: 50 }, { label: "Clean-air score", pct: 50 }], note: "A 50/50 quality-of-life blend of weather comfort and pollution." };
    case "weekend":
      return { rows: [{ label: "Travel profile · days 1–3", pct: 100 }], note: "The travel-weighted score averaged across the next three forecast days." };
    default: {
      const act: ActivityId = mode === "running" ? "running" : mode === "walking" ? "walking" : mode === "travel" ? "travel" : "overall";
      return { rows: from(act), note: "Each factor is scored 0–100 against comfort curves, then blended with these weights." };
    }
  }
}

/* ----------------------------- day part ----------------------------- */

export function dayPart(time: string): string {
  const h = hourOfDay(time);
  if (h < 5) return "night";
  if (h < 12) return "morning";
  if (h < 14) return "midday";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

export function stars(score: number): number {
  if (score >= 90) return 5;
  if (score >= 78) return 4;
  if (score >= 62) return 3;
  if (score >= 45) return 2;
  return 1;
}
export function scoreWord(score: number): string {
  if (score >= 90) return "Exceptional";
  if (score >= 80) return "Excellent";
  if (score >= 68) return "Good";
  if (score >= 55) return "Fair";
  if (score >= 40) return "Poor";
  return "Harsh";
}

/* ------------------------------- rankings ------------------------------ */

export type ModeId =
  | "overall" | "air" | "running" | "walking" | "travel" | "warm" | "cool"
  | "dry" | "wet" | "life" | "weekend";

export interface RankItem {
  city: City;
  rec: CityRecord;
  score: number;       // headline score for the mode
  overall: ScoreResult;
  parts: ScorePart[];  // parts relevant to the mode's story
  headline: string;    // e.g. "18°" or "AQI 24"
  sub: string;         // e.g. "Feels 18° · Rain 8%"
  why: { strengths: string[]; cautions: string[] };
}

function dailyMetrics(rec: CityRecord, dayIdx: number): Metrics {
  const d = rec.bundle.weather.days[dayIdx];
  const cur = rec.bundle.weather.current;
  if (!d) return metricsFromCurrent(rec);
  return {
    temp: (d.tmax + d.tmin) / 2,
    feels: (d.tmax + d.tmin) / 2 - 1,
    humidity: cur.humidity,
    wind: d.windMax,
    uv: d.uvMax,
    rainP: d.rainPMax,
    precip: d.precipSum,
    clouds: 40,
    vis: cur.vis,
    aqi: rec.bundle.air ? rec.bundle.air.now.aqi : null,
  };
}

function modeScore(rec: CityRecord, mode: ModeId): { score: number; headline: string; sub: string; parts: ScorePart[] } {
  const m = metricsFromCurrent(rec);
  const c = rec.bundle.weather.current;
  const aqi = rec.bundle.air ? rec.bundle.air.now.aqi : null;
  const airS = COMP.aqi.score(m);
  switch (mode) {
    case "warm": {
      const score = Math.round(clamp(50 + m.temp * 1.6, 2, 99));
      return { score, headline: tf(m.temp), sub: `Feels ${tf(m.feels)} · ${codeInfo(c.code, c.isDay).label}`, parts: calcParts(m, "overall") };
    }
    case "cool": {
      const score = Math.round(clamp(50 - m.temp * 1.6, 2, 99));
      return { score, headline: tf(m.temp), sub: `Feels ${tf(m.feels)} · ${codeInfo(c.code, c.isDay).label}`, parts: calcParts(m, "overall") };
    }
    case "dry": {
      const s = COMP.rain.score(m);
      return { score: Math.round(s), headline: `${Math.round(m.rainP)}%`, sub: "rain chance · " + codeInfo(c.code, c.isDay).label, parts: calcParts(m, "walking") };
    }
    case "wet": {
      const s = 100 - COMP.rain.score(m);
      return { score: Math.round(s), headline: `${Math.round(m.rainP)}%`, sub: "rain chance · " + codeInfo(c.code, c.isDay).label, parts: calcParts(m, "walking") };
    }
    case "air":
      return { score: Math.round(airS), headline: aqi == null ? "n/a" : `AQI ${Math.round(aqi)}`, sub: aqiBand(aqi ?? 0).label, parts: calcParts(m, "overall") };
    case "life": {
      const overall = calculateWeatherScore(m, "overall").total;
      const score = Math.round(overall * 0.5 + airS * 0.5);
      return { score, headline: `${score}`, sub: `${tf(m.temp)} · AQI ${aqi == null ? "–" : Math.round(aqi)} · quality of life blend`, parts: calcParts(m, "overall") };
    }
    case "weekend": {
      const days = [1, 2, 3].filter((i) => rec.bundle.weather.days[i]);
      const avg = days.reduce((s, i) => s + calculateWeatherScore(dailyMetrics(rec, i), "travel").total, 0) / (days.length || 1);
      const d1 = rec.bundle.weather.days[1];
      const score = Math.round(avg);
      return {
        score, headline: `${score}`,
        sub: d1 ? `next 3 days · ${tf(d1.tmax)}/${tf(d1.tmin)} · rain ${Math.round(d1.rainPMax)}%` : "next 3 days",
        parts: calcParts(dailyMetrics(rec, 1), "travel"),
      };
    }
    default: {
      const act: ActivityId = mode === "running" ? "running" : mode === "walking" ? "walking" : mode === "travel" ? "travel" : "overall";
      const res = calculateWeatherScore(m, act);
      return { score: res.total, headline: `${res.total}`, sub: `${tf(m.temp)} · AQI ${aqi == null ? "–" : Math.round(aqi)} · rain ${Math.round(m.rainP)}%`, parts: res.parts };
    }
  }
}

function calcParts(m: Metrics, act: ActivityId): ScorePart[] {
  return calculateWeatherScore(m, act).parts;
}

export function rankCities(catalog: City[], records: Record<string, CityRecord>, mode: ModeId, limit = 10): RankItem[] {
  const items: RankItem[] = [];
  for (const city of catalog) {
    const rec = records[city.id];
    if (!rec) continue;
    const r = modeScore(rec, mode);
    if (r.headline === "n/a" && mode === "air") continue;
    items.push({
      city, rec, score: r.score, headline: r.headline, sub: r.sub, parts: r.parts,
      overall: calculateWeatherScore(metricsFromCurrent(rec), "overall"),
      why: whyFromScore(calculateWeatherScore(metricsFromCurrent(rec), mode === "air" ? "overall" : mode === "running" ? "running" : mode === "walking" ? "walking" : mode === "travel" ? "travel" : "overall")),
    });
  }
  items.sort((a, b) => b.score - a.score);
  return items.slice(0, limit);
}

export function edgeOver(item: RankItem, next: RankItem | undefined): string[] {
  if (!next) return [];
  const out: string[] = [];
  const mapA = new Map(item.parts.map((p) => [p.key, p]));
  const mapB = new Map(next.parts.map((p) => [p.key, p]));
  for (const [key, pA] of mapA) {
    const pB = mapB.get(key);
    if (!pB) continue;
    const d = Math.round(pA.score - pB.score);
    if (Math.abs(d) >= 6) out.push(`${d > 0 ? "+" : ""}${d} ${pA.label.toLowerCase()}`);
  }
  return out.slice(0, 4);
}

/* ------------------------------ best hours ----------------------------- */

export interface BestHour { hour: HourPoint; score: number; aqi: number | null; star: number }
export interface BestWindow { best: BestHour | null; second: BestHour | null; avoid: BestHour | null }

const DAYTIME: Partial<Record<ActivityId, [number, number]>> = {
  stargazing: [20, 4],
};

function hourOfDay(time: string): number {
  const m = time.match(/T(\d{2}):/);
  return m ? parseInt(m[1], 10) : 12;
}

export function findBestHour(rec: CityRecord, activity: ActivityId, horizon = 36): BestWindow {
  const { hours, current } = rec.bundle.weather;
  const startIdx = Math.max(0, hours.findIndex((h) => h.time >= current.time));
  const win: [number, number] = DAYTIME[activity] ?? [5, 22];
  const candidates: BestHour[] = [];
  const airTimes = rec.bundle.air?.series.times ?? [];
  for (let i = startIdx; i < Math.min(startIdx + horizon, hours.length); i++) {
    const h = hours[i];
    const hod = hourOfDay(h.time);
    const inWin = win[0] <= win[1] ? hod >= win[0] && hod <= win[1] : hod >= win[0] || hod <= win[1];
    if (!inWin) continue;
    const ai = airTimes.indexOf(h.time);
    const aqi = ai >= 0 && rec.bundle.air ? rec.bundle.air.series.aqi[ai] : rec.bundle.air?.now.aqi ?? null;
    const score = calculateWeatherScore(metricsFromHour(h, aqi), activity).total;
    candidates.push({ hour: h, score, aqi, star: stars(score) });
  }
  if (!candidates.length) return { best: null, second: null, avoid: null };
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const worst = [...candidates].sort((a, b) => a.score - b.score)[0];
  return {
    best: sorted[0] ?? null,
    second: sorted[1] && sorted[1].hour.time !== sorted[0].hour.time ? sorted[1] : sorted[2] ?? null,
    avoid: worst && worst.hour.time !== sorted[0].hour.time ? worst : null,
  };
}

/* ------------------------------ time format ---------------------------- */

export function fmtHour(time: string): string {
  const h = hourOfDay(time);
  const suffix = h < 12 ? "AM" : "PM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh} ${suffix}`;
}
export function fmtHourShort(time: string): string {
  const h = hourOfDay(time);
  return h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`;
}
export function dayLabel(dateIso: string, idx: number): string {
  if (idx === 0) return "Today";
  const d = new Date(dateIso + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" });
}
export function agoLabel(ts: number): string {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
export function localClock(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone }).format(new Date());
  } catch {
    return "";
  }
}

/* ------------------------------ aura speaks ---------------------------- */

export function buildAuraSays(city: City, rec: CityRecord, activity: ActivityId = "walking"): string {
  const m = metricsFromCurrent(rec);
  const overall = calculateWeatherScore(m, "overall").total;
  const today = rec.bundle.weather.days[0];
  const c = rec.bundle.weather.current;
  const cond = codeInfo(c.code, c.isDay).label.toLowerCase();
  let opener: string;
  if (overall >= 85) opener = `${city.name} is genuinely beautiful right now - ${cond}, ${tf(m.temp)} feeling like ${tf(m.feels)}.`;
  else if (overall >= 70) opener = `Conditions in ${city.name} are looking good: ${cond.toLowerCase()}, ${tf(m.temp)} (feels ${tf(m.feels)}).`;
  else if (overall >= 52) opener = `${city.name} is mixed right now - ${cond.toLowerCase()} at ${tf(m.temp)}, so pick your windows.`;
  else opener = `A tough stretch in ${city.name}: ${cond.toLowerCase()}, ${tf(m.temp)} feeling like ${tf(m.feels)}.`;

  let rainLine = "";
  if (today) {
    if (today.rainPMax <= 15) rainLine = "Rain stays out of the picture all day.";
    else if (m.rainP <= 15) rainLine = `It's dry at the moment, but the chance of rain peaks near ${Math.round(today.rainPMax)}% later - plan around it.`;
    else rainLine = `Rain is a real thread today, peaking near ${Math.round(today.rainPMax)}%.`;
  }

  let airLine = "";
  if (rec.bundle.air) airLine = aqiBand(rec.bundle.air.now.aqi).advice;

  const bw = findBestHour(rec, activity);
  let bestLine = "";
  if (bw.best) {
    bestLine = `If you're up for ${ACTIVITY_LABEL[activity]}, the sweet spot lands around ${fmtHour(bw.best.hour.time)} - ${tf(bw.best.hour.temp)}, rain ${Math.round(bw.best.hour.rainP)}%, wind ${Math.round(bw.best.hour.wind)} km/h.`;
  }
  return [opener, rainLine, airLine, bestLine].filter(Boolean).join(" ");
}

/* ------------------------------ ask aura ------------------------------- */

export interface AskAction { label: string; cityId?: string; mode?: ModeId; view: "home" | "city" | "compare"; compareIds?: string[] }
export interface AskAnswer { text: string[]; actions?: AskAction[]; followUps?: string[]; cityId?: string }

const CITY_FOLLOWS = ["What should I wear there?", "Is the air good?", "What about tomorrow?"];
const GLOBAL_FOLLOWS = ["Where should I run?", "Best weekend escape", "Cleanest air right now"];

const ACTIVITY_WORDS: [RegExp, ActivityId][] = [
  [/run|jog/i, "running"], [/walk|hike/i, "walking"], [/cycl|bike|ride/i, "cycling"],
  [/photo|shoot|camera/i, "photography"], [/beach|swim|surf/i, "beach"],
  [/din|dinner|lunch|eat|café|cafe|picnic/i, "dining"], [/star|astro|night sky/i, "stargazing"],
  [/garden/i, "gardening"], [/commut/i, "commute"], [/workout|train|exercise|gym/i, "workout"],
  [/travel|trip|visit|sightsee|vacation|escape/i, "travel"],
];

function findCity(q: string, catalog: City[]): City | undefined {
  const clean = q.toLowerCase().replace(/[^a-z0-9áâãéêíóôõúüç\s·&-]/g, " ");
  let best: City | undefined;
  let bestScore = 0;
  for (const city of catalog) {
    const variants = [city.name.toLowerCase(), ...city.name.toLowerCase().split(/[·-]/).map((s) => s.trim())];
    for (const name of variants) {
      if (name.length < 3) continue;
      if (clean.includes(name)) {
        const s = name.length + (clean.startsWith(name) ? 5 : 0);
        if (s > bestScore) { best = city; bestScore = s; }
      }
    }
  }
  return best;
}

function topLine(item: RankItem, n: number): string {
  const redundant = item.headline === String(item.score);
  return `${n}. ${item.city.name} - ${item.headline}${redundant ? "" : ` (score ${item.score})`} · ${item.sub}`;
}

export function answerQuestion(
  q: string,
  catalog: City[],
  records: Record<string, CityRecord>,
  ctxCityId?: string,
): AskAnswer {
  const text: string[] = [];
  const actions: AskAction[] = [];
  let city = findCity(q, catalog);
  // follow-up questions ("what should I wear?") inherit the last city discussed -
  // but "where …" questions always stay global board queries
  const ctxScoped = !/^where\b/i.test(q) && /(wear|outfit|clothes|tomorrow|umbrella|should i run|run now|go outside|head out|air good|the air|is it|now\??\s*$)/i.test(q);
  if (!city && ctxCityId && ctxScoped) city = catalog.find((c) => c.id === ctxCityId);

  const compareMatch = q.match(/compare\s+(.+?)\s+(?:and|vs\.?|&|with)\s+(.+)/i);
  if (compareMatch) {
    const a = findCity(compareMatch[1], catalog);
    const b = findCity(compareMatch[2], catalog);
    if (a && b && records[a.id] && records[b.id]) {
      const ma = metricsFromCurrent(records[a.id]);
      const mb = metricsFromCurrent(records[b.id]);
      const sa = calculateWeatherScore(ma, "overall").total;
      const sb = calculateWeatherScore(mb, "overall").total;
      const winner = sa >= sb ? a : b;
      text.push(`${a.name} scores ${sa} overall vs ${b.name} at ${sb}. ${winner.name} edges it - ${tf((sa >= sb ? ma : mb).temp)} feeling like ${tf((sa >= sb ? ma : mb).feels)}, rain ${Math.round((sa >= sb ? ma : mb).rainP)}%, AQI ${(sa >= sb ? ma : mb).aqi == null ? "n/a" : Math.round((sa >= sb ? ma : mb).aqi as number)}.`);
      actions.push({ label: `Open comparison`, view: "compare", compareIds: [a.id, b.id] });
      return { text, actions };
    }
    text.push("I couldn't match both cities in my atlas. Try names like “compare Lisbon and Tokyo”.");
    return { text };
  }

  const activity = ACTIVITY_WORDS.find(([re]) => re.test(q))?.[1];

  if (city && records[city.id]) {
    const rec = records[city.id];
    const m = metricsFromCurrent(rec);
    const overall = calculateWeatherScore(m, "overall");
    const c = rec.bundle.weather.current;

    if (/tomorrow/i.test(q)) {
      const d = rec.bundle.weather.days[1];
      if (d) {
        text.push(`${city.name} tomorrow: ${codeInfo(d.code, true).label.toLowerCase()}, ${tf(d.tmax)}/${tf(d.tmin)}, rain up to ${Math.round(d.rainPMax)}%, wind to ${Math.round(d.windMax)} km/h, UV ${Math.round(d.uvMax)}.`);
        const s = calculateWeatherScore(dailyMetrics(rec, 1), "overall").total;
        text.push(`The outdoor dial lands at ${s}/100 - ${scoreWord(s).toLowerCase()}.`);
      } else text.push(`Tomorrow's forecast for ${city.name} hasn't arrived yet - today's data is live.`);
      actions.push({ label: `Open ${city.name}`, view: "city", cityId: city.id });
      return { text, actions, cityId: city.id, followUps: ["What should I wear there?", "Do I need an umbrella?", "Best weekend escape"] };
    }

    if (/wear|outfit|clothes|dress|jacket|coat|hoodie|layer/i.test(q)) {
      const t = m.feels;
      const base =
        t >= 24 ? "Light, breathable layers - proper T-shirt weather"
        : t >= 17 ? "A T-shirt with something light for shade or breeze"
        : t >= 11 ? "Long sleeves plus a light jacket"
        : t >= 4 ? "A warm mid-layer under a windproof shell"
        : "Proper coat weather - layer up";
      const extras: string[] = [];
      if (m.rainP >= 40) extras.push("take something waterproof");
      if (m.uv >= 7) extras.push("UV is high, so sunscreen and sunglasses");
      if (m.wind >= 30) extras.push(`wind at ${Math.round(m.wind)} km/h will bite - block it`);
      if (m.aqi != null && m.aqi > 100) extras.push("the air is heavy - sensitive lungs may prefer a mask");
      text.push(`${city.name} feels like ${tf(t)} right now. ${base}${extras.length ? " - and " + extras.join("; ") : ""}.`);
      actions.push({ label: `Open ${city.name}`, view: "city", cityId: city.id });
      return { text, actions, cityId: city.id, followUps: ["Should I run now?", "Do I need an umbrella?", "What about tomorrow?"] };
    }

    if (/should i run|run now|good to run|ok to run/i.test(q)) {
      const nowS = calculateWeatherScore(m, "running").total;
      const bw = findBestHour(rec, "running");
      const best = bw.best?.score ?? nowS;
      if (nowS >= best - 8) {
        text.push(`Yes - right now is ${scoreWord(nowS).toLowerCase()} for a run in ${city.name}: ${tf(m.temp)}, rain ${Math.round(m.rainP)}%, wind ${Math.round(m.wind)} km/h, AQI ${m.aqi == null ? "n/a" : Math.round(m.aqi)}. Running score ${nowS}/100.`);
      } else if (bw.best) {
        text.push(`You could run now (${nowS}/100), but ${fmtHour(bw.best.hour.time)} is markedly better at ${bw.best.score}/100 - ${tf(bw.best.hour.temp)} with ${Math.round(bw.best.hour.rainP)}% rain risk.`);
      } else {
        text.push(`Running in ${city.name} scores ${nowS}/100 right now - ${scoreWord(nowS).toLowerCase()}.`);
      }
      actions.push({ label: `Open ${city.name}`, view: "city", cityId: city.id });
      return { text, actions, cityId: city.id, followUps: ["What should I wear there?", "How is the air quality?", "What about tomorrow?"] };
    }

    if (/when.*(go outside|head out|leave the house)|best time to go out/i.test(q)) {
      const bw = findBestHour(rec, "walking");
      if (bw.best) {
        text.push(`Nicest window to be out in ${city.name}: around ${fmtHour(bw.best.hour.time)} - ${tf(bw.best.hour.temp)}, rain ${Math.round(bw.best.hour.rainP)}%, wind ${Math.round(bw.best.hour.wind)} km/h. That's ${bw.best.score}/100 on the outdoor dial${bw.avoid ? `. I'd steer clear of ${fmtHour(bw.avoid.hour.time)} (only ${bw.avoid.score})` : ""}.`);
      } else text.push(`${city.name} has no clean window in the next day - conditions stay compromised.`);
      actions.push({ label: `Open ${city.name}`, view: "city", cityId: city.id });
      return { text, actions, cityId: city.id, followUps: ["What should I wear there?", "Do I need an umbrella?", "Is the air good?"] };
    }

    if (activity) {
      const bw = findBestHour(rec, activity);
      if (bw.best) {
        text.push(`Best time for ${ACTIVITY_LABEL[activity]} in ${city.name}: around ${fmtHour(bw.best.hour.time)} - ${tf(bw.best.hour.temp)}, rain ${Math.round(bw.best.hour.rainP)}%, wind ${Math.round(bw.best.hour.wind)} km/h${bw.best.aqi != null ? `, AQI ${Math.round(bw.best.aqi)}` : ""}. That's ${scoreWord(bw.best.score).toLowerCase()} (${bw.best.star}/5).`);
        if (bw.second) text.push(`Runner-up: ${fmtHour(bw.second.hour.time)} (${bw.second.score}).${bw.avoid ? ` I'd avoid ${fmtHour(bw.avoid.hour.time)} - only ${bw.avoid.score}.` : ""}`);
        actions.push({ label: `Open ${city.name}`, view: "city", cityId: city.id });
        return { text, actions };
      }
    }
    if (/rain|umbrella|wet/i.test(q)) {
      const today = rec.bundle.weather.days[0];
      const next = rec.bundle.weather.hours.slice(0, 12).reduce((mx: number, h: HourPoint) => Math.max(mx, h.rainP), 0);
      text.push(`In ${city.name} right now: ${Math.round(m.rainP)}% chance of rain. Over the next 12 hours it peaks at ${Math.round(next)}%${today ? `, and today's max is ${Math.round(today.rainPMax)}%` : ""}. ${next > 45 ? "Take the umbrella." : next > 25 ? "A light shell wouldn't hurt." : "You'll likely stay dry."}`);
      actions.push({ label: `Open ${city.name}`, view: "city", cityId: city.id });
      return { text, actions, cityId: city.id, followUps: ["What should I wear there?", "When should I go outside?", "What about tomorrow?"] };
    }
    if (/air|aqi|pollut/i.test(q)) {
      if (rec.bundle.air) {
        const aqiNow = rec.bundle.air.now.aqi;
        const band = aqiBand(aqiNow);
        text.push(`${city.name}'s air is ${band.label.toLowerCase()} - AQI ${Math.round(aqiNow)}, PM2.5 at ${rec.bundle.air.now.pm25.toFixed(1)} µg/m³.`);
        text.push(aqiAction(aqiNow));
      } else text.push(`Air quality data hasn't arrived for ${city.name} yet - weather is live, AQI is still syncing. I won't pretend it's clean.`);
      actions.push({ label: `Open ${city.name}`, view: "city", cityId: city.id });
      return { text, actions, cityId: city.id, followUps: ["Should I run now?", "When should I go outside?", "Cleanest air right now"] };
    }
    text.push(`${city.name} right now: ${codeInfo(c.code, c.isDay).label.toLowerCase()}, ${tf(m.temp)} feeling like ${tf(m.feels)}. Outdoor score ${overall.total}/100 - ${scoreWord(overall.total).toLowerCase()}. Rain ${Math.round(m.rainP)}%, wind ${Math.round(m.wind)} km/h${m.aqi != null ? `, AQI ${Math.round(m.aqi)}` : ""}.`);
    const bw = findBestHour(rec, "walking");
    if (bw.best) text.push(`Nicest window to be out: about ${fmtHour(bw.best.hour.time)} (${bw.best.score}/100).`);
    actions.push({ label: `Full ${city.name} briefing`, view: "city", cityId: city.id });
    return { text, actions, cityId: city.id, followUps: CITY_FOLLOWS };
  }

  if (city && !records[city.id]) {
    return { text: [`${city.name} is in my atlas but its live data hasn't landed yet - it's still syncing in the queue. Give it a few seconds and ask again.`] };
  }

  if (activity) {
    const mode: ModeId = activity === "running" ? "running" : activity === "walking" ? "walking" : activity === "travel" ? "travel" : "overall";
    const top = rankCities(catalog, records, mode, 3);
    if (top.length) {
      text.push(`Best places for ${ACTIVITY_LABEL[activity]} right now:`);
      top.forEach((t, i) => text.push(topLine(t, i + 1)));
      actions.push({ label: `Open ${top[0].city.name}`, view: "city", cityId: top[0].city.id });
      actions.push({ label: `See full ${ACTIVITY_LABEL[activity]} ranking`, view: "home", mode });
      return { text, actions, followUps: ["Where is the best weather right now?", "Best weekend escape", "Cleanest air right now"] };
    }
  }

  if (/best air|clean.*air|air.*clean|pollution|breathe|air quality/i.test(q)) {
    const top = rankCities(catalog, records, "air", 3);
    if (top.length) {
      text.push("Cleanest air on the board right now:");
      top.forEach((t, i) => text.push(topLine(t, i + 1)));
      const a0 = top[0].rec.bundle.air?.now.aqi ?? null;
      if (a0 != null) text.push(`${aqiAction(a0)}`);
      actions.push({ label: "See clean-air ranking", view: "home", mode: "air" });
      return { text, actions, followUps: ["Where should I go right now?", "Best weekend escape", "Where should I run?"] };
    }
  }
  if (/warm|hot/i.test(q)) {
    const top = rankCities(catalog, records, "warm", 3);
    if (top.length) {
      text.push("Warmest spots on the board:");
      top.forEach((t, i) => text.push(topLine(t, i + 1)));
      actions.push({ label: "See warmest ranking", view: "home", mode: "warm" });
      return { text, actions };
    }
  }
  if (/cold|cool|chilly/i.test(q)) {
    const top = rankCities(catalog, records, "cool", 3);
    if (top.length) {
      text.push("Coolest spots on the board:");
      top.forEach((t, i) => text.push(topLine(t, i + 1)));
      actions.push({ label: "See coolest ranking", view: "home", mode: "cool" });
      return { text, actions };
    }
  }
  if (/weekend|escape|getaway/i.test(q)) {
    const top = rankCities(catalog, records, "weekend", 3);
    if (top.length) {
      text.push("Strongest weekend escapes, scored across the next three days:");
      top.forEach((t, i) => text.push(topLine(t, i + 1)));
      actions.push({ label: "See weekend ranking", view: "home", mode: "weekend" });
      if (top[0]) actions.push({ label: `Open ${top[0].city.name}`, view: "city", cityId: top[0].city.id });
      return { text, actions, followUps: ["Where is the best weather right now?", "Cleanest air right now", "Where should I run?"] };
    }
  }
  if (/where.*(go|visit|travel)|best.*(place|city|weather)|recommend/i.test(q) || /best|top/i.test(q)) {
    const top = rankCities(catalog, records, "overall", 3);
    if (top.length) {
      text.push("Here's the top of the world right now:");
      top.forEach((t, i) => text.push(topLine(t, i + 1)));
      const whyTop = whyFromScore(top[0].overall);
      if (whyTop.strengths.length) text.push(`Why ${top[0].city.name} leads: ${whyTop.strengths.join(", ").toLowerCase()}.`);
      actions.push({ label: `Open ${top[0].city.name}`, view: "city", cityId: top[0].city.id });
      actions.push({ label: "Full top 10", view: "home", mode: "overall" });
      return { text, actions, followUps: ["Best weekend escape", "Cleanest air right now", "Where should I run?"] };
    }
  }
  if (/hi|hello|hey|help|what can/i.test(q)) {
    return {
      text: [
        "I read the live board and answer with real numbers. Try:",
        "· “Where should I go right now?”",
        "· “Best time to run in Lisbon”",
        "· “Do I need an umbrella in Tokyo?”",
        "· “Cleanest air in the world”",
        "· “Compare Paris and Rome”",
      ],
    };
  }

  return {
    text: ["I didn't catch that - but I'm fluent in weather. Ask about a city (“best time to run in Seoul”), a ranking (“cleanest air”), or a decision (“compare Sydney and Auckland”)."],
    followUps: GLOBAL_FOLLOWS,
  };
}

export function toneOf(score: number): string {
  return ({ mint: "var(--mint)", acc: "var(--acc)", coral: "var(--coral)", lav: "var(--lav)" } as Record<string, string>)[scoreTone(score)];
}

/* --------------------------- data confidence ----------------------------- */

export interface Confidence { level: "high" | "medium"; note: string }

/**
 * Missing AQI must never silently improve a score - instead we flag the gap.
 * The neutral air assumption (55) keeps rankings comparable; the label keeps us honest.
 */
export function confidence(rec: CityRecord): Confidence {
  if (rec.bundle.limited) return { level: "medium", note: "Reduced feed - hourly detail limited" };
  if (!rec.bundle.air) return { level: "medium", note: "Air data unavailable - score assumes typical air" };
  return { level: "high", note: "High confidence" };
}

/* ----------------------------- daily briefings --------------------------- */

export type NowPart = "morning" | "afternoon" | "evening" | "night";

export function nowPart(d = new Date()): NowPart {
  const h = d.getHours();
  if (h < 5) return "night";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

export function greeting(): string {
  return { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening", night: "Late-night check-in" }[nowPart()];
}

export function clothingTip(m: Metrics): string {
  const t = m.feels;
  const base =
    t >= 24 ? "light, breathable layers"
    : t >= 17 ? "a tee plus something light"
    : t >= 11 ? "long sleeves and a light jacket"
    : t >= 4 ? "a warm mid-layer under a shell"
    : "a proper coat - layer up";
  const extras: string[] = [];
  if (m.rainP >= 40) extras.push("waterproof layer");
  if (m.uv >= 7) extras.push("sunscreen");
  if (m.wind >= 30) extras.push("wind block");
  return extras.length ? `${base} + ${extras.join(", ")}` : base;
}

/* -------------------------------- tonight -------------------------------- */

export interface TonightPick { label: string; hour: HourPoint; score: number }
export interface TonightStats {
  temp: number; rainP: number; code: number; aqi: number | null; picks: TonightPick[];
}

export function tonightStats(rec: CityRecord): TonightStats | null {
  const { hours, current } = rec.bundle.weather;
  const date = current.time.slice(0, 10);
  const evening = hours.filter((h) => h.time.startsWith(date) && hourOfDay(h.time) >= 18);
  if (!evening.length) return null;
  const temp = evening.reduce((s, h) => s + h.temp, 0) / evening.length;
  const rainP = Math.max(...evening.map((h) => h.rainP));
  const counts = new Map<number, number>();
  evening.forEach((h) => counts.set(h.code, (counts.get(h.code) ?? 0) + 1));
  const code = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const air = rec.bundle.air;
  const i20 = air ? air.series.times.findIndex((t) => t.startsWith(date) && hourOfDay(t) === 20) : -1;
  const aqi = i20 >= 0 && air ? air.series.aqi[i20] : air?.now.aqi ?? null;

  const pickDefs: { act: ActivityId; label: string }[] = [
    { act: "stargazing", label: "Stargazing" },
    { act: "walking", label: "Evening walk" },
    { act: "photography", label: "Night photography" },
  ];
  const picks: TonightPick[] = [];
  for (const def of pickDefs) {
    const bw = findBestHour(rec, def.act, 14);
    if (bw.best && hourOfDay(bw.best.hour.time) >= 17) {
      picks.push({ label: def.label, hour: bw.best.hour, score: bw.best.score });
    }
  }
  return { temp, rainP, code, aqi, picks };
}

/* --------------------------- tomorrow vs today --------------------------- */

export interface DayDelta {
  dTemp: number; dRain: number; dUv: number; dWind: number;
  aqiToday: number | null; aqiTomorrow: number | null;
  today: import("./data").DayPoint; tomorrow: import("./data").DayPoint;
}

export function tomorrowVsToday(rec: CityRecord): DayDelta | null {
  const [t0, t1] = rec.bundle.weather.days;
  if (!t0 || !t1) return null;
  const air = rec.bundle.air;
  const meanAir = (date: string): number | null => {
    if (!air) return null;
    const vals: number[] = [];
    air.series.times.forEach((t, i) => {
      if (t.startsWith(date) && air.series.aqi[i] != null) vals.push(air.series.aqi[i]);
    });
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  };
  return {
    dTemp: (t1.tmax + t1.tmin) / 2 - (t0.tmax + t0.tmin) / 2,
    dRain: t1.rainPMax - t0.rainPMax,
    dUv: t1.uvMax - t0.uvMax,
    dWind: t1.windMax - t0.windMax,
    aqiToday: meanAir(t0.date),
    aqiTomorrow: meanAir(t1.date),
    today: t0, tomorrow: t1,
  };
}

/* ------------------------------ forecast alerts -------------------------- */

export interface WeatherAlert { kind: string; title: string; detail: string; tone: "acc" | "coral" }

export function detectAlerts(rec: CityRecord): WeatherAlert[] {
  const out: WeatherAlert[] = [];
  const { hours, current, days } = rec.bundle.weather;
  const startIdx = Math.max(0, hours.findIndex((h) => h.time >= current.time));
  const next12 = hours.slice(startIdx, startIdx + 12);
  const next24 = hours.slice(startIdx, startIdx + 24);
  const m = metricsFromCurrent(rec);

  if (next12.length) {
    const peak = next12.reduce((a, b) => (b.rainP > a.rainP ? b : a), next12[0]);
    if (peak.rainP >= 50 && peak.rainP - m.rainP >= 25) {
      out.push({
        kind: "rain", tone: peak.rainP >= 70 ? "coral" : "acc", title: "Rain window approaching",
        detail: `Rain probability climbs ${Math.round(m.rainP)}% → ${Math.round(peak.rainP)}% around ${fmtHour(peak.time)}.`,
      });
    }
    const windy = next12.reduce((a, b) => (b.wind > a.wind ? b : a), next12[0]);
    if (windy.wind >= 40) {
      out.push({
        kind: "wind", tone: "acc", title: "Strong wind ahead",
        detail: `Wind near ${Math.round(windy.wind)} km/h around ${fmtHour(windy.time)}.`,
      });
    }
  }

  const storm = next24.find((h) => h.code >= 95);
  if (storm) {
    out.push({
      kind: "storm", tone: "coral", title: "Storm signals",
      detail: `${codeInfo(storm.code, storm.isDay).label} possible around ${fmtHour(storm.time)} - plan some cover.`,
    });
  }

  if (days[0] && days[0].uvMax >= 8) {
    out.push({
      kind: "uv", tone: "acc", title: "High UV today",
      detail: `UV peaks at ${Math.round(days[0].uvMax)} - shade, SPF and sunglasses earn their keep.`,
    });
  }

  if (m.aqi != null && m.aqi > 150) {
    out.push({ kind: "air", tone: "coral", title: "Heavy air right now", detail: `AQI ${Math.round(m.aqi)} - ${aqiAction(m.aqi)}` });
  }

  const delta = tomorrowVsToday(rec);
  if (delta && delta.dTemp <= -6) {
    out.push({
      kind: "temp", tone: "acc", title: "Noticeably cooler tomorrow",
      detail: `Drops about ${td(delta.dTemp)} - high near ${tf(delta.tomorrow.tmax)}.`,
    });
  }

  return out.slice(0, 3);
}

/* ------------------------------ share summary ---------------------------- */

export function shareSummary(city: City, rec: CityRecord): string {
  const m = metricsFromCurrent(rec);
  const s = calculateWeatherScore(m, "overall").total;
  const c = rec.bundle.weather.current;
  return [
    "AURA - weather intelligence",
    "",
    `${city.name} · ${s}/100 · ${scoreWord(s)}`,
    `${tf(m.temp)} · ${codeInfo(c.code, c.isDay).label} · feels ${tf(m.feels)}`,
    m.aqi != null ? `AQI ${Math.round(m.aqi)} · ${aqiBand(m.aqi).label}` : "AQI unavailable",
    `Rain ${Math.round(m.rainP)}% · wind ${Math.round(m.wind)} km/h`,
    "",
    buildAuraSays(city, rec),
  ].join("\n");
}
