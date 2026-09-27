/* ------------------------------------------------------------------ */
/*  RainViewer radar adapter - pure helpers + one network call        */
/*  Free public API, no key: https://www.rainviewer.com/api.html      */
/* ------------------------------------------------------------------ */

export interface RadarFrame {
  time: number; // unix seconds
  path: string; // e.g. /v2/radar/1700000000
  kind: "past" | "nowcast";
}

export interface RadarManifest {
  generated: number;
  host: string;
  frames: RadarFrame[]; // chronological: past…, nowcast…
}

interface RawManifest {
  generated?: number;
  host?: string;
  radar?: {
    past?: { time: number; path: string }[];
    nowcast?: { time: number; path: string }[];
  };
}

export async function fetchRadarManifest(signal?: AbortSignal): Promise<RadarManifest | null> {
  try {
    const res = await fetch("https://api.rainviewer.com/public/weather-maps.json", { signal });
    if (!res.ok) return null;
    return parseRadarManifest((await res.json()) as RawManifest);
  } catch {
    return null; // offline / blocked: radar simply stays off
  }
}

export function parseRadarManifest(raw: RawManifest): RadarManifest | null {
  const past = (raw.radar?.past ?? []).map((f) => ({ ...f, kind: "past" as const }));
  const nowcast = (raw.radar?.nowcast ?? []).map((f) => ({ ...f, kind: "nowcast" as const }));
  const frames = [...past, ...nowcast].filter((f) => f.path && f.time).sort((a, b) => a.time - b.time);
  if (!frames.length || !raw.host) return null;
  return { generated: raw.generated ?? Date.now() / 1000, host: raw.host.replace(/\/$/, ""), frames };
}

/**
 * Raster tile URL template for a frame. Placeholders stay for MapLibre.
 * scheme: {color} 2 = classic radar rainbow, {smooth} 1, {contrast} 1.
 */
export function radarTileUrl(m: RadarManifest, f: RadarFrame, color = 2, smooth = 1, contrast = 1): string {
  return `${m.host}${f.path}/256/{z}/{x}/{y}/${color}/${smooth}/${contrast}.png`;
}

/** "-10m" / "now" / "+30m" relative to the newest past frame. */
export function frameLabel(manifest: RadarManifest, f: RadarFrame): string {
  const pastFrames = manifest.frames.filter((x) => x.kind === "past");
  const now = pastFrames.length ? pastFrames[pastFrames.length - 1].time : f.time;
  const d = Math.round((f.time - now) / 60);
  if (d === 0) return "now";
  return d > 0 ? `+${d}m` : `${d}m`;
}
