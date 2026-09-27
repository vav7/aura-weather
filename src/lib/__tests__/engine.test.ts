import { describe, expect, it } from "vitest";
import {
  calculateWeatherScore, metricsFromCurrent, modeWeights, rankCities, findBestHour,
  detectAlerts, tomorrowVsToday, confidence, stars, scoreWord, dayPart, fmtHour,
  fmtHourShort, agoLabel, whyFromScore, aqiAction,
} from "../engine";
import type { ActivityId, ModeId } from "../engine";
import type { CityRecord } from "../data";
import { city, hour, record, PERFECT, HARSH } from "./fixtures";

const ACTIVITIES: ActivityId[] = [
  "overall", "running", "walking", "cycling", "travel", "photography",
  "beach", "dining", "commute", "stargazing", "gardening", "workout",
];
const MODES: ModeId[] = ["overall", "air", "running", "walking", "travel", "warm", "cool", "dry", "wet", "life", "weekend"];

describe("calculateWeatherScore", () => {
  it("rewards textbook outdoor weather with a high, bounded score", () => {
    const res = calculateWeatherScore(metricsFromCurrent(record(PERFECT)), "overall");
    expect(res.total).toBeGreaterThanOrEqual(85);
    expect(res.total).toBeLessThanOrEqual(100);
  });

  it("punishes harsh weather hard", () => {
    const res = calculateWeatherScore(metricsFromCurrent(record(HARSH)), "overall");
    expect(res.total).toBeLessThan(40);
  });

  it("keeps every component score inside 0-100 with display strings", () => {
    for (const o of [PERFECT, HARSH, { temp: 30, aqi: 120 }, { temp: 5, wind: 40, aqi: null }]) {
      const res = calculateWeatherScore(metricsFromCurrent(record(o)), "overall");
      for (const p of res.parts) {
        expect(p.score).toBeGreaterThanOrEqual(0);
        expect(p.score).toBeLessThanOrEqual(100);
        expect(p.label.length).toBeGreaterThan(0);
        expect(p.display.length).toBeGreaterThan(0);
      }
    }
  });

  it("stays bounded for every activity profile", () => {
    for (const activity of ACTIVITIES) {
      const total = calculateWeatherScore(metricsFromCurrent(record(PERFECT)), activity).total;
      expect(total).toBeGreaterThanOrEqual(0);
      expect(total).toBeLessThanOrEqual(100);
    }
  });

  it("is monotonic in AQI (clean air always scores higher)", () => {
    const scores = [15, 60, 120, 220].map(
      (aqi) => calculateWeatherScore(metricsFromCurrent(record({ aqi })), "overall").total,
    );
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeLessThan(scores[i - 1]);
  });

  it("air mode ranks the cleanest city first", () => {
    const recs: Record<string, CityRecord> = {
      a: record({ aqi: 12 }), b: record({ aqi: 80 }), c: record({ aqi: 160 }),
    };
    const ids = rankCities([city("c"), city("a"), city("b")], recs, "air", 5).map((t) => t.city.id);
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("treats missing air data as neutral, not catastrophic", () => {
    const withAir = calculateWeatherScore(metricsFromCurrent(record({ aqi: 20 })), "overall").total;
    const noAir = calculateWeatherScore(metricsFromCurrent(record({ aqi: null })), "overall").total;
    expect(noAir).toBeGreaterThan(30);
    expect(Math.abs(withAir - noAir)).toBeLessThan(25);
  });
});

describe("modeWeights", () => {
  it("every mode's published weights sum to exactly 100%", () => {
    for (const mode of MODES) {
      const sum = modeWeights(mode).rows.reduce((a, r) => a + r.pct, 0);
      expect(sum).toBe(100);
    }
  });
});

describe("whyFromScore / words", () => {
  it("explains strengths for great scores and cautions for bad ones", () => {
    const good = whyFromScore(calculateWeatherScore(metricsFromCurrent(record(PERFECT)), "overall"));
    expect(good.strengths.length).toBeGreaterThan(0);
    const bad = whyFromScore(calculateWeatherScore(metricsFromCurrent(record(HARSH)), "overall"));
    expect(bad.cautions.length).toBeGreaterThan(0);
  });
  it("stars and scoreWord step monotonically", () => {
    expect(stars(95)).toBeGreaterThan(stars(70));
    expect(stars(70)).toBeGreaterThan(stars(30));
    expect(stars(100)).toBeLessThanOrEqual(5);
    expect(scoreWord(95)).toBe("Exceptional");
    expect(scoreWord(10)).toBe("Harsh");
  });
  it("aqiAction escalates with pollution", () => {
    expect(aqiAction(20)).not.toBe(aqiAction(220));
  });
});

describe("rankCities", () => {
  it("orders by score, skips cities without records, respects limit", () => {
    const recs: Record<string, CityRecord> = {
      good: record(PERFECT),
      mid: record({ temp: 15, rainP: 30, aqi: 80 }),
      bad: record(HARSH),
    };
    const catalog = [city("bad"), city("good"), city("mid"), city("missing")];
    const top = rankCities(catalog, recs, "overall", 10);
    expect(top.map((t) => t.city.id)).toEqual(["good", "mid", "bad"]);
    expect(top[0].score).toBeGreaterThanOrEqual(top[1].score);
    expect(rankCities(catalog, recs, "overall", 2)).toHaveLength(2);
  });
});

describe("findBestHour", () => {
  it("finds the planted golden hour", () => {
    const hours = [
      ...Array.from({ length: 12 }, (_, i) => hour(1, i, { temp: 3, rainP: 80, wind: 30 })),
      hour(1, 12, { temp: 3, rainP: 80, wind: 30 }), // now (bad)
      ...Array.from({ length: 5 }, (_, i) => hour(1, 13 + i, { temp: 5, rainP: 70, wind: 25 })),
      hour(1, 18, { temp: 19, rainP: 0, wind: 6, uv: 1 }), // golden
      ...Array.from({ length: 24 }, (_, i) => hour(2, i, { temp: 4, rainP: 75, wind: 28 })),
    ];
    const rec = record({ hours, aqi: 15 });
    const bw = findBestHour(rec, "running", 36);
    expect(bw.best).not.toBeNull();
    expect(bw.best!.hour.time).toBe("2026-01-01T18:00");
    expect(bw.best!.score).toBeGreaterThan(60);
  });
});

describe("detectAlerts", () => {
  it("flags incoming rain surges, wind and heavy air together", () => {
    const hours = [
      ...Array.from({ length: 13 }, (_, i) => hour(1, i, { rainP: 5, wind: 8 })),
      ...Array.from({ length: 35 }, (_, i) => hour(i >= 24 ? 2 : 1, i >= 24 ? i - 24 : i, { rainP: 85, wind: 45, code: 63 })),
    ];
    const rec = record({ hours, aqi: 180 });
    const kinds = detectAlerts(rec).map((a) => a.kind);
    expect(kinds).toContain("rain");
    expect(kinds).toContain("wind");
    expect(kinds).toContain("air");
    expect(detectAlerts(rec).length).toBeLessThanOrEqual(3);
  });
  it("stays quiet on a pleasant day", () => {
    expect(detectAlerts(record(PERFECT))).toHaveLength(0);
  });
});

describe("day math & confidence", () => {
  it("tomorrowVsToday reports the planted warming", () => {
    const rec = record({
      days: [
        { date: "2026-01-01", code: 1, tmax: 20, tmin: 12, sunrise: "2026-01-01T06:00", sunset: "2026-01-01T18:00", uvMax: 3, rainPMax: 5, precipSum: 0, windMax: 10 },
        { date: "2026-01-02", code: 1, tmax: 26, tmin: 15, sunrise: "2026-01-02T06:00", sunset: "2026-01-02T18:00", uvMax: 4, rainPMax: 5, precipSum: 0, windMax: 10 },
        ...Array.from({ length: 5 }, (_, i) => ({ date: `2026-01-0${i + 3}`, code: 1, tmax: 22, tmin: 14, sunrise: "2026-01-03T06:00", sunset: "2026-01-03T18:00", uvMax: 3, rainPMax: 5, precipSum: 0, windMax: 10 })),
      ],
    });
    const d = tomorrowVsToday(rec);
    expect(d).not.toBeNull();
    expect(d!.dTemp).toBeGreaterThan(4);
  });
  it("confidence is high with air, medium without", () => {
    expect(confidence(record({ aqi: 30 })).level).toBe("high");
    expect(confidence(record({ aqi: null })).level).toBe("medium");
    expect(confidence(record({ aqi: 30, limited: true })).level).toBe("medium");
  });
});

describe("time & label helpers", () => {
  it("dayPart buckets the clock", () => {
    expect(dayPart("2026-01-01T03:00")).toBe("night");
    expect(dayPart("2026-01-01T09:00")).toBe("morning");
    expect(dayPart("2026-01-01T13:00")).toBe("midday");
    expect(dayPart("2026-01-01T16:00")).toBe("afternoon");
    expect(dayPart("2026-01-01T19:00")).toBe("evening");
    expect(dayPart("2026-01-01T23:00")).toBe("night");
  });
  it("formats hours for humans", () => {
    expect(fmtHour("2026-01-01T18:00")).toBe("6 PM");
    expect(fmtHour("2026-01-01T00:00")).toBe("12 AM");
    expect(fmtHourShort("2026-01-01T13:00")).toBe("1p");
  });
  it("agoLabel degrades gracefully into the past", () => {
    const now = Date.now();
    expect(agoLabel(now - 10 * 1000)).toBe("just now");
    expect(agoLabel(now - 5 * 60 * 1000)).toBe("5m ago");
    expect(agoLabel(now - 3 * 3600 * 1000)).toBe("3h ago");
    expect(agoLabel(now - 2 * 86400 * 1000)).toBe("2d ago");
  });
});
