import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAura } from "../store";
import { City, CityRecord, INTERESTS, IconKind, REGION_LABELS, aqiBand, codeInfo, scoreTone, TONE_VAR, tf, td } from "../lib/data";
import {
  ModeId, RankItem, agoLabel, aqiAction, calculateWeatherScore, clothingTip, dayPart, edgeOver,
  findBestHour, fmtHour, greeting, metricsFromCurrent, modeWeights, nowPart, rankCities, scoreWord,
} from "../lib/engine";
import { Icon, PartBar, Reveal, ScoreDial, ToneChip } from "./ui";

/* the interactive map (maplibre + radar) is heavy - the chunk is only
   fetched once the section approaches the viewport (see AtlasGate) */
const AtlasSection = lazy(() => import("./atlas"));

function AtlasGate() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }),
      { rootMargin: "300px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref}>
      {inView ? (
        <Suspense fallback={<div className="skel mt-8 h-72 rounded-3xl" aria-hidden />}>
          <AtlasSection />
        </Suspense>
      ) : (
        <div className="skel mt-8 h-72 rounded-3xl sm:h-[464px]" aria-hidden />
      )}
    </div>
  );
}

/* ------------------------------ mode config ---------------------------- */

const MODES: { id: ModeId; label: string; icon: IconKind }[] = [
  { id: "overall", label: "Best overall", icon: "spark" },
  { id: "air", label: "Cleanest air", icon: "leaf" },
  { id: "running", label: "Best for running", icon: "run" },
  { id: "walking", label: "Best for walking", icon: "walk" },
  { id: "travel", label: "Best for travel", icon: "plane" },
  { id: "warm", label: "Warmest", icon: "thermo" },
  { id: "cool", label: "Coolest", icon: "snow" },
  { id: "dry", label: "Least rain", icon: "sun" },
  { id: "wet", label: "Most rain", icon: "rain" },
  { id: "life", label: "Air + weather", icon: "layers" },
  { id: "weekend", label: "Weekend escapes", icon: "compass" },
];

const HEADLINES: Record<ModeId, string> = {
  overall: "Where is the best weather on Earth right now?",
  air: "Where can you breathe easiest right now?",
  running: "Where should you run right now?",
  walking: "Where should you walk right now?",
  travel: "Where should you wander right now?",
  warm: "Chasing heat - the warmest cities at this moment",
  cool: "The coolest escapes on the board right now",
  dry: "The driest skies on Earth right now",
  wet: "Where the rain is doing its thing right now",
  life: "Quality of life: where air and weather both deliver",
  weekend: "Best weekend escapes, scored across the next 3 days",
};

const MODE_STORY: Record<ModeId, string> = {
  overall: "30% comfort · 25% air · 15% rain · 10% temp · wind, UV, humidity, visibility",
  air: "Ranked purely on the US AQI reading at each city right now.",
  running: "Weighted for runners: temperature, humidity, clean air, wind and dry roads.",
  walking: "Weighted for walkers: dry skies, mild temperature, calm wind, clean air.",
  travel: "Weighted for exploring: dry, mild, clear views, breathable air.",
  warm: "Straight thermometer - highest current temperature first.",
  cool: "Straight thermometer - lowest current temperature first.",
  dry: "Lowest current precipitation probability first.",
  wet: "Highest precipitation probability first - storm-watch mode.",
  life: "A 50/50 blend of the overall outdoor score and clean-air score.",
  weekend: "Tomorrow through day 3, scored with the travel profile.",
};

/* ------------------------------- filters ------------------------------- */

interface Filters { region: string; temp: "any" | "cool" | "mild" | "warm" | "hot"; aqi: "any" | "good" | "mod" }
const FILTERS_DEFAULT: Filters = { region: "all", temp: "any", aqi: "any" };

const REGION_GROUPS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "EU", label: "Europe" },
  { id: "ASIA", label: "Asia" },
  { id: "AMER", label: "Americas" },
  { id: "OC", label: "Oceania" },
  { id: "ME", label: "Middle East" },
  { id: "AF", label: "Africa" },
  { id: "IN", label: "India" },
];
const TEMP_GROUPS: { id: Filters["temp"]; label: () => string }[] = [
  { id: "any", label: () => "Any temp" },
  { id: "cool", label: () => `Cool <${tf(12)}` },
  { id: "mild", label: () => `Mild ${tf(12)}–${tf(20)}` },
  { id: "warm", label: () => `Warm ${tf(20)}–${tf(28)}` },
  { id: "hot", label: () => `Hot ${tf(28)}+` },
];
const AQI_GROUPS: { id: Filters["aqi"]; label: string }[] = [
  { id: "any", label: "Any AQI" },
  { id: "good", label: "Good only" },
  { id: "mod", label: "Good + moderate" },
];

function regionMatch(c: City, group: string): boolean {
  if (group === "all") return true;
  if (group === "ASIA") return c.region === "EA" || c.region === "SEA";
  if (group === "AMER") return c.region === "NA" || c.region === "SA";
  return c.region === group;
}
function filtersActive(f: Filters): boolean {
  return f.region !== "all" || f.temp !== "any" || f.aqi !== "any";
}

/* ------------------------------ sync strip ----------------------------- */

function SyncStrip() {
  const { statuses, catalog, retryAll, records, online } = useAura();
  const counts = useMemo(() => {
    const c = { live: 0, stale: 0, error: 0, pending: 0 };
    for (const city of catalog) {
      const s = statuses[city.id];
      if (s === "live") c.live++;
      else if (s === "stale") c.stale++;
      else if (s === "error") c.error++;
      else c.pending++;
    }
    return c;
  }, [statuses, catalog]);
  const total = catalog.length;
  const pct = Math.round((counts.live / total) * 100);

  const latest = useMemo(() => {
    let t = 0;
    for (const r of Object.values(records)) t = Math.max(t, r.fetchedAt);
    return t;
  }, [records]);

  return (
    <div role="status" aria-live="polite" className="glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-3xl px-4 py-2 text-[11px] font-bold sm:rounded-full">
      <span className="flex items-center gap-2">
        <span className={`live-dot h-2 w-2 rounded-full ${online ? "bg-[var(--mint)]" : "bg-[var(--acc)]"}`} />
        <span style={{ color: online ? "var(--mint)" : "var(--acc)" }}>{online ? "LIVE" : "OFFLINE"}</span>
      </span>
      <span style={{ color: "var(--mut)" }}>
        <span className="tabular-nums" style={{ color: "var(--ink)" }}>{counts.live}</span>/{total} cities synced
      </span>
      <span className="hidden h-1.5 w-28 overflow-hidden rounded-full sm:block" style={{ background: "var(--glass2)" }} aria-hidden>
        <span className="block h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--cy), var(--mint))" }} />
      </span>
      {counts.stale > 0 && (
        <span style={{ color: "var(--acc)" }} title="Showing cached readings while live refresh continues">
          {counts.stale} cached
        </span>
      )}
      {counts.pending > 0 && online && (
        <span className="flex items-center gap-1.5" style={{ color: "var(--faint)" }}>
          <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-[var(--faint)] border-t-[var(--acc)]" aria-hidden />
          syncing…
        </span>
      )}
      {counts.error > 0 && (
        <button onClick={retryAll} className="chip-btn flex items-center gap-1 rounded-full px-2 py-0.5 hover:bg-[var(--glass2)]" style={{ color: "var(--coral)" }}>
          <Icon kind="refresh" size={12} />
          {counts.error} unreachable - retry
        </button>
      )}
      {latest > 0 && (
        <span className="ml-auto hidden sm:block" style={{ color: "var(--faint)" }}>
          {Date.now() - latest > 15 * 60 * 1000 ? `cached · ${agoLabel(latest)}` : `updated ${agoLabel(latest)}`}
        </span>
      )}
    </div>
  );
}

/* ---------------------------- offline banner ---------------------------- */

function OfflineBanner() {
  const { online, records, statuses, refreshAll } = useAura();
  const hasData = Object.keys(records).length > 0;
  const loading = Object.values(statuses).some((s) => s === "loading" || s === "queued");
  if (online && (hasData || loading)) return null;

  const focusSearch = () => {
    (document.getElementById("aura-global-search") as HTMLInputElement | null)?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="glass anim-fadeUp flex flex-wrap items-center gap-3 rounded-3xl px-5 py-4" role="alert">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ background: "color-mix(in srgb, var(--acc) 14%, transparent)", color: "var(--acc)" }}>
        <Icon kind={online ? "alert" : "cloud"} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-semibold sm:text-base">
          {!online ? "You're offline." : "Live World Pulse is unavailable right now."}
        </p>
        <p className="text-xs font-medium" style={{ color: "var(--mut)" }}>
          {hasData
            ? "Showing the latest available snapshot - it will silently refresh when you're back."
            : "You can still search any city directly, or retry the live board."}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={focusSearch} className="chip-btn glass rounded-full px-4 py-2 text-xs font-bold hover:bg-[var(--glass2)]">
          Search a city
        </button>
        <button onClick={refreshAll} className="chip-btn flex items-center gap-1.5 rounded-full bg-[var(--acc)] px-4 py-2 text-xs font-black text-[var(--acc-ink)]">
          <Icon kind="refresh" size={12} />
          Retry
        </button>
      </div>
    </div>
  );
}

/* ----------------------------- aura signals ----------------------------- */

interface Signal { id: string; icon: IconKind; tone: string; text: string; cityId?: string }

function buildSignals(catalog: City[], records: Record<string, CityRecord>): Signal[] {
  const out: Signal[] = [];
  const withRec = catalog.filter((c) => records[c.id]);
  if (withRec.length < 6) return out;
  const scored = withRec.map((c) => {
    const rec = records[c.id];
    const m = metricsFromCurrent(rec);
    return { c, rec, m, o: calculateWeatherScore(m, "overall").total };
  });

  // regional strength
  const byRegion: Record<string, number> = {};
  for (const s of scored) if (s.o >= 75 && REGION_LABELS[s.c.region]) byRegion[s.c.region] = (byRegion[s.c.region] ?? 0) + 1;
  const strong = Object.entries(byRegion).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1])[0];
  if (strong) out.push({ id: "region", icon: "compass", tone: "var(--mint)", text: `${REGION_LABELS[strong[0]]} has ${strong[1]} excellent outdoor cities right now.` });

  // clean-air leader
  const air = scored.filter((s) => s.m.aqi != null).sort((a, b) => (a.m.aqi as number) - (b.m.aqi as number))[0];
  if (air) out.push({ id: "air", icon: "leaf", tone: "var(--mint)", text: `${air.c.name} is currently leading the clean-air ranking at AQI ${Math.round(air.m.aqi as number)}.`, cityId: air.c.id });

  // running window
  const runTop = [...scored].sort((a, b) => calculateWeatherScore(b.m, "running").total - calculateWeatherScore(a.m, "running").total)[0];
  if (runTop) {
    const bw = findBestHour(runTop.rec, "running", 18);
    if (bw.best && bw.best.score >= 70) {
      out.push({ id: "run", icon: "run", tone: "var(--cy)", text: `${runTop.c.name} has a strong ${dayPart(bw.best.hour.time)} running window - ${fmtHour(bw.best.hour.time)}, ${tf(bw.best.hour.temp)}, rain ${Math.round(bw.best.hour.rainP)}%.`, cityId: runTop.c.id });
    }
  }

  // rain surge in the next 12h
  let surge: { name: string; from: number; to: number; id: string } | null = null;
  for (const s of scored) {
    const { hours, current } = s.rec.bundle.weather;
    const i = Math.max(0, hours.findIndex((h) => h.time === current.time));
    const ahead = hours.slice(i + 1, i + 13);
    if (!ahead.length) continue;
    const peak = ahead.reduce((mx, h) => Math.max(mx, h.rainP), 0);
    if (peak - s.m.rainP >= 30 && (!surge || peak - s.m.rainP > surge.to - surge.from)) {
      surge = { name: s.c.name, from: Math.round(s.m.rainP), to: Math.round(peak), id: s.c.id };
    }
  }
  if (surge) out.push({ id: "surge", icon: "rain", tone: "var(--coral)", text: `${surge.name}'s rain risk climbs from ${surge.from}% to ${surge.to}% over the next 12 hours.`, cityId: surge.id });

  // driest major city
  const dry = scored.filter((s) => s.c.tier === 1).sort((a, b) => a.m.rainP - b.m.rainP)[0];
  if (dry && dry.m.rainP <= 10) out.push({ id: "dry", icon: "sun", tone: "var(--acc)", text: `${dry.c.name} is one of the driest major-city options right now - ${Math.round(dry.m.rainP)}% rain risk.`, cityId: dry.c.id });

  // temperature spread
  const byTemp = [...scored].sort((a, b) => b.m.temp - a.m.temp);
  const hot = byTemp[0];
  const cold = byTemp[byTemp.length - 1];
  if (hot && cold && hot.m.temp - cold.m.temp >= 18) {
    out.push({ id: "spread", icon: "thermo", tone: "var(--lav)", text: `${hot.c.name} is ${tf(hot.m.temp)} right now while ${cold.c.name} sits at ${tf(cold.m.temp)}.`, cityId: hot.c.id });
  }

  // weekend mover
  const wk = rankCities(catalog, records, "weekend", 1)[0];
  if (wk && wk.score >= 68) out.push({ id: "weekend", icon: "plane", tone: "var(--cy)", text: `${wk.city.name} is shaping up as the weekend escape to beat - ${wk.score}/100 across the next 3 days.`, cityId: wk.city.id });

  // heavy-air caution (conservative)
  const bad = scored.filter((s) => s.m.aqi != null && (s.m.aqi as number) > 150).sort((a, b) => (b.m.aqi as number) - (a.m.aqi as number))[0];
  if (bad) out.push({ id: "badair", icon: "alert", tone: "var(--coral)", text: `${bad.c.name}'s air is heavy right now (AQI ${Math.round(bad.m.aqi as number)}) - consider keeping intense effort indoors there.`, cityId: bad.c.id });

  return out.slice(0, 8);
}

function SignalsTicker() {
  const { catalog, records, openCity, unit } = useAura();
  const signals = useMemo(() => buildSignals(catalog, records), [catalog, records, unit]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (signals.length < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIdx((v) => (v + 1) % signals.length), 5200);
    return () => clearInterval(t);
  }, [signals.length, paused]);

  if (!signals.length) return null;
  const s = signals[Math.min(idx, signals.length - 1)];

  return (
    <div
      className="glass flex items-center gap-3 rounded-3xl py-2 pr-4 pl-2 sm:rounded-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="Aura signals"
    >
      <span className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black tracking-[0.2em] uppercase" style={{ background: "var(--glass3)", color: "var(--faint)" }}>
        <Icon kind="spark" size={11} />
        Signals
      </span>
      <div key={s.id} className="signal-in flex min-w-0 flex-1 items-center gap-2 text-xs font-bold sm:text-[13px]">
        <span className="shrink-0 self-start sm:self-center" style={{ color: s.tone }}><Icon kind={s.icon} size={15} /></span>
        {s.cityId ? (
          <button onClick={() => openCity(s.cityId as string)} className="chip-btn line-clamp-2 min-w-0 flex-1 text-left hover:underline sm:line-clamp-1" style={{ color: "var(--ink)" }}>
            {s.text}
          </button>
        ) : (
          <span className="line-clamp-2 min-w-0 flex-1 sm:line-clamp-1" style={{ color: "var(--ink)" }}>{s.text}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1" role="tablist" aria-label="Signal index">
        {signals.map((sig, i) => (
          <button
            key={sig.id}
            onClick={() => setIdx(i)}
            aria-label={`Signal ${i + 1}`}
            aria-selected={i === idx}
            role="tab"
            className="chip-btn h-2.5 rounded-full transition-all"
            style={{ width: i === idx ? 16 : 6, background: i === idx ? "var(--acc)" : "var(--glass3)" }}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ onboarding ------------------------------ */

function Onboarding({ onDone }: { onDone?: () => void }) {
  const { interests, setInterests } = useAura();
  const [local, setLocal] = useState<string[]>(interests);

  const toggle = (id: string) => setLocal((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Reveal>
      <div className="glass relative overflow-hidden rounded-3xl p-5 sm:p-6">
        <div className="pointer-events-none absolute -top-16 -right-16 h-52 w-52 rounded-full opacity-60" style={{ background: "radial-gradient(closest-side, var(--glowA), transparent 70%)" }} />
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="eyebrow">Make Aura yours</div>
            <h2 className="font-display mt-1 text-xl font-semibold sm:text-2xl">What matters to you out there?</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--mut)" }}>
              Aura re-orders the world board around your answers - pick as many as you like.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {local.length > 0 && (
              <button onClick={() => { setInterests([], true); onDone?.(); }} className="chip-btn rounded-full px-4 py-2 text-xs font-bold hover:bg-[var(--glass2)]" style={{ color: "var(--mut)" }}>
                Skip for now
              </button>
            )}
            <button
              onClick={() => { setInterests(local, true); onDone?.(); }}
              disabled={local.length === 0}
              className="chip-btn rounded-full bg-[var(--acc)] px-5 py-2 text-sm font-black text-[var(--acc-ink)] shadow-lg disabled:opacity-40"
            >
              Tune my board →
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {INTERESTS.map((it) => {
            const on = local.includes(it.id);
            return (
              <button
                key={it.id}
                onClick={() => toggle(it.id)}
                aria-pressed={on}
                className={`chip-btn flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-bold ${on ? "" : "hover:bg-[var(--glass2)]"}`}
                style={
                  on
                    ? { borderColor: "var(--acc)", background: "color-mix(in srgb, var(--acc) 16%, transparent)", color: "var(--acc)" }
                    : { borderColor: "var(--line)", color: "var(--mut)" }
                }
              >
                <Icon kind={it.glyph as IconKind} size={14} />
                {it.label}
                {on && <Icon kind="check" size={12} />}
              </button>
            );
          })}
        </div>
      </div>
    </Reveal>
  );
}

/* ------------------------------- local card ----------------------------- */

function LocalCard() {
  const { geo, locate, dismissGeo, records, openCity } = useAura();
  if (geo.status === "ok" && geo.id) {
    const rec = records[geo.id];
    return (
      <Reveal>
        <button onClick={() => openCity(geo.id as string)} className="glass lift group flex w-full items-center gap-4 rounded-3xl p-4 text-left sm:p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: "color-mix(in srgb, var(--mint) 14%, transparent)", color: "var(--mint)" }}>
            <Icon kind="locate" size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "var(--faint)" }}>Near you</span>
            {rec ? (
              <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                <span className="font-display truncate text-lg font-semibold">{geo.label}</span>
                <span className="font-display text-2xl font-bold" style={{ color: "var(--acc)" }}>{tf(rec.bundle.weather.current.temp)}</span>
                <span className="text-xs font-medium" style={{ color: "var(--mut)" }}>
                  {codeInfo(rec.bundle.weather.current.code, rec.bundle.weather.current.isDay).label} · feels {tf(rec.bundle.weather.current.feels)}
                </span>
              </span>
            ) : (
              <span className="mt-0.5 flex items-center gap-2 text-sm font-medium" style={{ color: "var(--mut)" }}>
                <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-[var(--faint)] border-t-[var(--acc)]" aria-hidden />
                Pulling live conditions for {geo.label}…
              </span>
            )}
          </span>
          {rec && <ScoreDial score={calculateWeatherScore(metricsFromCurrent(rec), "overall").total} size={56} sub="score" />}
          <Icon kind="arrow" size={18} className="shrink-0 opacity-40 transition-transform group-hover:translate-x-1 group-hover:opacity-90" />
        </button>
      </Reveal>
    );
  }
  if (geo.status === "idle" || geo.status === "locating") {
    return (
      <div className="glass flex flex-wrap items-center gap-3 rounded-3xl px-4 py-2.5 text-xs font-bold sm:rounded-full">
        <span className="flex min-w-0 flex-1 basis-full items-start gap-2.5 sm:basis-auto sm:items-center">
          <Icon kind="pin" size={15} className="mt-0.5 shrink-0 sm:mt-0" />
          <span className="min-w-0 flex-1" style={{ color: "var(--mut)" }}>You're browsing the world pulse - with your location Aura also scores your doorstep.</span>
        </span>
        <button onClick={locate} className="chip-btn ml-auto rounded-full bg-[var(--acc)] px-3.5 py-1.5 font-black text-[var(--acc-ink)]">
          {geo.status === "locating" ? "Locating…" : "Use my location"}
        </button>
        <button onClick={dismissGeo} className="chip-btn rounded-full px-2 py-1.5 hover:bg-[var(--glass2)]" style={{ color: "var(--faint)" }}>Not now</button>
      </div>
    );
  }
  return null;
}

/* ------------------------------ morning brief ---------------------------- */

function MorningBrief() {
  const { geo, catalog, records, openCity } = useAura();

  const focus = useMemo(() => {
    if (geo.status === "ok" && geo.id && records[geo.id]) return { city: catalog.find((c) => c.id === geo.id), rec: records[geo.id], mine: true };
    const top = rankCities(catalog, records, "overall", 1)[0];
    return top ? { city: top.city, rec: top.rec, mine: false } : null;
  }, [geo, catalog, records]);

  if (!focus || !focus.city) return null;
  const { city, rec, mine } = focus;
  const m = metricsFromCurrent(rec);
  const c = rec.bundle.weather.current;
  const today = rec.bundle.weather.days[0];
  const bw = findBestHour(rec, "walking", 16);
  const part = nowPart();
  const rainAhead = rec.bundle.weather.hours.slice(0, 12).reduce((mx, h) => Math.max(mx, h.rainP), 0);

  const facts: { icon: IconKind; label: string; value: string; tone?: string }[] = [];
  if (bw.best) facts.push({ icon: "clock", label: `Best outdoor window`, value: `${fmtHour(bw.best.hour.time)} · ${tf(bw.best.hour.temp)}`, tone: "var(--mint)" });
  facts.push({ icon: "drop", label: "Rain risk", value: rainAhead <= 20 ? "low" : rainAhead <= 45 ? "moderate" : "high", tone: rainAhead <= 20 ? "var(--mint)" : rainAhead <= 45 ? "var(--acc)" : "var(--coral)" });
  if (m.aqi != null) facts.push({ icon: "leaf", label: "Air", value: aqiBand(m.aqi).label.toLowerCase(), tone: TONE_VAR[aqiBand(m.aqi).tone] });
  if (today) facts.push({ icon: "uv", label: "UV", value: today.uvMax <= 2 ? "low" : today.uvMax <= 5 ? "moderate" : "high", tone: today.uvMax <= 5 ? "var(--mint)" : "var(--acc)" });
  facts.push({ icon: "commute", label: "Wear", value: clothingTip(m) });

  const say =
    part === "morning"
      ? `Looks like a ${scoreWord(calculateWeatherScore(m, "overall").total).toLowerCase()} start in ${city.name} - ${codeInfo(c.code, c.isDay).label.toLowerCase()}, ${tf(m.temp)}.`
      : part === "evening" || part === "night"
        ? `${city.name} is easing into the ${part} at ${tf(m.temp)} - ${codeInfo(c.code, c.isDay).label.toLowerCase()}.`
        : `${city.name} is holding at ${tf(m.temp)} - ${codeInfo(c.code, c.isDay).label.toLowerCase()}.`;

  return (
    <Reveal>
      <section className="glass relative overflow-hidden rounded-3xl p-5 sm:p-6" aria-label="Daily brief">
        <div className="pointer-events-none absolute -top-16 -left-16 h-48 w-48 rounded-full opacity-50" style={{ background: "radial-gradient(closest-side, var(--glowA), transparent 70%)" }} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="eyebrow">{greeting()}</div>
            <h2 className="font-display headline-sheen mt-1 text-xl font-semibold sm:text-2xl">Your {part === "night" ? "weather check-in" : `${part} brief`}</h2>
          </div>
          <button
            onClick={() => openCity(city.id)}
            className="chip-btn flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold"
            style={{ background: "var(--glass2)", color: "var(--mut)" }}
          >
            <Icon kind={mine ? "locate" : "spark"} size={13} />
            {mine ? "Your location" : `Board leader · ${city.name}`}
            <Icon kind="arrow" size={12} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {facts.map((f, i) => (
            <div key={f.label} className="hairline anim-fadeUp rounded-xl px-3 py-2.5" style={{ background: "var(--glass)", animationDelay: `${i * 70}ms` }}>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--faint)" }}>
                <Icon kind={f.icon} size={11} />{f.label}
              </div>
              <div className="mt-1 text-[13px] leading-snug font-bold capitalize" style={{ color: f.tone ?? "var(--ink)" }}>{f.value}</div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-sm font-medium" style={{ color: "var(--mut)" }}>
          <span className="font-black" style={{ color: "var(--acc)" }}>Aura says · </span>
          {say}
          {bw.best && part === "morning" ? ` Aim for ${fmtHour(bw.best.hour.time)} if you can.` : ""}
        </p>
      </section>
    </Reveal>
  );
}

/* ------------------------------- my cities ------------------------------ */

function StarButton({ id, name, size = 15 }: { id: string; name: string; size?: number }) {
  const { favorites, toggleFavorite } = useAura();
  const fav = favorites.includes(id);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); toggleFavorite(id); }}
      aria-label={fav ? `Remove ${name} from My Cities` : `Add ${name} to My Cities`}
      aria-pressed={fav}
      title={fav ? "Unstar" : "Star for My Cities"}
      className="chip-btn rounded-full p-1 hover:bg-[var(--glass2)]"
      style={{ color: fav ? "var(--acc)" : "var(--faint)" }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill={fav ? "var(--acc)" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden>
        <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.9L12 3.5Z" />
      </svg>
    </button>
  );
}

function tempTrend(rec: CityRecord): { dir: "up" | "down" | "flat"; delta: number } {
  const { hours, current } = rec.bundle.weather;
  const i = hours.findIndex((h) => h.time === current.time);
  const past = i >= 6 ? hours[i - 6] : null;
  if (!past) return { dir: "flat", delta: 0 };
  const d = current.temp - past.temp;
  return { dir: Math.abs(d) < 0.75 ? "flat" : d > 0 ? "up" : "down", delta: d };
}

function recLine(rec: CityRecord): string {
  const m = metricsFromCurrent(rec);
  const res = calculateWeatherScore(m, "overall");
  const why = res.parts.slice().sort((a, b) => b.score - a.score);
  const top = why[0] && why[0].score >= 75 ? why[0].label.toLowerCase() : "a balanced profile";
  const air = m.aqi != null && m.aqi > 100 ? ` - but ${aqiAction(m.aqi).toLowerCase()}` : "";
  return `${scoreWord(res.total)} - ${top}${air}`;
}

function MyCities() {
  const { favorites, catalog, records, openCity, prevScores } = useAura();
  const items: { city: City; rec: CityRecord | undefined }[] = [];
  for (const id of favorites) {
    const city = catalog.find((c) => c.id === id);
    if (city) items.push({ city, rec: records[id] });
  }

  if (!items.length) {
    return (
      <div className="glass flex items-center gap-2.5 rounded-3xl px-4 py-2.5 text-xs font-bold sm:rounded-full" style={{ color: "var(--faint)" }}>
        <Icon kind="star" size={14} className="shrink-0" />
        <span className="min-w-0">Star any city from a ranking row to pin it here - temperature, air, trend and a one-line verdict.</span>
      </div>
    );
  }

  return (
    <Reveal>
      <section aria-label="My Cities">
        <div className="mb-3 flex items-center gap-2">
          <Icon kind="star" size={15} className="text-[var(--acc)]" />
          <h2 className="font-display text-lg font-semibold">My Cities</h2>
          <span className="text-[11px] font-medium" style={{ color: "var(--faint)" }}>{items.length} pinned</span>
        </div>
        <div className="no-scrollbar fade-r flex snap-x gap-3 overflow-x-auto pb-1">
          {items.map(({ city, rec }, i) => {
            if (!rec) {
              return (
                <div key={city.id} className="glass anim-fadeUp w-[240px] shrink-0 snap-start rounded-3xl p-4" style={{ animationDelay: `${i * 70}ms` }}>
                  <div className="font-display truncate text-base font-bold">{city.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs font-medium" style={{ color: "var(--faint)" }}>
                    <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-[var(--faint)] border-t-[var(--acc)]" aria-hidden />
                    syncing…
                  </div>
                </div>
              );
            }
            const c = rec.bundle.weather.current;
            const info = codeInfo(c.code, c.isDay);
            const m = metricsFromCurrent(rec);
            const t = tempTrend(rec);
            return (
              <div key={city.id} className="glass lift anim-fadeUp w-[240px] shrink-0 snap-start rounded-3xl p-4" style={{ animationDelay: `${i * 70}ms` }}>
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => openCity(city.id)} className="min-w-0 text-left">
                    <div className="font-display truncate text-base font-bold hover:underline">{city.name}</div>
                    <div className="truncate text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--faint)" }}>{city.country}</div>
                  </button>
                  <StarButton id={city.id} name={city.name} />
                </div>
                <div className="mt-2.5 flex items-center gap-2.5">
                  <span style={{ color: "var(--cy)" }}><Icon kind={info.icon} size={22} /></span>
                  <span className="font-display text-2xl font-bold tabular-nums">{tf(c.temp)}</span>
                  <span
                    className="flex items-center gap-0.5 text-[11px] font-black tabular-nums"
                    style={{ color: t.dir === "up" ? "var(--coral)" : t.dir === "down" ? "var(--cy)" : "var(--faint)" }}
                    title={`vs 6h ago`}
                  >
                    <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden style={{ transform: t.dir === "down" ? "rotate(180deg)" : "none", opacity: t.dir === "flat" ? 0.35 : 1 }}>
                      <path d="M5 1.5v7M2 4l3-3 3 3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                    </svg>
                    {t.dir === "flat" ? "steady" : td(Math.abs(t.delta))}
                  </span>
                  <span className="ml-auto flex flex-col items-end gap-1">
                    <ScoreDial score={calculateWeatherScore(m, "overall").total} size={44} />
                    {(() => {
                      const prev = prevScores[city.id];
                      const cur = calculateWeatherScore(m, "overall").total;
                      if (prev == null) return null;
                      const d = cur - prev;
                      if (Math.abs(d) < 2) return <span className="text-[9px] font-bold" style={{ color: "var(--faint)" }}>= last visit</span>;
                      return (
                        <span className="rounded-full px-1.5 py-px text-[9px] font-black tabular-nums" style={{ color: d > 0 ? "var(--mint)" : "var(--coral)", background: `color-mix(in srgb, ${d > 0 ? "var(--mint)" : "var(--coral)"} 14%, transparent)` }} title="Outdoor score vs your last visit">
                          {d > 0 ? "▲" : "▼"} {Math.abs(d)} vs last visit
                        </span>
                      );
                    })()}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {m.aqi != null && <ToneChip tone={aqiBand(m.aqi).tone}>AQI {Math.round(m.aqi)}</ToneChip>}
                  <ToneChip tone={m.rainP > 45 ? "coral" : m.rainP > 20 ? "acc" : "cy"}>{Math.round(m.rainP)}% rain</ToneChip>
                  <span className="truncate text-[11px] font-medium" style={{ color: "var(--mut)" }}>{info.label}</span>
                </div>
                <p className="mt-2.5 border-t pt-2.5 text-[11px] leading-relaxed font-medium" style={{ borderColor: "var(--line)", color: "var(--mut)" }}>
                  {recLine(rec)}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </Reveal>
  );
}

/* ------------------------------ ranking row ----------------------------- */

function RankRow({ item, rank, next, delay }: { item: RankItem; rank: number; next?: RankItem; delay: number }) {
  const { openCity, addCompare } = useAura();
  const [open, setOpen] = useState(false);
  const c = item.rec.bundle.weather.current;
  const info = codeInfo(c.code, c.isDay);
  const m = metricsFromCurrent(item.rec);
  const stale = Date.now() - item.rec.fetchedAt > 15 * 60 * 1000;
  const edge = edgeOver(item, next);

  return (
    <div className="anim-fadeUp" style={{ animationDelay: `${delay}ms` }}>
      <div className="glass lift overflow-hidden rounded-2xl">
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`${item.city.name}, rank ${rank}, score ${item.score}`} className="grid w-full grid-cols-[34px_1fr_auto] items-center gap-x-3 gap-y-1 px-3 py-3 text-left sm:grid-cols-[44px_1.2fr_1fr_auto_auto] sm:px-4">
          <span
            className="font-display text-xl font-bold tabular-nums sm:text-2xl"
            style={{ color: rank <= 3 ? "var(--acc)" : "var(--faint)" }}
          >
            {String(rank).padStart(2, "0")}
          </span>

          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="font-display truncate text-base font-semibold sm:text-lg">{item.city.name}</span>
              {stale && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--acc)]" title={`cached ${agoLabel(item.rec.fetchedAt)}`} />}
            </span>
            <span className="block truncate text-[11px] font-medium" style={{ color: "var(--faint)" }}>
              {item.city.country}{item.city.custom ? "" : ` · ${REGION_LABELS[item.city.region] ?? item.city.region}`}
            </span>
          </span>

          <span className="col-start-2 col-span-2 flex min-w-0 items-center justify-between gap-2 sm:col-span-1 sm:col-start-auto">
            <span className="flex shrink-0 items-center gap-2.5">
              <span style={{ color: "var(--cy)" }}><Icon kind={info.icon} size={22} /></span>
              <span className="font-display text-xl font-bold tabular-nums">{tf(c.temp)}</span>
              <span className="hidden text-[11px] leading-tight font-medium lg:block" style={{ color: "var(--mut)" }}>
                {info.label}<br />feels {tf(c.feels)}
              </span>
            </span>
            <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-bold sm:hidden">
              {m.aqi != null && <span className="shrink-0" style={{ color: TONE_VAR[aqiBand(m.aqi).tone] }}>AQI {Math.round(m.aqi)}</span>}
              <span className="shrink-0" style={{ color: "var(--mut)" }}>{Math.round(m.rainP)}% rain</span>
              {item.why.strengths[0] && <span className="truncate" style={{ color: "var(--mint)" }}>· {item.why.strengths[0]}</span>}
            </span>
          </span>

          <span className="col-start-2 hidden items-center gap-1.5 sm:col-start-auto md:flex">
            {m.aqi != null && <ToneChip tone={aqiBand(m.aqi).tone}>AQI {Math.round(m.aqi)}</ToneChip>}
            <ToneChip tone={m.rainP > 45 ? "coral" : m.rainP > 20 ? "acc" : "cy"}><Icon kind="drop" size={10} />{Math.round(m.rainP)}%</ToneChip>
            <ToneChip tone="cy"><Icon kind="wind" size={10} />{Math.round(c.wind)}</ToneChip>
          </span>

          <span className="col-start-3 row-start-1 flex items-center gap-1.5 sm:col-start-auto sm:row-auto">
            <StarButton id={item.city.id} name={item.city.name} />
            <ScoreDial score={item.score} size={52} sub={rank === 1 ? "best" : "score"} />
            <Icon kind="arrow" size={14} className={`shrink-0 opacity-40 transition-transform ${open ? "rotate-90" : ""}`} />
          </span>
        </button>

        {open && (
          <div className="anim-fadeIn border-t px-4 py-4" style={{ borderColor: "var(--line)" }}>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "var(--faint)" }}>
                  {rank === 1 && next ? "Why #1" : "Score breakdown"}
                </div>
                <div className="flex flex-col gap-1.5">
                  {item.parts.slice(0, 6).map((p, i) => (
                    <PartBar key={p.key} label={p.label} display={p.display} score={p.score} delay={i * 60} />
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "var(--faint)" }}>Why {item.city.name} ranks here</div>
                <div className="flex flex-wrap gap-1.5">
                  {item.why.strengths.map((s) => (
                    <span key={s} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ color: "var(--mint)", background: "color-mix(in srgb, var(--mint) 12%, transparent)" }}>
                      <Icon kind="check" size={11} />{s}
                    </span>
                  ))}
                  {item.why.cautions.map((s) => (
                    <span key={s} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ color: "var(--coral)", background: "color-mix(in srgb, var(--coral) 12%, transparent)" }}>
                      <Icon kind="alert" size={11} />{s}
                    </span>
                  ))}
                  {item.why.strengths.length === 0 && item.why.cautions.length === 0 && (
                    <span className="text-xs" style={{ color: "var(--mut)" }}>A balanced, middle-of-the-road profile.</span>
                  )}
                </div>
                {rank === 1 && edge.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "var(--faint)" }}>Edge over #2 · {next?.city.name}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {edge.map((e) => (
                        <span key={e} className="rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums" style={{ color: e.startsWith("+") ? "var(--mint)" : "var(--coral)", background: "var(--glass2)" }}>
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  <button onClick={() => openCity(item.city.id)} className="chip-btn rounded-full bg-[var(--acc)] px-4 py-1.5 text-xs font-black text-[var(--acc-ink)]">
                    Explore {item.city.name}
                  </button>
                  <button onClick={() => addCompare(item.city.id)} className="chip-btn glass rounded-full px-4 py-1.5 text-xs font-bold hover:bg-[var(--glass2)]">
                    + Compare
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ skeletons ------------------------------- */

function RankSkeleton({ delay }: { delay: number }) {
  return (
    <div
      className="glass anim-fadeIn grid grid-cols-[34px_1fr_auto] items-center gap-3 rounded-2xl px-3 py-3.5 sm:grid-cols-[44px_1.2fr_1fr_auto_auto] sm:px-4"
      style={{ animationDelay: `${delay}ms` }}
      aria-hidden
    >
      <div className="skel h-7 w-8 rounded-lg" />
      <div className="flex flex-col gap-1.5">
        <div className="skel h-4 w-2/5 min-w-20 rounded-md" />
        <div className="skel h-3 w-1/4 min-w-12 rounded-md" />
      </div>
      <div className="hidden sm:block"><div className="skel h-5 w-24 rounded-full" /></div>
      <div className="hidden md:block"><div className="skel h-5 w-32 rounded-full" /></div>
      <div className="skel h-12 w-12 rounded-full" />
    </div>
  );
}

/* ------------------------------ ranking list ---------------------------- */

function RankingList({ filters }: { filters: Filters }) {
  const { mode, catalog, records, statuses, unit } = useAura();
  const active = filtersActive(filters);

  const pool = useMemo(() => {
    if (!active) return catalog;
    return catalog.filter((c) => {
      if (!regionMatch(c, filters.region)) return false;
      const rec = records[c.id];
      if (filters.temp !== "any") {
        if (!rec) return false;
        const t = rec.bundle.weather.current.temp;
        if (filters.temp === "cool" && t >= 12) return false;
        if (filters.temp === "mild" && (t < 12 || t >= 20)) return false;
        if (filters.temp === "warm" && (t < 20 || t >= 28)) return false;
        if (filters.temp === "hot" && t < 28) return false;
      }
      if (filters.aqi !== "any") {
        if (!rec) return false;
        const aqi = rec.bundle.air?.now.aqi;
        if (aqi == null) return false;
        if (filters.aqi === "good" && aqi > 50) return false;
        if (filters.aqi === "mod" && aqi > 100) return false;
      }
      return true;
    });
  }, [catalog, records, filters, active]);

  const top = useMemo(() => rankCities(pool, records, mode, 10), [pool, records, mode, unit]);
  const readyCount = useMemo(() => catalog.filter((c) => records[c.id]).length, [catalog, records]);
  const stillLoading = readyCount < catalog.length;
  const skeletonRows = active ? 0 : Math.max(0, Math.min(10 - top.length, stillLoading ? 10 : 0));

  if (top.length === 0 && skeletonRows === 0) {
    return (
      <div className="glass rounded-3xl p-8 text-center">
        <p className="font-display text-base font-semibold">No cities match those filters yet.</p>
        <p className="mx-auto mt-1 max-w-sm text-sm font-medium" style={{ color: "var(--mut)" }}>
          {stillLoading ? `${readyCount}/${catalog.length} cities are still syncing - matches may appear as they land.` : "Try widening the region, temperature or air filters."}
        </p>
      </div>
    );
  }

  const failed = Object.values(statuses).filter((s) => s === "error").length;

  return (
    <div>
      <div className="flex flex-col gap-2.5" role="list" aria-label={`${mode} ranking`}>
        {top.map((item, i) => (
          <div role="listitem" key={item.city.id}>
            <RankRow item={item} rank={i + 1} next={top[i + 1]} delay={Math.min(i * 55, 500)} />
          </div>
        ))}
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <RankSkeleton key={`skel_${i}`} delay={Math.min((top.length + i) * 70, 700)} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] font-medium" style={{ color: "var(--faint)" }}>
        <span>{active ? `${top.length} matches · ` : ""}{MODE_STORY[mode]}</span>
        {failed > 0 && <span style={{ color: "var(--coral)" }}>{failed} cities skipped - their feed is unreachable right now.</span>}
        {!active && stillLoading && <span>{readyCount}/{catalog.length} cities in the live pool.</span>}
      </div>
    </div>
  );
}

/* ---------------------------- explain ranking --------------------------- */

function ExplainPanel({ mode }: { mode: ModeId }) {
  const { rows, note } = modeWeights(mode);
  return (
    <div className="glass2 anim-fadeUp mt-4 max-w-xl rounded-2xl p-5">
      <div className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "var(--faint)" }}>How this ranking is calculated</div>
      <div className="mt-3 flex flex-col gap-1.5">
        {rows.map((r, i) => (
          <div key={r.label} className="grid grid-cols-[132px_1fr_40px] items-center gap-2 text-[11px] sm:grid-cols-[160px_1fr_44px]">
            <span className="truncate font-medium" style={{ color: "var(--mut)" }}>{r.label}</span>
            <div className="h-[6px] overflow-hidden rounded-full" style={{ background: "var(--glass2)" }}>
              <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: "var(--acc)", transition: "width .7s", transitionDelay: `${i * 70}ms` }} />
            </div>
            <span className="text-right font-bold tabular-nums">{r.pct}%</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed font-medium" style={{ color: "var(--faint)" }}>{note}</p>
    </div>
  );
}

/* ----------------------------- where to go ------------------------------ */

function WhereToGo() {
  const { catalog, records, openCity, unit } = useAura();
  const picks = useMemo(() => {
    const used = new Set<string>();
    const defs: { key: ModeId; label: string; icon: IconKind }[] = [
      { key: "overall", label: "Best overall", icon: "spark" },
      { key: "air", label: "Cleanest air", icon: "leaf" },
      { key: "walking", label: "Best for walking", icon: "walk" },
      { key: "running", label: "Best for running", icon: "run" },
      { key: "weekend", label: "Best weekend escape", icon: "compass" },
    ];
    const out: { label: string; icon: IconKind; item: RankItem }[] = [];
    for (const d of defs) {
      const list = rankCities(catalog, records, d.key, 4);
      const item = list.find((l) => !used.has(l.city.id));
      if (item) {
        used.add(item.city.id);
        out.push({ label: d.label, icon: d.icon, item });
      }
    }
    return out;
  }, [catalog, records, unit]);

  if (!picks.length) return null;

  return (
    <Reveal>
      <section className="mt-12">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <div className="eyebrow">Decision time</div>
            <h2 className="font-display headline-sheen mt-1 text-2xl font-semibold sm:text-3xl">Where should I go right now?</h2>
          </div>
          <span className="hidden text-xs font-medium sm:block" style={{ color: "var(--faint)" }}>Five answers, five moods - each earned its spot.</span>
        </div>
        <div className="no-scrollbar fade-r flex snap-x gap-3 overflow-x-auto pb-2">
          {picks.map(({ label, icon, item }, i) => {
            const m = metricsFromCurrent(item.rec);
            return (
              <div key={label} className="glass lift anim-fadeUp relative w-[280px] shrink-0 snap-start overflow-hidden rounded-3xl p-5 sm:w-[300px]" style={{ animationDelay: `${i * 90}ms` }}>
                <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full" style={{ background: `radial-gradient(closest-side, color-mix(in srgb, ${TONE_VAR[scoreTone(item.score)]} 22%, transparent), transparent 70%)` }} />
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--faint)" }}>
                  <Icon kind={icon} size={13} />
                  {label}
                </div>
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display truncate text-xl font-bold">{item.city.name}</div>
                    <div className="truncate text-[11px] font-medium" style={{ color: "var(--faint)" }}>{item.city.country}</div>
                  </div>
                  <ScoreDial score={item.score} size={58} sub="/100" />
                </div>
                <div className="mt-2 text-sm font-semibold" style={{ color: scoreTone(item.score) === "mint" ? "var(--mint)" : "var(--acc)" }}>
                  {scoreWord(item.score)} right now.
                </div>
                <div className="mt-1 text-xs font-medium tabular-nums" style={{ color: "var(--mut)" }}>
                  {tf(m.temp)} · AQI {m.aqi == null ? "–" : Math.round(m.aqi)} · rain {Math.round(m.rainP)}% · wind {Math.round(m.wind)} km/h
                </div>
                <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--line)" }}>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--faint)" }}>Why Aura picked it</div>
                  <p className="mt-1.5 text-xs leading-relaxed font-medium" style={{ color: "var(--mut)" }}>
                    {item.why.strengths.slice(0, 2).join(", ") || "A well-balanced profile across the board"}
                    {item.why.cautions[0] ? ` - mind: ${item.why.cautions[0].toLowerCase()}` : "."}
                  </p>
                </div>
                <button onClick={() => openCity(item.city.id)} className="chip-btn mt-4 flex w-full items-center justify-center gap-2 rounded-full py-2 text-xs font-black transition-colors" style={{ background: "var(--glass3)" }}>
                  Explore {item.city.name}
                  <Icon kind="arrow" size={13} />
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </Reveal>
  );
}

/* ------------------------------- ask aura ------------------------------- */

const ASK_CHIPS = [
  "Where should I go right now?",
  "What should I wear?",
  "Should I run now?",
  "Do I need an umbrella in Tokyo?",
  "Best air right now",
  "Where should I go this weekend?",
  "Compare Paris and Rome",
];

function AskAura() {
  const { ask, askAura, clearAsk, openCity, setMode, goHome, openCompare, setCompare } = useAura();
  const [input, setInput] = useState("");

  const submit = (q: string) => {
    setInput("");
    askAura(q);
  };

  return (
    <Reveal>
      <section className="mt-12" aria-label="Ask Aura">
        <div className="glass overflow-hidden rounded-3xl">
          <div className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: "var(--line)" }}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "color-mix(in srgb, var(--lav) 16%, transparent)", color: "var(--lav)" }}>
              <Icon kind="spark" size={17} />
            </span>
            <div>
              <h3 className="font-display flex items-center gap-2 text-lg font-semibold leading-none">
                Ask Aura
                <span className="rounded-full px-2 py-0.5 text-[9px] font-black tracking-[0.16em] uppercase" style={{ background: "color-mix(in srgb, var(--cy) 14%, transparent)", color: "var(--cy)" }}>
                  global · live board
                </span>
              </h3>
              <p className="mt-1 text-[11px] font-medium" style={{ color: "var(--faint)" }}>Answers are computed live from every synced city - real numbers, no filler. Follow-ups keep context.</p>
            </div>
            {ask.answer && (
              <button onClick={clearAsk} className="chip-btn ml-auto rounded-full px-3 py-1.5 text-[11px] font-bold hover:bg-[var(--glass2)]" style={{ color: "var(--mut)" }}>
                Clear
              </button>
            )}
          </div>

          {(ask.q || ask.thinking || ask.answer) && (
            <div className="anim-fadeIn max-h-80 space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
              <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm font-medium" style={{ background: "var(--glass3)" }}>
                {ask.q}
              </div>
              {ask.thinking && (
                <div className="flex w-fit items-center gap-2 rounded-2xl rounded-bl-md px-4 py-2.5" style={{ background: "var(--glass2)" }} aria-label="Aura is thinking">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ background: "var(--lav)", animationDelay: `${i * 140}ms` }} />
                  ))}
                </div>
              )}
              {ask.answer && (
                <div className="w-fit max-w-[92%] rounded-2xl rounded-bl-md px-4 py-3" style={{ background: "var(--glass2)" }}>
                  {ask.answer.text.map((line, i) => (
                    <p key={i} className={`text-sm leading-relaxed font-medium ${i === 0 ? "" : "mt-1.5"} ${i > 0 && line.startsWith("·") ? "pl-2" : ""}`} style={{ color: i === 0 ? "var(--ink)" : "var(--mut)" }}>
                      {line}
                    </p>
                  ))}
                  {ask.answer.actions && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {ask.answer.actions.map((a) => (
                        <button
                          key={a.label}
                          onClick={() => {
                            if (a.view === "city" && a.cityId) openCity(a.cityId);
                            else if (a.view === "compare") {
                              if (a.compareIds) setCompare(a.compareIds);
                              openCompare();
                            } else {
                              if (a.mode) setMode(a.mode);
                              goHome();
                            }
                          }}
                          className="chip-btn flex items-center gap-1.5 rounded-full bg-[var(--acc)] px-3.5 py-1.5 text-xs font-black text-[var(--acc-ink)]"
                        >
                          {a.label}
                          <Icon kind="arrow" size={12} />
                        </button>
                      ))}
                    </div>
                  )}
                  {ask.answer.followUps && ask.answer.followUps.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3" style={{ borderColor: "var(--line)" }}>
                      <span className="text-[9px] font-black tracking-[0.18em] uppercase" style={{ color: "var(--faint)" }}>Try</span>
                      {ask.answer.followUps.map((f) => (
                        <button
                          key={f}
                          onClick={() => submit(f)}
                          className="chip-btn rounded-full border px-2.5 py-1 text-[11px] font-bold hover:bg-[var(--glass2)]"
                          style={{ borderColor: "var(--line)", color: "var(--mut)" }}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="border-t px-5 py-4" style={{ borderColor: "var(--line)" }}>
            <div className="no-scrollbar fade-r mb-3 flex gap-2 overflow-x-auto pb-0.5">
              {ASK_CHIPS.map((c) => (
                <button key={c} onClick={() => submit(c)} className="chip-btn glass shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold whitespace-nowrap hover:bg-[var(--glass2)]" style={{ color: "var(--mut)" }}>
                  {c}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); submit(input); }}
              className="glass flex items-center gap-2 rounded-full px-4 py-2.5"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about a city, a ranking, or a decision…"
                aria-label="Ask Aura a question"
                className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-[var(--faint)]"
              />
              <button type="submit" disabled={!input.trim()} className="chip-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--acc)] text-[var(--acc-ink)] disabled:opacity-35" aria-label="Send question">
                <Icon kind="arrow" size={14} />
              </button>
            </form>
          </div>
        </div>
      </section>
    </Reveal>
  );
}

/* --------------------------------- page --------------------------------- */

export default function WorldPulse() {
  const { mode, setMode, onboarded } = useAura();
  const [tuning, setTuning] = useState(false);
  const [explain, setExplain] = useState(false);
  const [filters, setFilters] = useState<Filters>(FILTERS_DEFAULT);

  const headline = HEADLINES[mode];
  const active = filtersActive(filters);

  const FilterChip = ({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: React.ReactNode; label: string }) => (
    <button
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      className={`chip-btn shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold whitespace-nowrap ${on ? "" : "hover:bg-[var(--glass2)]"}`}
      style={
        on
          ? { borderColor: "var(--cy)", background: "color-mix(in srgb, var(--cy) 14%, transparent)", color: "var(--cy)" }
          : { borderColor: "var(--line)", background: "var(--glass)", color: "var(--mut)" }
      }
    >
      {children}
    </button>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 pb-16 sm:px-6">
      <div className="flex flex-col gap-3">
        <SyncStrip />
        <OfflineBanner />
        <SignalsTicker />
        {(!onboarded || tuning) && <Onboarding onDone={() => setTuning(false)} />}
        <MorningBrief />
        <LocalCard />
        <MyCities />
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <div className="eyebrow">World Pulse · live board</div>
            <h1 className="font-display headline-sheen mt-2 text-3xl leading-[1.05] font-bold tracking-tight sm:text-5xl">{headline}</h1>
            <p className="mt-3 text-sm font-medium sm:text-base" style={{ color: "var(--mut)" }}>
              {MODE_STORY[mode]}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              onClick={() => setExplain((e) => !e)}
              aria-expanded={explain}
              className="chip-btn glass flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold hover:bg-[var(--glass2)]"
              style={{ color: "var(--mut)" }}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black" style={{ border: "1.5px solid currentColor" }}>i</span>
              How is this calculated?
            </button>
            {onboarded && (
              <button
                onClick={() => setTuning((t) => !t)}
                className="chip-btn glass flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold hover:bg-[var(--glass2)]"
                style={{ color: "var(--mut)" }}
              >
                <Icon kind="spark" size={13} />
                {tuning ? "Close tuner" : "Personalize board"}
              </button>
            )}
          </div>
        </div>

        {explain && <ExplainPanel mode={mode} />}

        <div className="no-scrollbar fade-r fade-r-off-sm mt-6 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap"
          role="tablist"
          aria-label="Ranking mode"
          onKeyDown={(e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            e.preventDefault();
            const i = MODES.findIndex((m) => m.id === mode);
            const n = (i + (e.key === "ArrowRight" ? 1 : -1) + MODES.length) % MODES.length;
            setMode(MODES[n].id);
          }}
        >
          {MODES.map((m) => {
            const isOn = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                role="tab"
                aria-selected={isOn}
                className={`chip-btn flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold whitespace-nowrap ${isOn ? "" : "hover:bg-[var(--glass2)]"}`}
                style={
                  isOn
                    ? { background: "var(--acc)", borderColor: "var(--acc)", color: "var(--acc-ink)" }
                    : { borderColor: "var(--line)", color: "var(--mut)", background: "var(--glass)" }
                }
              >
                <Icon kind={m.icon} size={13} />
                {m.label}
              </button>
            );
          })}
        </div>

        {/* refinement filters */}
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Region filter">
            <span className="mr-1 shrink-0 text-[9px] font-black tracking-[0.18em] uppercase" style={{ color: "var(--faint)" }}>Region</span>
            {REGION_GROUPS.map((g) => (
              <FilterChip key={g.id} on={filters.region === g.id} onClick={() => setFilters((f) => ({ ...f, region: g.id }))} label={`Region: ${g.label}`}>{g.label}</FilterChip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Temperature and air filters">
            <span className="mr-1 shrink-0 text-[9px] font-black tracking-[0.18em] uppercase" style={{ color: "var(--faint)" }}>Temp</span>
            {TEMP_GROUPS.map((g) => (
              <FilterChip key={g.id} on={filters.temp === g.id} onClick={() => setFilters((f) => ({ ...f, temp: g.id }))} label={`Temperature: ${g.label()}`}>{g.label()}</FilterChip>
            ))}
            <span className="mx-2 hidden h-4 w-px shrink-0 sm:block" style={{ background: "var(--line)" }} aria-hidden />
            <span className="mr-1 shrink-0 text-[9px] font-black tracking-[0.18em] uppercase" style={{ color: "var(--faint)" }}>Air</span>
            {AQI_GROUPS.map((g) => (
              <FilterChip key={g.id} on={filters.aqi === g.id} onClick={() => setFilters((f) => ({ ...f, aqi: g.id }))} label={`Air quality: ${g.label}`}>{g.label}</FilterChip>
            ))}
            {active && (
              <button onClick={() => setFilters(FILTERS_DEFAULT)} className="chip-btn ml-1 flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold hover:bg-[var(--glass2)]" style={{ color: "var(--coral)" }}>
                <Icon kind="x" size={11} />
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div className="mt-5">
          <RankingList filters={filters} />
        </div>
      </section>

      <AtlasGate />
      <WhereToGo />
      <AskAura />
    </div>
  );
}
