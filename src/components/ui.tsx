import React, { useEffect, useRef, useState } from "react";
import { IconKind, TONE_VAR, scoreTone } from "../lib/data";

/* ------------------------------- icons -------------------------------- */

export function Icon({ kind, size = 18, className = "", strokeWidth = 1.7 }: { kind: IconKind; size?: number; className?: string; strokeWidth?: number }) {
  const p = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
    className,
  };
  switch (kind) {
    case "sun":
      return (<svg {...p}><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5 5l1.6 1.6M17.4 17.4 19 19M19 5l-1.6 1.6M6.6 17.4 5 19" /></svg>);
    case "moon":
      return (<svg {...p}><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" /></svg>);
    case "part-day":
      return (<svg {...p}><circle cx="9" cy="9" r="3.2" /><path d="M9 2.8v1.6M2.8 9h1.6M4.6 4.6l1.1 1.1M13.4 4.6l-1.1 1.1" /><path d="M8 18.5h9a3.2 3.2 0 0 0 .6-6.3A5 5 0 0 0 8 13.4a3.4 3.4 0 0 0 0 5.1Z" /></svg>);
    case "part-night":
      return (<svg {...p}><path d="M14.5 8.7A4.5 4.5 0 0 1 9.2 3.4a5.3 5.3 0 1 0 6.6 6.6" /><path d="M7.5 20.5h9.3a3 3 0 0 0 .5-5.9 4.7 4.7 0 0 0-9-1.1 3.2 3.2 0 0 0-.8 7Z" /></svg>);
    case "cloud":
      return (<svg {...p}><path d="M6.5 18.5h10a3.8 3.8 0 0 0 .7-7.5A5.8 5.8 0 0 0 6 12.3a3.6 3.6 0 0 0 .5 6.2Z" /></svg>);
    case "fog":
      return (<svg {...p}><path d="M6.5 14.5h10a3.8 3.8 0 0 0 .7-7.5A5.8 5.8 0 0 0 6 8.3a3.6 3.6 0 0 0 .5 6.2Z" /><path d="M5 18h14M7 21h10" /></svg>);
    case "drizzle":
      return (<svg {...p}><path d="M6.5 14.5h10a3.8 3.8 0 0 0 .7-7.5A5.8 5.8 0 0 0 6 8.3a3.6 3.6 0 0 0 .5 6.2Z" /><path d="M8.5 17.5v.01M12 19.5v.01M15.5 17.5v.01M8.5 21v.01M15.5 21v.01" strokeWidth={2.4} /></svg>);
    case "rain":
      return (<svg {...p}><path d="M6.5 14h10a3.8 3.8 0 0 0 .7-7.5A5.8 5.8 0 0 0 6 7.8a3.6 3.6 0 0 0 .5 6.2Z" /><path d="M8.5 17l-1 3.5M12.5 17l-1 3.5M16.5 17l-1 3.5" /></svg>);
    case "snow":
      return (<svg {...p}><path d="M6.5 14h10a3.8 3.8 0 0 0 .7-7.5A5.8 5.8 0 0 0 6 7.8a3.6 3.6 0 0 0 .5 6.2Z" /><path d="M8.5 17.5v.01M12 18.5v.01M15.5 17.5v.01M10 21v.01M14 21v.01" strokeWidth={2.4} /></svg>);
    case "thunder":
      return (<svg {...p}><path d="M6.5 13.5h10a3.8 3.8 0 0 0 .7-7.5A5.8 5.8 0 0 0 6 7.3a3.6 3.6 0 0 0 .5 6.2Z" /><path d="M12.5 13 10 17.5h3L10.8 22" /></svg>);
    case "wind":
      return (<svg {...p}><path d="M3 8.5h10.5a2.5 2.5 0 1 0-2.3-3.5M3 12.5h15a2.6 2.6 0 1 1-2.4 3.6M3 16.5h7.5a2.2 2.2 0 1 1-2 3.2" /></svg>);
    case "drop":
      return (<svg {...p}><path d="M12 3.5s5.5 6 5.5 10a5.5 5.5 0 0 1-11 0c0-4 5.5-10 5.5-10Z" /></svg>);
    case "eye":
      return (<svg {...p}><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></svg>);
    case "gauge":
      return (<svg {...p}><path d="M4.5 17.5a8.5 8.5 0 1 1 15 0" /><path d="M12 13.5 15.5 9" /><circle cx="12" cy="14" r="1.4" /></svg>);
    case "leaf":
      return (<svg {...p}><path d="M5 19C5 9 12 4.5 19.5 4.5 19.5 14 13 19.5 5 19Z" /><path d="M5 19c3-4.5 6.5-8 10.5-10.5" /></svg>);
    case "camera":
      return (<svg {...p}><path d="M4 8.5h3l1.6-2.3h6.8L17 8.5h3a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13.5" r="3.4" /></svg>);
    case "run":
      return (<svg {...p}><circle cx="14.5" cy="4.5" r="1.8" /><path d="M6 20.5l3.5-4.5-2-4 4-2.5 2.5 3 3.5 1M11.5 16l-1 4.5M9.5 9.5 6.5 11l-1.5 3" /></svg>);
    case "walk":
      return (<svg {...p}><circle cx="13" cy="4.5" r="1.8" /><path d="M13 7.5l-2 5 2.5 3v5M11 12.5 8.5 14l-1 3.5M13.5 15.5l2 2 1 4M13 8.5l3 1.5 2 2.5" /></svg>);
    case "bike":
      return (<svg {...p}><circle cx="6" cy="16.5" r="3.2" /><circle cx="18" cy="16.5" r="3.2" /><path d="M6 16.5 9.5 9h5.5M12 16.5 9.5 9M12.5 6.5H15l3 10M12 16.5h6" /></svg>);
    case "plane":
      return (<svg {...p}><path d="M10.5 13.5 3 11l1.5-1.5 6.5.5 4.5-4.5a1.6 1.6 0 0 1 2.3 2.3L13.3 12l.5 6.5L12.3 20l-2.5-7.5" /></svg>);
    case "food":
      return (<svg {...p}><path d="M7 3v6.5M4.5 3v4a2.5 2.5 0 0 0 5 0V3M7 9.5V21M16.5 3c-2 1.5-2.5 4.5-2.5 7h2.5v11M16.5 3v7" /></svg>);
    case "commute":
      return (<svg {...p}><rect x="5" y="4" width="14" height="13" rx="2.5" /><path d="M5 10h14M9 21l1-4M15 21l-1-4M8.5 14h.01M15.5 14h.01" strokeWidth={2} /></svg>);
    case "star":
      return (<svg {...p}><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.9L12 3.5Z" /></svg>);
    case "pin":
      return (<svg {...p}><path d="M12 21s-6.5-5.6-6.5-10.4A6.5 6.5 0 0 1 12 4a6.5 6.5 0 0 1 6.5 6.6C18.5 15.4 12 21 12 21Z" /><circle cx="12" cy="10.5" r="2.3" /></svg>);
    case "search":
      return (<svg {...p}><circle cx="10.5" cy="10.5" r="6" /><path d="m15.5 15.5 5 5" /></svg>);
    case "locate":
      return (<svg {...p}><circle cx="12" cy="12" r="6.5" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" /></svg>);
    case "compare":
      return (<svg {...p}><path d="M8 4v16M16 4v16M4 8l4-4 4 4M12 16l4 4 4-4" /></svg>);
    case "spark":
      return (<svg {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" /><circle cx="12" cy="12" r="2.4" /></svg>);
    case "arrow":
      return (<svg {...p}><path d="M4 12h15M13 6l6 6-6 6" /></svg>);
    case "check":
      return (<svg {...p}><path d="m4.5 12.5 5 5L19.5 7" /></svg>);
    case "alert":
      return (<svg {...p}><path d="M12 4 2.8 19.5h18.4L12 4Z" /><path d="M12 10v4M12 16.8v.01" strokeWidth={2.2} /></svg>);
    case "x":
      return (<svg {...p}><path d="m6 6 12 12M18 6 6 18" /></svg>);
    case "clock":
      return (<svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></svg>);
    case "compass":
      return (<svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></svg>);
    case "layers":
      return (<svg {...p}><path d="m12 3.5 8.5 4.5L12 12.5 3.5 8 12 3.5Z" /><path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5" /></svg>);
    case "refresh":
      return (<svg {...p}><path d="M4.5 12a7.5 7.5 0 0 1 13-5.2L20 9M20 4.5V9h-4.5M19.5 12a7.5 7.5 0 0 1-13 5.2L4 15M4 19.5V15h4.5" /></svg>);
    case "thermo":
      return (<svg {...p}><path d="M10 4a2 2 0 1 1 4 0v9.3a4.5 4.5 0 1 1-4 0V4Z" /><path d="M12 9v6" /></svg>);
    case "uv":
      return (<svg {...p}><circle cx="12" cy="12" r="3.6" /><path d="M12 3v1.8M12 19.2V21M3 12h1.8M19.2 12H21M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /></svg>);
    default:
      return null;
  }
}

export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="13" stroke="var(--acc)" strokeWidth="2.4" className="spin-slow" strokeDasharray="60 22" style={{ transformOrigin: "16px 16px" }} />
      <circle cx="16" cy="16" r="7.6" stroke="var(--cy)" strokeWidth="1.8" opacity="0.85" strokeDasharray="34 14" className="spin-slow" style={{ transformOrigin: "16px 16px", animationDirection: "reverse", animationDuration: "18s" }} />
      <circle cx="16" cy="16" r="2.6" fill="var(--acc)" />
    </svg>
  );
}

/* ----------------------------- score dial ------------------------------ */

export function ScoreDial({ score, size = 64, label, sub }: { score: number; size?: number; label?: string; sub?: string }) {
  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDrawn(score), 60);
    return () => clearTimeout(t);
  }, [score]);
  const r = 26;
  const circ = 2 * Math.PI * r;
  const tone = TONE_VAR[scoreTone(score)];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={`${score}/100`}>
      <svg viewBox="0 0 64 64" width={size} height={size} className="-rotate-90">
        <circle cx="32" cy="32" r={r} stroke="var(--line)" strokeWidth="5" fill="none" />
        <circle
          cx="32" cy="32" r={r} stroke={tone} strokeWidth="5" fill="none" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - drawn / 100)} className="ring-anim"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-display font-semibold" style={{ fontSize: size * 0.3, color: tone }}>{Math.round(score)}</span>
        {sub && <span className="text-[9px] font-medium uppercase tracking-wider" style={{ color: "var(--faint)", marginTop: 2 }}>{sub}</span>}
      </div>
      {label && <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] uppercase tracking-widest" style={{ color: "var(--faint)" }}>{label}</div>}
    </div>
  );
}

/* ------------------------------- sparkline ----------------------------- */

export function Sparkline({ values, width = 220, height = 48, stroke = "var(--cy)", fill = true }: { values: number[]; width?: number; height?: number; stroke?: string; fill?: boolean }) {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1 || 1)) * (width - 4) + 2,
    height - 4 - ((v - min) / span) * (height - 10),
  ]);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden>
      {fill && <path d={`${path} L${width - 2},${height} L2,${height} Z`} fill={stroke} opacity="0.12" />}
      <path d={path} stroke={stroke} strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill={stroke} />
    </svg>
  );
}

/* -------------------------------- reveal -------------------------------- */

export function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }),
      { threshold: 0.08 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${inView ? "in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* ------------------------------ small bits ------------------------------ */

export function Stars({ n, size = 12 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex gap-[2px]" aria-label={`${n} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= n ? "var(--acc)" : "none"} stroke={i <= n ? "var(--acc)" : "var(--faint)"} strokeWidth="1.8">
          <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.9L12 3.5Z" />
        </svg>
      ))}
    </span>
  );
}

export function ToneChip({ tone, children }: { tone: "mint" | "acc" | "coral" | "lav" | "cy"; children: React.ReactNode }) {
  const color = TONE_VAR[tone] ?? TONE_VAR.cy;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-bold whitespace-nowrap"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)` }}
    >
      {children}
    </span>
  );
}

export function PartBar({ label, display, score, delay = 0 }: { label: string; display: string; score: number; delay?: number }) {
  const tone = TONE_VAR[scoreTone(score)];
  return (
    <div className="grid grid-cols-[92px_1fr_74px] items-center gap-2 text-[11px] sm:grid-cols-[110px_1fr_84px]">
      <span className="truncate font-medium" style={{ color: "var(--mut)" }}>{label}</span>
      <div className="h-[6px] overflow-hidden rounded-full" style={{ background: "var(--glass2)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: tone, transitionDelay: `${delay}ms` }}
        />
      </div>
      <span className="truncate text-right font-bold tabular-nums" style={{ color: "var(--ink)" }}>{display}</span>
    </div>
  );
}

export function TempBar({ tmin, tmax, weekMin, weekMax }: { tmin: number; tmax: number; weekMin: number; weekMax: number }) {
  const span = weekMax - weekMin || 1;
  const left = ((tmin - weekMin) / span) * 100;
  const width = Math.max(6, ((tmax - tmin) / span) * 100);
  return (
    <div className="relative h-[6px] w-full rounded-full" style={{ background: "var(--glass2)" }}>
      <div
        className="absolute h-full rounded-full"
        style={{ left: `${left}%`, width: `${width}%`, background: "linear-gradient(90deg, var(--cy), var(--acc))" }}
      />
    </div>
  );
}
