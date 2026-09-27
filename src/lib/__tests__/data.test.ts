import { describe, expect, it, afterEach } from "vitest";
import { aqiBand, codeInfo, scoreTone, tf, td, setUnitGlobal, getUnit } from "../data";

afterEach(() => setUnitGlobal("C"));

describe("aqiBand", () => {
  it("maps US AQI breakpoints to the right bands and tones", () => {
    expect(aqiBand(0).tone).toBe("mint");
    expect(aqiBand(50).label).toBe("Good");
    expect(aqiBand(51).label).toBe("Moderate");
    expect(aqiBand(100).tone).toBe("acc");
    expect(aqiBand(101).tone).toBe("coral");
    expect(aqiBand(150).label).toBe("Unhealthy · sensitive");
    expect(aqiBand(201).label).toBe("Very unhealthy");
    expect(aqiBand(301).label).toBe("Hazardous");
  });
  it("always returns actionable advice text", () => {
    for (const v of [5, 55, 120, 180, 250, 400]) expect(aqiBand(v).advice.length).toBeGreaterThan(10);
  });
});

describe("codeInfo", () => {
  it("picks day/night icons for clear skies", () => {
    expect(codeInfo(0, true).icon).toBe("sun");
    expect(codeInfo(0, false).icon).toBe("moon");
  });
  it("maps WMO groups to conditions", () => {
    expect(codeInfo(45, true).label).toBe("Fog");
    expect(codeInfo(55, true).label).toBe("Drizzle");
    expect(codeInfo(63, true).label).toBe("Rain");
    expect(codeInfo(81, false).label).toBe("Rain");
    expect(codeInfo(73, true).label).toBe("Snow");
    expect(codeInfo(96, true).label).toBe("Thunderstorm");
    expect(codeInfo(5, true).label).toBe("Cloudy"); // unmapped fallback
  });
});

describe("scoreTone", () => {
  it("steps mint → acc → coral → lav as scores fall", () => {
    expect(scoreTone(95)).toBe("mint");
    expect(scoreTone(70)).toBe("acc");
    expect(scoreTone(50)).toBe("coral");
    expect(scoreTone(10)).toBe("lav");
  });
});

describe("unit formatting", () => {
  it("tf renders Celsius by default", () => {
    expect(tf(20)).toBe("20°");
  });
  it("tf converts to Fahrenheit when the global unit flips", () => {
    setUnitGlobal("F");
    expect(getUnit()).toBe("F");
    expect(tf(20)).toBe("68°");
  });
  it("td scales deltas without the 32° offset", () => {
    expect(td(3)).toBe("+3°");
    expect(td(-2)).toBe("-2°");
    setUnitGlobal("F");
    expect(td(5)).toBe("+9°");
  });
});
