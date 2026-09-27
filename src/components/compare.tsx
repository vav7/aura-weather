import { useMemo } from "react";
import { useAura } from "../store";
import { City, CityRecord, aqiBand, codeInfo, tf } from "../lib/data";
import { calculateWeatherScore, metricsFromCurrent, rankCities, scoreWord, whyFromScore } from "../lib/engine";
import { Icon, Reveal, ScoreDial } from "./ui";

interface Row {
  label: string;
  unit?: string;
  get: (m: ReturnType<typeof metricsFromCurrent>) => number | null;
  fmt: (v: number) => string;
  better: "low" | "high";
}

const ROWS: Row[] = [
  { label: "Outdoor score", get: () => 0, fmt: (v) => `${Math.round(v)}`, better: "high" },
  { label: "Temperature", get: (m) => m.temp, fmt: (v) => tf(v), better: "high" },
  { label: "Feels like", get: (m) => m.feels, fmt: (v) => tf(v), better: "high" },
  { label: "Air quality", unit: "AQI", get: (m) => m.aqi, fmt: (v) => `AQI ${Math.round(v)}`, better: "low" },
  { label: "Rain risk", unit: "%", get: (m) => m.rainP, fmt: (v) => `${Math.round(v)}%`, better: "low" },
  { label: "Wind", unit: "km/h", get: (m) => m.wind, fmt: (v) => `${Math.round(v)}`, better: "low" },
  { label: "Humidity", unit: "%", get: (m) => m.humidity, fmt: (v) => `${Math.round(v)}%`, better: "low" },
  { label: "UV index", get: (m) => m.uv, fmt: (v) => `${Math.round(v)}`, better: "low" },
  { label: "Visibility", unit: "km", get: (m) => m.vis, fmt: (v) => `${Math.round(v)} km`, better: "high" },
];

export default function Compare() {
  const { catalog, records, compare, addCompare, removeCompare, setCompare, openCity, goHome } = useAura();

  const items = useMemo(
    () =>
      compare
        .map((id) => ({ city: catalog.find((c) => c.id === id), rec: records[id] }))
        .filter((x): x is { city: City; rec: CityRecord } => Boolean(x.city && x.rec)),
    [compare, catalog, records],
  );

  const suggestions = useMemo(() => {
    if (items.length >= 4) return [];
    const top = rankCities(catalog, records, "overall", 18);
    return top.filter((t) => !compare.includes(t.city.id)).slice(0, 8);
  }, [catalog, records, compare, items.length]);

  const metrics = useMemo(() => items.map((it) => metricsFromCurrent(it.rec)), [items]);
  const scores = useMemo(() => metrics.map((m) => calculateWeatherScore(m, "overall").total), [metrics]);
  const winnerIdx = scores.length ? scores.indexOf(Math.max(...scores)) : -1;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 pb-16 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={goHome} className="chip-btn glass flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--glass2)]" aria-label="Back to World Pulse">
          <Icon kind="arrow" size={15} className="rotate-180" />
        </button>
        <div>
          <div className="eyebrow">Head to head</div>
          <h1 className="font-display headline-sheen text-2xl font-bold tracking-tight sm:text-3xl">City comparison</h1>
        </div>
        {items.length > 0 && (
          <button onClick={() => setCompare([])} className="chip-btn ml-auto rounded-full px-3 py-1.5 text-xs font-bold hover:bg-[var(--glass2)]" style={{ color: "var(--mut)" }}>
            Clear all
          </button>
        )}
      </div>

      <div className="no-scrollbar fade-r mt-5 flex gap-2 overflow-x-auto pb-1">
        {suggestions.map((s) => (
          <button key={s.city.id} onClick={() => addCompare(s.city.id)} className="chip-btn glass flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold whitespace-nowrap hover:bg-[var(--glass2)]">
            <span className="text-[var(--acc)]">+</span>
            {s.city.name}
            <span style={{ color: "var(--faint)" }}>· {tf(s.rec.bundle.weather.current.temp)}</span>
          </button>
        ))}
        {items.length === 0 && suggestions.length === 0 && (
          <span className="text-xs font-medium" style={{ color: "var(--faint)" }}>Waiting for the live board to fill before I can suggest cities…</span>
        )}
      </div>

      {items.length === 0 ? (
        <Reveal>
          <div className="glass mt-4 rounded-3xl p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "var(--glass2)", color: "var(--faint)" }}>
              <Icon kind="compare" size={22} />
            </div>
            <p className="font-display text-lg font-semibold">Nothing on the scale yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm font-medium" style={{ color: "var(--mut)" }}>
              Tap a chip above - or add cities from any World Pulse row - to weigh up to four places side by side.
            </p>
          </div>
        </Reveal>
      ) : (
        <>
          <div className="no-scrollbar mt-4 overflow-x-auto">
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(150px,1fr))` }}>
            {items.map((it, i) => {
              const c = it.rec.bundle.weather.current;
              const info = codeInfo(c.code, c.isDay);
              return (
                <div key={it.city.id} className="glass anim-fadeUp relative overflow-hidden rounded-3xl p-4 text-center" style={{ animationDelay: `${i * 70}ms` }}>
                  {i === winnerIdx && items.length > 1 && (
                    <span className="absolute top-3 right-3 flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider" style={{ background: "var(--acc)", color: "var(--acc-ink)" }}>
                      <Icon kind="star" size={9} /> Pick
                    </span>
                  )}
                  <button onClick={() => removeCompare(it.city.id)} className="chip-btn absolute top-3 left-3 flex h-6 w-6 items-center justify-center rounded-full hover:bg-[var(--glass2)]" style={{ color: "var(--faint)" }} aria-label={`Remove ${it.city.name}`}>
                    <Icon kind="x" size={12} />
                  </button>
                  <div className="font-display mt-5 truncate text-base font-bold">{it.city.name}</div>
                  <div className="truncate text-[10px] font-medium" style={{ color: "var(--faint)" }}>{it.city.country}</div>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <span style={{ color: "var(--cy)" }}><Icon kind={info.icon} size={26} /></span>
                    <span className="font-display text-3xl font-bold tabular-nums">{tf(c.temp)}</span>
                  </div>
                  <div className="mt-1 text-[11px] font-medium" style={{ color: "var(--mut)" }}>{info.label}</div>
                  <div className="mt-3 flex justify-center">
                    <ScoreDial score={scores[i]} size={70} sub="score" />
                  </div>
                  <button onClick={() => openCity(it.city.id)} className="chip-btn mt-3 w-full rounded-full py-1.5 text-[11px] font-black hover:bg-[var(--glass3)]" style={{ background: "var(--glass2)" }}>
                    Full briefing
                  </button>
                </div>
              );
            })}
          </div>
          </div>

          <Reveal>
            <div className="glass no-scrollbar fade-r mt-4 overflow-x-auto rounded-3xl p-2">
              <table className="w-full min-w-[560px] border-collapse">
                <tbody>
                  {ROWS.map((row) => {
                    const vals = metrics.map((m, i) => (row.label === "Outdoor score" ? scores[i] : row.get(m)));
                    const numeric = vals.filter((v): v is number => v != null);
                    const best = numeric.length === items.length && numeric.length > 1
                      ? (row.better === "low" ? Math.min(...numeric) : Math.max(...numeric))
                      : null;
                    return (
                      <tr key={row.label} className="border-b last:border-b-0" style={{ borderColor: "var(--line)" }}>
                        <td className="w-36 px-4 py-3 text-xs font-black uppercase tracking-wider" style={{ color: "var(--faint)" }}>{row.label}</td>
                        {items.map((it, i) => {
                          const v = vals[i];
                          const isBest = best != null && v === best;
                          return (
                            <td key={it.city.id} className="px-3 py-3 text-center">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold tabular-nums ${isBest ? "" : ""}`}
                                style={
                                  v == null
                                    ? { color: "var(--faint)" }
                                    : isBest
                                      ? { color: "var(--mint)", background: "color-mix(in srgb, var(--mint) 13%, transparent)" }
                                      : { color: "var(--mut)" }
                                }
                              >
                                {isBest && <Icon kind="check" size={12} />}
                                {v == null ? "-" : row.fmt(v)}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Reveal>

          {items.length > 1 && winnerIdx >= 0 && (
            <Reveal>
              <div className="glass mt-4 flex flex-wrap items-center gap-4 rounded-3xl p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: "color-mix(in srgb, var(--acc) 16%, transparent)", color: "var(--acc)" }}>
                  <Icon kind="star" size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-lg font-bold">Aura picks {items[winnerIdx].city.name}</div>
                  <p className="text-xs font-medium" style={{ color: "var(--mut)" }}>
                    {scoreWord(scores[winnerIdx])} at {scores[winnerIdx]}/100 - {whyFromScore(calculateWeatherScore(metrics[winnerIdx], "overall")).strengths.slice(0, 2).join(", ").toLowerCase() || "the most balanced profile of the group"}.
                    {items[winnerIdx].rec.bundle.air && ` Air is ${aqiBand(items[winnerIdx].rec.bundle.air.now.aqi).label.toLowerCase()}.`}
                  </p>
                </div>
                <button onClick={() => openCity(items[winnerIdx].city.id)} className="chip-btn rounded-full bg-[var(--acc)] px-4 py-2 text-xs font-black text-[var(--acc-ink)]">
                  Open {items[winnerIdx].city.name}
                </button>
              </div>
            </Reveal>
          )}
        </>
      )}
    </div>
  );
}
