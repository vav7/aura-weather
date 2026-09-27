import { useEffect, useMemo, useState } from "react";
import { useAura } from "../store";
import { CityRecord, aqiBand, codeInfo, scoreTone, TONE_VAR, tf, td } from "../lib/data";
import {
  ActivityId, ACTIVITY_LABEL, agoLabel, aqiAction, buildAuraSays, calculateWeatherScore, confidence, dayLabel,
  detectAlerts, findBestHour, fmtHour, fmtHourShort, localClock, metricsFromCurrent, scoreWord,
  shareSummary, stars, tonightStats, tomorrowVsToday, whyFromScore,
} from "../lib/engine";
import { Icon, PartBar, Reveal, ScoreDial, Sparkline, Stars, TempBar, ToneChip } from "./ui";

function useTick(ms: number) {
  const [, setT] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setT((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

/* --------------------------------- hero --------------------------------- */

function Hero({ id }: { id: string }) {
  const { catalog, records, addCompare, openCompare, compare, goHome, statuses, retryAll } = useAura();
  const city = catalog.find((c) => c.id === id);
  if (!city) return null;
  const rec = records[id];
  useTick(30000);

  if (!rec) {
    const failed = statuses[id] === "error";
    return (
      <div className="glass rounded-3xl p-10 text-center">
        {failed ? (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "color-mix(in srgb, var(--coral) 14%, transparent)", color: "var(--coral)" }}>
              <Icon kind="alert" size={22} />
            </div>
            <p className="text-sm font-bold">{city.name} is unreachable right now</p>
            <p className="mx-auto mt-1 max-w-sm text-xs font-medium" style={{ color: "var(--faint)" }}>
              Both the primary and fallback providers timed out. The rest of the board is unaffected - and a retry often lands.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <button onClick={retryAll} className="chip-btn flex items-center gap-1.5 rounded-full bg-[var(--acc)] px-4 py-2 text-xs font-black text-[var(--acc-ink)]">
                <Icon kind="refresh" size={13} /> Retry {city.name}
              </button>
              <button onClick={goHome} className="chip-btn glass rounded-full px-4 py-2 text-xs font-bold hover:bg-[var(--glass2)]">Back to the board</button>
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--faint)] border-t-[var(--acc)]" />
            <p className="text-sm font-bold">Fetching live conditions for {city.name}…</p>
            <p className="mt-1 text-xs font-medium" style={{ color: "var(--faint)" }}>Weather and air quality stream in separately - whichever lands first paints first.</p>
          </>
        )}
      </div>
    );
  }

  const c = rec.bundle.weather.current;
  const info = codeInfo(c.code, c.isDay);
  const m = metricsFromCurrent(rec);
  const overall = calculateWeatherScore(m, "overall");
  const why = whyFromScore(overall);
  const today = rec.bundle.weather.days[0];
  const inCompare = compare.includes(id);

  return (
    <div className="glass anim-fadeUp relative overflow-hidden rounded-3xl p-6 sm:p-8">
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full" style={{ background: `radial-gradient(closest-side, color-mix(in srgb, ${TONE_VAR[scoreTone(overall.total)]} 20%, transparent), transparent 70%)` }} />
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={goHome} className="chip-btn glass flex h-8 w-8 items-center justify-center rounded-full hover:bg-[var(--glass2)]" aria-label="Back to World Pulse">
              <Icon kind="arrow" size={14} className="rotate-180" />
            </button>
            <div className="eyebrow">{city.country}{city.custom ? "" : ` · ${city.region}`}</div>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "var(--glass2)", color: "var(--faint)" }}>
              local {localClock(rec.bundle.weather.timezone)}
            </span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "var(--glass2)", color: "var(--faint)" }}>
              {agoLabel(rec.fetchedAt)}
            </span>
          </div>
          <h1 className="font-display headline-sheen mt-2 text-4xl font-bold tracking-tight sm:text-5xl">{city.name}</h1>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-3">
              <span style={{ color: "var(--acc)" }}><Icon kind={info.icon} size={46} strokeWidth={1.4} /></span>
              <span className="font-display text-7xl leading-none font-bold tabular-nums sm:text-8xl">{tf(c.temp)}</span>
            </div>
            <div>
              <div className="text-sm font-bold">{info.label}</div>
              <div className="text-xs font-medium" style={{ color: "var(--mut)" }}>Feels like {tf(c.feels)}</div>
              {today && (
                <div className="mt-1 text-xs font-bold tabular-nums">
                  <span style={{ color: "var(--acc)" }}>H {tf(today.tmax)}</span>
                  <span style={{ color: "var(--faint)" }}> · </span>
                  <span style={{ color: "var(--cy)" }}>L {tf(today.tmin)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 grid max-w-md grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { icon: "drop" as const, label: "Humidity", val: `${Math.round(c.humidity)}%` },
              { icon: "wind" as const, label: "Wind", val: `${Math.round(c.wind)} km/h` },
              { icon: "uv" as const, label: "UV index", val: `${Math.round(c.uv)}` },
              { icon: "eye" as const, label: "Visibility", val: `${Math.round(c.vis)} km` },
              { icon: "gauge" as const, label: "Pressure", val: `${Math.round(c.pressure)}` },
              { icon: "drop" as const, label: "Rain now", val: `${c.precip.toFixed(1)} mm` },
              ...(today?.sunrise ? [{ icon: "sun" as const, label: "Sunrise", val: fmtHour(today.sunrise) }] : []),
              ...(today?.sunset ? [{ icon: "moon" as const, label: "Sunset", val: fmtHour(today.sunset) }] : []),
            ].map((s) => (
              <div key={s.label} className="hairline rounded-xl px-3 py-2" style={{ background: "var(--glass)" }}>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--faint)" }}>
                  <Icon kind={s.icon} size={11} />{s.label}
                </div>
                <div className="mt-0.5 text-sm font-bold tabular-nums">{s.val}</div>
              </div>
            ))}
          </div>

          {(() => {
            const sorted = [...overall.parts].sort((a, b) => a.score - b.score);
            const friction = sorted[0];
            const best = sorted[sorted.length - 1];
            const line =
              friction && friction.score < 55
                ? `${friction.label} is the main friction right now (${friction.display}) - ${best.label.toLowerCase()} is working in your favor.`
                : best
                  ? `${best.label} is doing the heavy lifting (${best.display}) - nothing is actively working against you.`
                  : "";
            return line ? (
              <p className="mt-2 max-w-md text-xs leading-relaxed font-medium" style={{ color: "var(--mut)" }}>
                <span className="font-black" style={{ color: "var(--acc)" }}>What this means · </span>
                {line}
              </p>
            ) : null;
          })()}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() => { if (!inCompare) addCompare(id); openCompare(); }}
              className="chip-btn glass flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black hover:bg-[var(--glass2)]"
            >
              <Icon kind="compare" size={14} /> {inCompare ? "Open comparison" : "Add to compare"}
            </button>
            <ShareButton id={id} rec={rec} />
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 lg:pt-6">
          <ScoreDial score={overall.total} size={128} sub="outdoor score" />
          <div className="text-center">
            <div className="text-sm font-black" style={{ color: TONE_VAR[scoreTone(overall.total)] }}>{scoreWord(overall.total)}</div>
            {(() => {
              const conf = confidence(rec);
              return (
                <div
                  className="mx-auto mt-1.5 w-fit rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em]"
                  style={
                    conf.level === "high"
                      ? { color: "var(--mint)", background: "color-mix(in srgb, var(--mint) 12%, transparent)" }
                      : { color: "var(--acc)", background: "color-mix(in srgb, var(--acc) 14%, transparent)" }
                  }
                  title="How much of this score rests on complete data"
                >
                  {conf.note}
                </div>
              );
            })()}
            <div className="mt-1 flex max-w-[260px] flex-wrap justify-center gap-1.5">
              {why.strengths.slice(0, 3).map((s) => (
                <span key={s} className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: "var(--mint)", background: "color-mix(in srgb, var(--mint) 12%, transparent)" }}>{s}</span>
              ))}
              {why.cautions.slice(0, 2).map((s) => (
                <span key={s} className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: "var(--coral)", background: "color-mix(in srgb, var(--coral) 12%, transparent)" }}>{s}</span>
              ))}
            </div>
          </div>
          <div className="hairline w-full max-w-[280px] rounded-2xl p-3" style={{ background: "var(--glass)" }}>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--faint)" }}>Why this score</div>
            <div className="flex flex-col gap-1.5">
              {overall.parts.slice(0, 5).map((p, i) => (
                <PartBar key={p.key} label={p.label} display={p.display} score={p.score} delay={i * 70} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ next 6 hours ---------------------------- */

function Next6({ rec }: { rec: CityRecord }) {
  const hours = useMemo(() => {
    const idx = Math.max(0, rec.bundle.weather.hours.findIndex((h) => h.time >= rec.bundle.weather.current.time));
    return rec.bundle.weather.hours.slice(idx, idx + 6);
  }, [rec]);
  const airTimes = rec.bundle.air?.series.times ?? [];

  return (
    <Reveal>
      <section className="glass rounded-3xl p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Icon kind="clock" size={15} className="opacity-60" />
          <h2 className="font-display text-lg font-semibold">Next 6 hours</h2>
        </div>
        <div className="no-scrollbar fade-r -mx-2 flex gap-2 overflow-x-auto px-2 pb-1 snap-x">
          {hours.map((h, i) => {
            const info = codeInfo(h.code, h.isDay);
            const ai = airTimes.indexOf(h.time);
            const aqi = ai >= 0 && rec.bundle.air ? rec.bundle.air.series.aqi[ai] : rec.bundle.air?.now.aqi;
            return (
              <div key={h.time} className="hairline anim-fadeUp min-w-[118px] flex-1 snap-start rounded-2xl px-3 py-3 text-center" style={{ background: i === 0 ? "var(--glass2)" : "var(--glass)", animationDelay: `${i * 60}ms` }}>
                <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: i === 0 ? "var(--acc)" : "var(--faint)" }}>
                  {i === 0 ? "Now" : fmtHourShort(h.time)}
                </div>
                <div className="my-2 flex justify-center" style={{ color: "var(--cy)" }}><Icon kind={info.icon} size={26} /></div>
                <div className="font-display text-xl font-bold tabular-nums">{tf(h.temp)}</div>
                <div className="mt-1.5 flex flex-col gap-0.5 text-[10px] font-bold tabular-nums" style={{ color: "var(--mut)" }}>
                  <span className="flex items-center justify-center gap-1"><Icon kind="drop" size={9} />{Math.round(h.rainP)}%</span>
                  <span className="flex items-center justify-center gap-1"><Icon kind="wind" size={9} />{Math.round(h.wind)} km/h</span>
                  <span className="flex items-center justify-center gap-1"><Icon kind="uv" size={9} />UV {Math.round(h.uv)}</span>
                  {aqi != null && <span className="flex items-center justify-center gap-1"><Icon kind="leaf" size={9} />AQI {Math.round(aqi)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </Reveal>
  );
}

/* ------------------------------ best windows ---------------------------- */

const WINDOW_ACTS: { id: ActivityId; icon: "run" | "walk" | "food" | "camera" }[] = [
  { id: "running", icon: "run" },
  { id: "walking", icon: "walk" },
  { id: "dining", icon: "food" },
  { id: "photography", icon: "camera" },
];

function BestWindows({ rec }: { rec: CityRecord }) {
  return (
    <Reveal>
      <section className="glass rounded-3xl p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Icon kind="spark" size={15} className="opacity-60" />
          <h2 className="font-display text-lg font-semibold">Best windows · next 36h</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {WINDOW_ACTS.map((a, i) => {
            const bw = findBestHour(rec, a.id);
            if (!bw.best) return null;
            const h = bw.best.hour;
            return (
              <div key={a.id} className="hairline anim-fadeUp flex flex-col rounded-2xl p-4" style={{ background: "var(--glass)", animationDelay: `${i * 80}ms` }}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--faint)" }}>
                    <Icon kind={a.icon} size={13} /> Best {ACTIVITY_LABEL[a.id]}
                  </span>
                  <Stars n={bw.best.star} size={11} />
                </div>
                <div className="font-display mt-2 text-2xl font-bold" style={{ color: "var(--acc)" }}>{fmtHour(h.time)}</div>
                <div className="text-[11px] font-bold tabular-nums" style={{ color: "var(--mut)" }}>
                  {tf(h.temp)} · rain {Math.round(h.rainP)}% · wind {Math.round(h.wind)} km/h · UV {Math.round(h.uv)}{bw.best.aqi != null ? ` · AQI ${Math.round(bw.best.aqi)}` : ""}
                </div>
                <div className="mt-1 text-[11px] font-black" style={{ color: TONE_VAR[scoreTone(bw.best.score)] }}>
                  {scoreWord(bw.best.score)} · {bw.best.score}/100
                </div>
                {a.id === "running" && (bw.second || bw.avoid) && (
                  <div className="mt-3 border-t pt-2 text-[11px] font-bold" style={{ borderColor: "var(--line)" }}>
                    {bw.second && <div className="flex justify-between" style={{ color: "var(--mut)" }}><span>2nd best</span><span className="tabular-nums">{fmtHour(bw.second.hour.time)} · {bw.second.score}</span></div>}
                    {bw.avoid && <div className="mt-0.5 flex justify-between" style={{ color: "var(--coral)" }}><span>Avoid</span><span className="tabular-nums">{fmtHour(bw.avoid.hour.time)} · {bw.avoid.score}</span></div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </Reveal>
  );
}

/* --------------------------------- air ---------------------------------- */

function AirPanel({ rec }: { rec: CityRecord }) {
  const air = rec.bundle.air;
  if (!air) {
    return (
      <Reveal>
        <section className="glass rounded-3xl p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Icon kind="leaf" size={15} className="opacity-60" />
            <h2 className="font-display text-lg font-semibold">Air quality</h2>
          </div>
          <p className="mt-3 flex items-center gap-2 text-sm font-medium" style={{ color: rec.bundle.airMissing ? "var(--acc)" : "var(--faint)" }}>
            {!rec.bundle.airMissing && <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-[var(--faint)] border-t-[var(--acc)]" />}
            {rec.bundle.airMissing ? "The air-quality feed didn't answer for this city - weather is fully live, AQI is unavailable (not invented)." : "Air data is still syncing - it streams independently from weather."}
          </p>
        </section>
      </Reveal>
    );
  }

  const band = aqiBand(air.now.aqi);
  const times = air.series.times;
  const nowIdx = times.findIndex((t) => t <= air.now.time && (!times[times.indexOf(t) + 1] || times[times.indexOf(t) + 1] > air.now.time));
  const idxOf = (hour: string) => times.findIndex((t) => t.endsWith(`T${hour}:00`));
  const morning = idxOf("08");
  const tonight = idxOf("20");
  const prev3 = nowIdx >= 3 ? air.series.aqi[nowIdx - 3] : air.series.aqi[Math.max(0, nowIdx - 1)];
  const delta = prev3 != null ? air.now.aqi - prev3 : 0;
  const trend = delta <= -3 ? { label: "improving", icon: "↓", color: "var(--mint)" } : delta >= 3 ? { label: "worsening", icon: "↑", color: "var(--coral)" } : { label: "steady", icon: "→", color: "var(--acc)" };

  const sparkVals = air.series.aqi.slice(Math.max(0, nowIdx - 8), Math.min(times.length, (nowIdx < 0 ? 0 : nowIdx) + 10)).filter((v) => v != null);
  const future = nowIdx >= 0 && nowIdx + 3 < times.length;

  return (
    <Reveal>
      <section className="glass @container/air rounded-3xl p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Icon kind="leaf" size={15} className="opacity-60" />
          <h2 className="font-display text-lg font-semibold">Air quality</h2>
          <span className="ml-auto flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black" style={{ color: trend.color, background: `color-mix(in srgb, ${trend.color} 13%, transparent)` }}>
            {trend.icon} {trend.label}
          </span>
        </div>
        <div className="grid gap-6 @3xl/air:grid-cols-[auto_minmax(0,1fr)]">
          <div className="flex min-w-0 max-w-full items-center gap-5 self-start">
            <ScoreDial score={Math.max(2, 100 - air.now.aqi * 0.32)} size={110} sub={`AQI ${Math.round(air.now.aqi)}`} />
            <div className="min-w-0 flex-1">
              <div className="font-display text-xl font-bold" style={{ color: TONE_VAR[band.tone] }}>{band.label}</div>
              <p className="mt-1 max-w-[240px] text-xs font-medium" style={{ color: "var(--mut)" }}>{band.advice}</p>
              <p
                className="mt-2 inline-flex max-w-[260px] items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{ color: TONE_VAR[band.tone], background: `color-mix(in srgb, ${TONE_VAR[band.tone]} 12%, transparent)` }}
              >
                <Icon kind="leaf" size={12} className="shrink-0" />
                <span className="min-w-0 text-left">{aqiAction(air.now.aqi)}</span>
              </p>
            </div>
          </div>
          <div className="@container/aircol min-w-0">
            <div className="grid grid-cols-2 gap-2 @sm/aircol:grid-cols-4">
              {[
                { l: "PM2.5", v: `${air.now.pm25.toFixed(1)}`, u: "µg/m³" },
                { l: "PM10", v: `${air.now.pm10.toFixed(0)}`, u: "µg/m³" },
                { l: "Ozone", v: `${air.now.o3.toFixed(0)}`, u: "µg/m³" },
                { l: "NO₂", v: `${air.now.no2.toFixed(0)}`, u: "µg/m³" },
              ].map((x) => (
                <div key={x.l} className="hairline min-w-0 rounded-xl px-3 py-2" style={{ background: "var(--glass)" }}>
                  <div className="truncate text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--faint)" }}>{x.l}</div>
                  <div className="truncate text-sm font-bold tabular-nums">{x.v} <span className="text-[9px] font-medium" style={{ color: "var(--faint)" }}>{x.u}</span></div>
                </div>
              ))}
            </div>
            {sparkVals.length > 2 && (
              <div className="mt-4">
                <Sparkline values={sparkVals} stroke={TONE_VAR[band.tone]} height={54} />
                <div className="mt-1 grid grid-cols-3 text-[10px] font-bold" style={{ color: "var(--faint)" }}>
                  <span className="text-left">~8h ago</span>
                  <span className="text-center">now</span>
                  <span className="text-right">{future ? "+10h forecast" : "no forward data"}</span>
                </div>
              </div>
            )}
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                { l: "Morning", v: morning >= 0 ? air.series.aqi[morning] : null },
                { l: "Now", v: air.now.aqi },
                { l: "Tonight", v: tonight >= 0 && tonight > (nowIdx < 0 ? 999 : nowIdx) ? air.series.aqi[tonight] : tonight >= 0 ? air.series.aqi[tonight] : null },
              ].map((x) => (
                <div key={x.l} className="hairline min-w-0 rounded-xl px-2 py-2" style={{ background: "var(--glass)" }}>
                  <div className="truncate text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--faint)" }}>{x.l}</div>
                  <div className="text-sm font-black tabular-nums" style={{ color: x.v == null ? "var(--faint)" : TONE_VAR[aqiBand(x.v).tone] }}>
                    {x.v == null ? "-" : Math.round(x.v)}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] font-medium" style={{ color: "var(--faint)" }}>
              {future ? "Tonight's value comes from the air-quality forecast feed - labelled, never invented." : "Only current readings are available for this city right now."}
            </p>
          </div>
        </div>
      </section>
    </Reveal>
  );
}

/* ------------------------------- aura says ------------------------------ */

function AuraSays({ id, rec }: { id: string; rec: CityRecord }) {
  const { catalog, interests, unit } = useAura();
  const city = catalog.find((c) => c.id === id);
  if (!city) return null;
  const activity: ActivityId = interests.includes("running") ? "running" : interests.includes("travel") ? "travel" : "walking";
  const text = useMemo(() => buildAuraSays(city, rec, activity), [city, rec, activity, unit]);
  return (
    <Reveal>
      <section className="glass relative overflow-hidden rounded-3xl p-6 sm:p-7">
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full" style={{ background: "radial-gradient(closest-side, var(--glowB), transparent 70%)" }} />
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "color-mix(in srgb, var(--lav) 16%, transparent)", color: "var(--lav)" }}>
            <Icon kind="spark" size={15} />
          </span>
          <h2 className="font-display text-lg font-semibold">Aura says</h2>
        </div>
        <blockquote className="font-display mt-3 max-w-3xl text-lg leading-relaxed font-medium sm:text-xl">
          “{text}”
        </blockquote>
      </section>
    </Reveal>
  );
}

/* -------------------------------- 7 days -------------------------------- */

function Week({ rec }: { rec: CityRecord }) {
  const days = rec.bundle.weather.days.slice(0, 7);
  if (!days.length) return null; // defensive: an empty daily array must never reach Math.min()
  const weekMin = Math.min(...days.map((d) => d.tmin));
  const weekMax = Math.max(...days.map((d) => d.tmax));
  return (
    <Reveal>
      <section className="glass rounded-3xl p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Icon kind="layers" size={15} className="opacity-60" />
          <h2 className="font-display text-lg font-semibold">7-day outlook</h2>
        </div>
        <div className="flex flex-col">
          {days.map((d, i) => {
            const info = codeInfo(d.code, true);
            return (
              <div key={d.date} className="anim-fadeUp grid grid-cols-[52px_28px_1fr_auto] items-center gap-3 border-b py-2.5 last:border-b-0 sm:grid-cols-[64px_32px_110px_1fr_120px]" style={{ borderColor: "var(--line)", animationDelay: `${i * 50}ms` }}>
                <span className="text-xs font-black uppercase tracking-wide" style={{ color: i === 0 ? "var(--acc)" : "var(--mut)" }}>{dayLabel(d.date, i)}</span>
                <span style={{ color: "var(--cy)" }}><Icon kind={info.icon} size={20} /></span>
                <span className="hidden truncate text-[11px] font-medium sm:block" style={{ color: "var(--faint)" }}>{info.label}</span>
                <div className="col-start-3 flex items-center gap-2 sm:col-start-4">
                  <span className="w-8 text-right text-xs font-bold tabular-nums" style={{ color: "var(--cy)" }}>{tf(d.tmin)}</span>
                  <TempBar tmin={d.tmin} tmax={d.tmax} weekMin={weekMin} weekMax={weekMax} />
                  <span className="w-8 text-xs font-black tabular-nums" style={{ color: "var(--acc)" }}>{tf(d.tmax)}</span>
                </div>
                <span className="col-start-4 flex items-center justify-end gap-2 text-[11px] font-bold tabular-nums sm:col-start-5" style={{ color: "var(--mut)" }}>
                  <span className="flex items-center gap-1"><Icon kind="drop" size={10} />{Math.round(d.rainPMax)}%</span>
                  <span className="hidden items-center gap-1 sm:flex"><Icon kind="wind" size={10} />{Math.round(d.windMax)}</span>
                  <span className="hidden items-center gap-1 md:flex"><Icon kind="uv" size={10} />{Math.round(d.uvMax)}</span>
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </Reveal>
  );
}

/* -------------------------------- alerts --------------------------------- */

function AlertsStrip({ rec }: { rec: CityRecord }) {
  const { unit } = useAura();
  const alerts = useMemo(() => detectAlerts(rec), [rec, unit]);
  if (!alerts.length) return null;
  return (
    <div className="flex flex-col gap-2" role="status" aria-label="Weather alerts">
      {alerts.map((a) => (
        <div key={a.kind + a.title} className="glass anim-fadeUp flex items-center gap-3 rounded-2xl px-4 py-3" style={{ borderColor: `color-mix(in srgb, ${a.tone === "coral" ? "var(--coral)" : "var(--acc)"} 40%, var(--line))` }}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${a.tone === "coral" ? "var(--coral)" : "var(--acc)"} 14%, transparent)`, color: a.tone === "coral" ? "var(--coral)" : "var(--acc)" }}>
            <Icon kind="alert" size={15} />
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-black">{a.title}</div>
            <div className="text-xs font-medium" style={{ color: "var(--mut)" }}>{a.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- tonight -------------------------------- */

const TONIGHT_ICON: Record<string, "moon" | "walk" | "camera"> = {
  Stargazing: "moon", "Evening walk": "walk", "Night photography": "camera",
};

function Tonight({ rec }: { rec: CityRecord }) {
  const t = useMemo(() => tonightStats(rec), [rec]);
  if (!t) return null;
  const info = codeInfo(t.code, false);
  return (
    <Reveal>
      <section className="glass relative overflow-hidden rounded-3xl p-5 sm:p-6">
        <div className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full" style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--lav) 20%, transparent), transparent 70%)" }} />
        <div className="mb-3 flex items-center gap-2">
          <Icon kind="moon" size={15} className="opacity-60" />
          <h2 className="font-display text-lg font-semibold">Tonight</h2>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="font-display text-4xl font-bold tabular-nums" style={{ color: "var(--lav)" }}>{tf(t.temp)}</span>
          <span className="flex items-center gap-2 text-sm font-bold"><span style={{ color: "var(--cy)" }}><Icon kind={info.icon} size={20} /></span>{info.label}</span>
          <span className="text-xs font-bold tabular-nums" style={{ color: "var(--mut)" }}>
            {t.aqi != null ? `AQI ${Math.round(t.aqi)} · ` : ""}rain {Math.round(t.rainP)}%
          </span>
        </div>
        {t.picks.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {t.picks.map((p) => (
              <span key={p.label} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold" style={{ background: "var(--glass2)", color: "var(--ink)" }}>
                <Icon kind={TONIGHT_ICON[p.label] ?? "moon"} size={13} />
                {p.label} · {fmtHour(p.hour.time)}
                <span className="tabular-nums" style={{ color: TONE_VAR[scoreTone(p.score)] }}>{p.score}</span>
              </span>
            ))}
          </div>
        )}
      </section>
    </Reveal>
  );
}

/* ---------------------------- tomorrow vs today --------------------------- */

function TomorrowVsToday({ rec }: { rec: CityRecord }) {
  const d = useMemo(() => tomorrowVsToday(rec), [rec]);
  if (!d) return null;

  const rows: { label: string; icon: "thermo" | "drop" | "uv" | "wind" | "leaf"; delta: number | null; unit: string; invert?: boolean }[] = [
    { label: "Temperature", icon: "thermo", delta: d.dTemp, unit: "°" },
    { label: "Rain chance", icon: "drop", delta: d.dRain, unit: "%", invert: true },
    { label: "UV max", icon: "uv", delta: d.dUv, unit: "" },
    { label: "Wind max", icon: "wind", delta: d.dWind, unit: " km/h" },
    { label: "Air quality", icon: "leaf", delta: d.aqiToday != null && d.aqiTomorrow != null ? d.aqiTomorrow - d.aqiToday : null, unit: " AQI", invert: true },
  ];

  return (
    <Reveal>
      <section className="glass rounded-3xl p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <Icon kind="clock" size={15} className="opacity-60" />
          <h2 className="font-display text-lg font-semibold">Tomorrow vs today</h2>
        </div>
        <div className="flex flex-col gap-1.5">
          {rows.map((r) => {
            if (r.delta == null || Math.abs(r.delta) < 1) {
              return (
                <div key={r.label} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl px-3 py-2" style={{ background: "var(--glass)" }}>
                  <span className="flex items-center gap-2 text-xs font-bold" style={{ color: "var(--mut)" }}><Icon kind={r.icon} size={13} />{r.label}</span>
                  <span className="text-xs font-black" style={{ color: "var(--faint)" }}>≈ same</span>
                </div>
              );
            }
            const up = r.delta > 0;
            const good = r.invert ? !up : up;
            const tone = good ? "var(--mint)" : "var(--coral)";
            const word = r.label === "Temperature" ? (up ? "warmer" : "cooler") : r.label === "Air quality" ? (up ? "heavier air" : "cleaner air") : r.label === "Rain chance" ? (up ? "wetter" : "drier") : up ? "higher" : "lower";
            return (
              <div key={r.label} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl px-3 py-2" style={{ background: "var(--glass)" }}>
                <span className="flex items-center gap-2 text-xs font-bold" style={{ color: "var(--mut)" }}><Icon kind={r.icon} size={13} />{r.label}</span>
                <span className="flex flex-wrap items-center justify-end gap-1.5 text-xs font-black tabular-nums" style={{ color: tone }}>
                  {up ? "↑" : "↓"}{" "}
                  {r.unit === "°" ? td(r.delta).replace("+", "") : <>{Math.abs(Math.round(r.delta))}{r.unit}</>} {word}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </Reveal>
  );
}

/* --------------------------------- share ---------------------------------- */

function ShareButton({ id, rec }: { id: string; rec: CityRecord }) {
  const { catalog } = useAura();
  const city = catalog.find((c) => c.id === id);
  if (!city) return null;
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const text = shareSummary(city, rec);
    const nav = navigator as Navigator & { share?: (d: { title: string; text: string }) => Promise<void> };
    if (nav.share) {
      try { await nav.share({ title: `Aura · ${city.name}`, text }); return; } catch { /* user dismissed */ }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked */ }
  };

  return (
    <button onClick={share} className="chip-btn glass flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black hover:bg-[var(--glass2)]" aria-label={`Share ${city.name} conditions`}>
      <Icon kind={copied ? "check" : "arrow"} size={14} />
      {copied ? "Copied" : "Share"}
    </button>
  );
}

/* --------------------------------- page --------------------------------- */

export default function CityView({ id }: { id: string }) {
  const { records, catalog } = useAura();
  const rec = records[id];
  const city = catalog.find((c) => c.id === id);

  if (!city) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-sm font-bold" style={{ color: "var(--coral)" }}>That city drifted out of the atlas.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 pb-16 sm:px-6">
      <Hero id={id} />
      {rec && (
        <div className="mt-4 flex flex-col gap-4">
          <AlertsStrip rec={rec} />
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            <Next6 rec={rec} />
            <AuraSays id={id} rec={rec} />
          </div>
          <BestWindows rec={rec} />
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            <Tonight rec={rec} />
            <TomorrowVsToday rec={rec} />
          </div>
          <div className="grid min-w-0 gap-4 xl:grid-cols-[1.2fr_1fr]">
            <Week rec={rec} />
            <AirPanel rec={rec} />
          </div>
          {rec.bundle.limited && (
            <p className="flex items-center gap-2 text-[11px] font-medium" style={{ color: "var(--faint)" }}>
              <Icon kind="alert" size={12} /> Served by the fallback provider - hourly intelligence is limited for this city right now.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
