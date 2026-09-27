import { describe, expect, it } from "vitest";
import { parseRadarManifest, radarTileUrl, frameLabel } from "../radar";

const RAW = {
  generated: 1700000500,
  host: "https://tilecache.rainviewer.com/",
  radar: {
    past: [
      { time: 1700000400, path: "/v2/radar/1700000400" },
      { time: 1700000100, path: "/v2/radar/1700000100" },
    ],
    nowcast: [
      { time: 1700000700, path: "/v2/radar/1700000700" },
    ],
  },
};

describe("parseRadarManifest", () => {
  it("merges past+nowcast chronologically and trims the host", () => {
    const m = parseRadarManifest(RAW)!;
    expect(m.host).toBe("https://tilecache.rainviewer.com");
    expect(m.frames.map((f) => f.time)).toEqual([1700000100, 1700000400, 1700000700]);
    expect(m.frames.map((f) => f.kind)).toEqual(["past", "past", "nowcast"]);
  });
  it("rejects empty or malformed manifests", () => {
    expect(parseRadarManifest({})).toBeNull();
    expect(parseRadarManifest({ host: "x", radar: { past: [] } })).toBeNull();
    expect(parseRadarManifest({ host: "x", radar: { past: [{ time: 1, path: "" }] } })).toBeNull();
  });
});

describe("radarTileUrl", () => {
  it("builds a MapLibre-ready template with placeholders", () => {
    const m = parseRadarManifest(RAW)!;
    const url = radarTileUrl(m, m.frames[1]);
    expect(url).toBe(
      "https://tilecache.rainviewer.com/v2/radar/1700000400/256/{z}/{x}/{y}/2/1/1.png",
    );
  });
});

describe("frameLabel", () => {
  it("labels frames relative to the newest observation", () => {
    const m = parseRadarManifest(RAW)!;
    expect(frameLabel(m, m.frames[0])).toBe("-5m");
    expect(frameLabel(m, m.frames[1])).toBe("now");
    expect(frameLabel(m, m.frames[2])).toBe("+5m");
  });
});
