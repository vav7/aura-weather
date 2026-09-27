import { useMemo } from "react";
import { useAura } from "../store";
import { calculateWeatherScore, metricsFromCurrent } from "../lib/engine";

/** Deterministic pseudo-random starfield so re-renders stay stable. */
function seededStars(n: number): { x: number; y: number; s: number; d: number; o: number }[] {
  let seed = 42;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: n }, () => ({
    x: rnd() * 100, y: rnd() * 70, s: 1 + rnd() * 1.8, d: 2 + rnd() * 5, o: 0.2 + rnd() * 0.7,
  }));
}

/* ---------------------- weather-aware atmospheres ---------------------- */

type Mood = "clear" | "night" | "rain" | "storm" | "snow" | "muted";

const TINTS: Record<Mood, string> = {
  clear: "radial-gradient(90% 70% at 75% 8%, rgba(255,164,74,0.20), transparent 60%)",
  night: "radial-gradient(110% 80% at 50% -10%, rgba(90,110,220,0.16), transparent 62%)",
  rain: "radial-gradient(95% 75% at 70% 8%, rgba(70,130,210,0.20), transparent 62%)",
  storm: "radial-gradient(100% 80% at 65% 5%, rgba(150,110,255,0.18), transparent 58%), radial-gradient(80% 60% at 20% 90%, rgba(60,90,200,0.14), transparent 60%)",
  snow: "radial-gradient(95% 75% at 70% 8%, rgba(205,225,248,0.18), transparent 60%)",
  muted: "radial-gradient(95% 75% at 70% 10%, rgba(150,168,196,0.17), transparent 62%)",
};

const WASH: Record<"dark" | "light", Record<Mood, string>> = {
  dark: {
    clear: "linear-gradient(180deg, #04070e 0%, #08101c 46%, #0b1626 78%, #0e1a2b 100%)",
    night: "linear-gradient(180deg, #01030a 0%, #050a17 48%, #081020 80%, #0a1428 100%)",
    rain: "linear-gradient(180deg, #03070c 0%, #06101b 46%, #091726 78%, #0b1a2a 100%)",
    storm: "linear-gradient(180deg, #040611 0%, #080d1f 46%, #0d112b 78%, #101330 100%)",
    snow: "linear-gradient(180deg, #060a13 0%, #0b1320 46%, #0f1c33 78%, #132238 100%)",
    muted: "linear-gradient(180deg, #04060c 0%, #080e18 46%, #0c1420 78%, #0e1725 100%)",
  },
  light: {
    clear: "linear-gradient(180deg, #cfe4f5 0%, #e4f0f9 42%, #f3eddf 78%, #f7e8d8 100%)",
    night: "linear-gradient(180deg, #b9cfe6 0%, #d3e2f2 42%, #e2e7f0 78%, #e8e6ee 100%)",
    rain: "linear-gradient(180deg, #c2d5e6 0%, #d8e5f0 42%, #e3eaf1 78%, #e9edf2 100%)",
    storm: "linear-gradient(180deg, #bcc8de 0%, #d0daea 42%, #dddfeb 78%, #e4e2ee 100%)",
    snow: "linear-gradient(180deg, #d5e4f2 0%, #e6eef6 42%, #eef2f6 78%, #f2f4f7 100%)",
    muted: "linear-gradient(180deg, #c9d8e6 0%, #dde8f1 42%, #e8ecf1 78%, #edeff2 100%)",
  },
};

function moodOf(code: number, isDay: boolean): Mood {
  if (!isDay) return "night";
  if (code >= 95) return "storm";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82) || (code >= 51 && code <= 57)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code === 45 || code === 48 || code === 3) return "muted";
  return "clear";
}

export default function Ambient() {
  const { view, records, theme, geo, catalog } = useAura();
  const stars = useMemo(() => seededStars(72), []);

  /* context city: open city → your location → current board leader */
  const mood = useMemo<Mood>(() => {
    let id: string | undefined;
    if (view.name === "city") id = view.id;
    else if (geo.status === "ok" && geo.id && records[geo.id]) id = geo.id;
    if (!id) {
      let best: string | undefined;
      let bestScore = -1;
      for (const c of catalog) {
        const rec = records[c.id];
        if (!rec) continue;
        const s = calculateWeatherScore(metricsFromCurrent(rec), "overall").total;
        if (s > bestScore) { bestScore = s; best = c.id; }
      }
      id = best;
    }
    if (!id || !records[id]) return theme === "dark" ? "night" : "clear";
    const cur = records[id].bundle.weather.current;
    return moodOf(cur.code, cur.isDay);
  }, [view, records, geo, catalog, theme]);

  const isNightMood = mood === "night";
  const starBoost = isNightMood ? 1.5 : mood === "storm" ? 0.4 : mood === "rain" ? 0.55 : 1;

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {/* base wash - evolves with the dominant weather mood */}
      <div className="sky-tint absolute inset-0" style={{ background: WASH[theme][mood] }} />
      {/* drifting glows */}
      <div
        className="sky-tint absolute -top-[20%] -right-[12%] h-[70vh] w-[60vw] rounded-full opacity-90"
        style={{
          background: "radial-gradient(closest-side, var(--glowA), transparent 70%)",
          animation: "driftA 26s ease-in-out infinite alternate",
          opacity: mood === "storm" || isNightMood ? 0.55 : 0.9,
        }}
      />
      <div
        className="sky-tint absolute -bottom-[25%] -left-[15%] h-[75vh] w-[65vw] rounded-full opacity-90"
        style={{
          background: "radial-gradient(closest-side, var(--glowB), transparent 70%)",
          animation: "driftB 34s ease-in-out infinite alternate",
          opacity: isNightMood ? 0.5 : 0.9,
        }}
      />
      {/* stars - brighter on clear nights */}
      {theme === "dark" &&
        stars.map((s, i) => (
          <span
            key={i}
            className="sky-tint absolute rounded-full bg-white"
            style={{
              left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s,
              opacity: Math.min(1, s.o * starBoost),
              animation: `twinkle ${s.d}s ease-in-out ${i * 0.13}s infinite`,
            }}
          />
        ))}
      {/* slow cloud streaks - denser in rain & storm */}
      <div
        className="sky-tint absolute top-[16%] h-[90px] w-[46vw] rounded-full"
        style={{ background: "var(--ink)", filter: "blur(46px)", animation: "cloudMove 120s linear infinite", opacity: mood === "rain" || mood === "storm" ? 0.09 : 0.05 }}
      />
      <div
        className="sky-tint absolute top-[42%] h-[70px] w-[38vw] rounded-full"
        style={{ background: "var(--ink)", filter: "blur(40px)", animation: "cloudMove 160s linear -60s infinite", opacity: mood === "rain" || mood === "storm" ? 0.07 : 0.04 }}
      />
      {/* weather-reactive tint */}
      <div className="sky-tint absolute inset-0" style={{ background: TINTS[mood] }} />
      {/* night contrast vignette */}
      {isNightMood && <div className="sky-tint absolute inset-0" style={{ background: "radial-gradient(120% 90% at 50% 20%, transparent 55%, rgba(0,0,8,0.35) 100%)" }} />}
      {/* grain */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
