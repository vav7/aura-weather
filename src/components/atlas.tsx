import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useAura } from "../store";
import { City, CityRecord, TONE_VAR, scoreTone, tf } from "../lib/data";
import { rankCities, type ModeId } from "../lib/engine";
import { RadarManifest, fetchRadarManifest, frameLabel, radarTileUrl } from "../lib/radar";
import { Icon, Reveal } from "./ui";

/* brand tones as hex (maplibre can't read css vars) */
const HEX: Record<string, string> = {
  mint: "#6fe3b4", acc: "#ffb454", coral: "#ff7b6b", lav: "#b7a6ff", cy: "#5fd0f2",
};

const STYLES: Record<"dark" | "light", string> = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
};

type HeatMetric = "score" | "air" | "temp";
const HEAT_LABEL: Record<HeatMetric, string> = { score: "Score", air: "Clean air", temp: "Warmth" };
const heatKey = (m: HeatMetric) => (m === "score" ? "score" : m === "air" ? "aqiW" : "tempW");

interface CityProps {
  id: string; name: string; score: number; rank: number; tone: string;
  temp: number | null; aqi: number | null; aqiW: number; tempW: number;
}

function buildPoints(catalog: City[], records: Record<string, CityRecord>, mode: ModeId) {
  const all = rankCities(catalog, records, mode, catalog.length);
  const features = all
    .filter((t) => t.score != null)
    .map((t, i) => {
      const cur = t.rec.bundle.weather.current;
      const aqi = t.rec.bundle.air?.now.aqi ?? null;
      const p: CityProps = {
        id: t.city.id,
        name: t.city.name,
        score: t.score as number,
        rank: i + 1,
        tone: scoreTone(t.score as number),
        temp: cur.temp,
        aqi,
        aqiW: aqi == null ? 0 : Math.max(0, Math.min(100, 100 - aqi * 0.66)),
        tempW: Math.max(0, Math.min(100, ((cur.temp + 20) / 65) * 100)),
      };
      return {
        type: "Feature" as const,
        properties: p,
        geometry: { type: "Point" as const, coordinates: [t.city.lon, t.city.lat] },
      };
    });
  return { type: "FeatureCollection" as const, features };
}

/* ------------------------- legacy svg fallback -------------------------- */

function LegacyAtlas() {
  const { mode, catalog, records, openCity } = useAura();
  const all = useMemo(() => rankCities(catalog, records, mode, catalog.length), [catalog, records, mode]);
  const scoreOf = useMemo(() => new Map(all.map((t) => [t.city.id, t.score])), [all]);
  const ranked = useMemo(() => new Map(all.slice(0, 10).map((t, i) => [t.city.id, i + 1])), [all]);
  const pts = useMemo(
    () =>
      catalog.map((city) => {
        const x = ((city.lon + 180) / 360) * 100;
        const y = ((90 - city.lat) / 180) * 100;
        const rec = records[city.id];
        return {
          city, x, y,
          score: scoreOf.get(city.id) ?? null,
          rank: ranked.get(city.id),
          temp: rec ? rec.bundle.weather.current.temp : null,
        };
      }),
    [catalog, records, scoreOf, ranked],
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hovered = pts.find((p) => p.city.id === hoveredId);
  return (
    <div className="glass relative overflow-hidden rounded-3xl" style={{ aspectRatio: "2 / 1" }}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 50" preserveAspectRatio="none" aria-hidden>
        {Array.from({ length: 11 }, (_, i) => (
          <line key={`v${i}`} x1={i * 10} y1={0} x2={i * 10} y2={50} stroke="var(--line)" strokeWidth={i === 0 || i === 10 ? 0.18 : 0.08} />
        ))}
        {Array.from({ length: 5 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i * 12.5} x2={100} y2={i * 12.5} stroke="var(--line)" strokeWidth={i === 0 || i === 4 ? 0.18 : 0.08} />
        ))}
      </svg>
      {pts.map((p) => {
        const isTop = p.rank != null;
        const tone = p.score != null ? TONE_VAR[scoreTone(p.score)] : "var(--faint)";
        return (
          <button
            key={p.city.id}
            onClick={() => openCity(p.city.id)}
            onMouseEnter={() => setHoveredId(p.city.id)}
            onMouseLeave={() => setHoveredId(null)}
            aria-label={p.city.name}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform hover:scale-125"
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: isTop ? 12 : 6, height: isTop ? 12 : 6, background: tone, boxShadow: isTop ? `0 0 12px ${tone}` : "none", zIndex: isTop ? 2 : 1, opacity: isTop ? 1 : 0.55 }}
          />
        );
      })}
      {hovered && (
        <div className="glass2 pointer-events-none absolute z-10 rounded-xl px-3 py-2 text-[11px] font-bold" style={{ left: `${hovered.x}%`, top: `${hovered.y}%`, transform: "translate(-50%, -130%)" }}>
          <div className="font-display text-[13px]">{hovered.city.name}</div>
          <div className="mt-0.5 tabular-nums" style={{ color: "var(--mut)" }}>
            {hovered.score != null ? `${hovered.score}/100` : "syncing"}
            {hovered.temp != null ? ` · ${tf(hovered.temp)}` : ""}
          </div>
        </div>
      )}
      <span className="absolute right-3 bottom-2 text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--faint)" }}>
        fallback board · {pts.filter((p) => p.score != null).length} live
      </span>
    </div>
  );
}

/* ------------------------------ live atlas ------------------------------ */

function AtlasBox() {
  const { mode, catalog, records, openCity, theme } = useAura();
  const forceLegacy = typeof window !== "undefined" && /[?&]atlas=legacy/.test(window.location.search);
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const applyHeatRef = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [heat, setHeat] = useState<HeatMetric>("score");
  const [radarOn, setRadarOn] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [manifest, setManifest] = useState<RadarManifest | null>(null);
  const [frameIdx, setFrameIdx] = useState(-1);

  const points = useMemo(() => buildPoints(catalog, records, mode), [catalog, records, mode]);
  const dataRef = useRef(points);
  dataRef.current = points;
  const heatRef = useRef(heat);
  heatRef.current = heat;
  const radarRef = useRef<{ on: boolean; url: string | null }>({ on: true, url: null });
  radarRef.current.on = radarOn;

  /* radar manifest */
  useEffect(() => {
    const ctrl = new AbortController();
    fetchRadarManifest(ctrl.signal).then((m) => {
      if (!m) return;
      setManifest(m);
      const lastPast = m.frames.filter((f) => f.kind === "past").length - 1;
      setFrameIdx(lastPast >= 0 ? lastPast : 0);
    });
    return () => ctrl.abort();
  }, []);

  /* frame animation */
  useEffect(() => {
    if (!playing || !manifest || manifest.frames.length < 2) return;
    const t = setInterval(() => setFrameIdx((i) => (i + 1) % manifest.frames.length), 700);
    return () => clearInterval(t);
  }, [playing, manifest]);

  /* push current frame tiles into the raster source */
  useEffect(() => {
    if (!manifest || frameIdx < 0) return;
    const url = radarTileUrl(manifest, manifest.frames[frameIdx]);
    radarRef.current.url = url;
    const src = mapRef.current?.getSource("radar") as maplibregl.RasterTileSource | undefined;
    if (src) src.setTiles([url]);
  }, [manifest, frameIdx]);

  /* map boot (re-runs on theme change: clean remount with the right basemap) */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: el,
        style: STYLES[theme],
        center: [15, 24],
        zoom: 1.15,
        minZoom: 1,
        maxZoom: 12,
        attributionControl: { compact: true },
        dragPan: !coarse,
        touchZoomRotate: !coarse,
        keyboard: false,
      });
    } catch {
      setFailed(true);
      return;
    }
    mapRef.current = map;

    const styleTimer = setTimeout(() => {
      if (!map.isStyleLoaded()) setFailed(true); // CDN blocked/offline -> svg fallback
    }, 10000);

    const addLayers = () => {
      clearTimeout(styleTimer);
      if (!map.getSource("cities")) map.addSource("cities", { type: "geojson", data: dataRef.current });
      if (!map.getSource("radar")) {
        map.addSource("radar", {
          type: "raster",
          tiles: radarRef.current.url ? [radarRef.current.url] : [],
          tileSize: 256,
          attribution: "© RainViewer",
        });
      }
      map.addLayer({
        id: "radar-layer", type: "raster", source: "radar",
        paint: { "raster-opacity": 0.62, "raster-fade-duration": 250 },
        layout: { visibility: radarRef.current.on && radarRef.current.url ? "visible" : "none" },
      });
      map.addLayer({
        id: "heat", type: "heatmap", source: "cities",
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", heatKey(heatRef.current)], 0, 0, 100, 1] as never,
          "heatmap-intensity": 0.7,
          "heatmap-radius": 30,
          "heatmap-opacity": 0.5,
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(0,0,0,0)", 0.25, HEX.cy, 0.5, HEX.mint, 0.75, HEX.acc, 1, HEX.coral,
          ] as never,
        },
      });
      map.addLayer({
        id: "leader-glow", type: "circle", source: "cities",
        filter: ["<=", ["get", "rank"], 10],
        paint: {
          "circle-radius": 11, "circle-blur": 0.9, "circle-opacity": 0.55,
          "circle-color": ["match", ["get", "tone"], "mint", HEX.mint, "acc", HEX.acc, "coral", HEX.coral, "lav", HEX.lav, HEX.cy] as never,
        },
      });
      map.addLayer({
        id: "city-dots", type: "circle", source: "cities",
        paint: {
          "circle-radius": ["case", ["<=", ["get", "rank"], 10], 4.5, 2.5] as never,
          "circle-color": ["match", ["get", "tone"], "mint", HEX.mint, "acc", HEX.acc, "coral", HEX.coral, "lav", HEX.lav, HEX.cy] as never,
          "circle-opacity": 0.95,
          "circle-stroke-width": 1,
          "circle-stroke-color": "rgba(0,0,0,0.45)",
        },
      });

      applyHeatRef.current = () => {
        const key = heatKey(heatRef.current);
        map.setPaintProperty("heat", "heatmap-weight", ["interpolate", ["linear"], ["get", key], 0, 0, 100, 1] as never);
        map.setFilter("heat", (heatRef.current === "air" ? [">", ["get", "aqiW"], 0] : null) as never);
      };
      applyHeatRef.current();

      /* interactions */
      for (const layer of ["city-dots", "leader-glow"]) {
        map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; popupRef.current?.remove(); });
        map.on("mousemove", layer, (e: maplibregl.MapLayerMouseEvent) => {
          const p = e.features?.[0]?.properties as unknown as CityProps | undefined;
          if (!p) return;
          if (!popupRef.current) {
            popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: "aura-map-pop", offset: 12 });
          }
          popupRef.current
            .setLngLat(e.lngLat)
            .setHTML(
              `<div class="font-display text-[13px] font-bold">${p.name}</div>
               <div class="mt-0.5 tabular-nums" style="color:var(--mut)">#${p.rank} · ${p.score}/100 · ${p.temp != null ? tf(p.temp) : "-"}${p.aqi != null ? ` · AQI ${Math.round(p.aqi)}` : ""}</div>`,
            )
            .addTo(map);
        });
        map.on("click", layer, (e: maplibregl.MapLayerMouseEvent) => {
          const p = e.features?.[0]?.properties as unknown as CityProps | undefined;
          if (p) openCity(p.id);
        });
      }
      setReady(true);
    };

    if (map.isStyleLoaded()) addLayers();
    else map.once("load", addLayers);
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    return () => {
      clearTimeout(styleTimer);
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [theme, openCity]);

  /* live data updates */
  useEffect(() => {
    const src = mapRef.current?.getSource("cities") as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(points);
  }, [points]);

  /* heat metric switch */
  useEffect(() => {
    if (ready) applyHeatRef.current();
  }, [heat, ready]);

  /* radar visibility */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("radar-layer")) return;
    map.setLayoutProperty("radar-layer", "visibility", radarOn && radarRef.current.url ? "visible" : "none");
  }, [radarOn, ready, manifest, frameIdx]);

  if (failed || forceLegacy) return <LegacyAtlas />;

  const frame = manifest && frameIdx >= 0 ? manifest.frames[frameIdx] : null;

  return (
    <div className="relative overflow-hidden rounded-3xl border" style={{ borderColor: "var(--line)" }}>
      <div ref={wrapRef} className="h-[340px] w-full sm:h-[440px]" role="img" aria-label="Interactive weather atlas map" />
      {!ready && <div className="skel absolute inset-0" aria-hidden />}

      {/* heat metric switch */}
      <div className="glass2 absolute top-3 left-3 z-10 flex items-center gap-1 rounded-full p-1">
        {(Object.keys(HEAT_LABEL) as HeatMetric[]).map((m) => (
          <button
            key={m}
            onClick={() => setHeat(m)}
            aria-pressed={heat === m}
            className="chip-btn rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
            style={heat === m ? { background: "var(--acc)", color: "var(--acc-ink)" } : { color: "var(--mut)" }}
          >
            {HEAT_LABEL[m]}
          </button>
        ))}
      </div>

      {/* radar controls */}
      <div className="glass2 absolute bottom-6 left-3 z-10 flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-black">
        <button
          onClick={() => setRadarOn((v) => !v)}
          aria-pressed={radarOn}
          className="chip-btn flex items-center gap-1.5 rounded-full px-2 py-0.5 uppercase tracking-wider"
          style={{ color: radarOn ? "var(--cy)" : "var(--faint)" }}
        >
          <Icon kind="rain" size={12} /> Radar
        </button>
        {manifest ? (
          <>
            <button
              onClick={() => setPlaying((v) => !v)}
              className="chip-btn rounded-full px-1.5 py-0.5"
              style={{ color: "var(--mut)" }}
              aria-label={playing ? "Pause radar animation" : "Play radar animation"}
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <span className="tabular-nums" style={{ color: frame?.kind === "nowcast" ? "var(--acc)" : "var(--mut)" }}>
              {frame ? frameLabel(manifest, frame) : "-"}
            </span>
          </>
        ) : (
          <span style={{ color: "var(--faint)" }}>radar offline</span>
        )}
      </div>

      {/* legend */}
      <div className="glass2 absolute right-3 bottom-6 z-10 hidden items-center gap-2 rounded-full px-3 py-1.5 sm:flex">
        <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: "var(--faint)" }}>{HEAT_LABEL[heat]}</span>
        <span className="h-1.5 w-24 rounded-full" style={{ background: `linear-gradient(90deg, ${HEX.cy}, ${HEX.mint}, ${HEX.acc}, ${HEX.coral})` }} />
        <span className="text-[9px] font-bold" style={{ color: "var(--faint)" }}>low → high</span>
      </div>
    </div>
  );
}

/* -------------------------------- section ------------------------------- */

export default function AtlasSection() {
  const { mode, catalog, records } = useAura();
  const live = catalog.filter((c) => records[c.id]).length;
  return (
    <Reveal>
      <section className="mt-8" aria-label="Atlas board">
        <div className="mb-3 flex items-center gap-2">
          <Icon kind="compass" size={15} className="text-[var(--acc)]" />
          <h2 className="font-display text-lg font-semibold">Atlas board</h2>
          <span className="text-[11px] font-medium" style={{ color: "var(--faint)" }}>
            Live map - heat layers and animated radar over tonight's leaders.
          </span>
        </div>
        <AtlasBox />
        <p className="mt-2 text-[10px] font-medium" style={{ color: "var(--faint)" }}>
          {live} synced cities · basemap © CARTO / OpenStreetMap contributors · radar © RainViewer
        </p>
      </section>
    </Reveal>
  );
}
