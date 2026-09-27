import { useEffect, useMemo, useRef, useState } from "react";
import { useAura } from "../store";
import { GeoResult, geocode } from "../lib/net";
import { Icon, LogoMark } from "./ui";
import { REGION_LABELS } from "../lib/data";
import { agoLabel } from "../lib/engine";

function SearchBox() {
  const { addFromGeocode, recents, catalog } = useAura();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GeoResult[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (q.trim().length < 2) {
      setResults(null);
      setErr(false);
      return;
    }
    setBusy(true);
    debounce.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const r = await geocode(q.trim(), ctrl.signal);
        setResults(r);
        setErr(false);
      } catch {
        if (!ctrl.signal.aborted) setErr(true); // superseded requests are not errors
      } finally {
        setBusy(false);
      }
    }, 320);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [q]);

  const pick = (g: GeoResult) => {
    addFromGeocode(g);
    setQ("");
    setResults(null);
    setOpen(false);
  };

  const pickCatalog = (id: string) => {
    const c = catalog.find((x) => x.id === id);
    if (c) pick({ id: c.id, name: c.name, country: c.country, region: c.region, lat: c.lat, lon: c.lon });
  };

  const showRecent = open && q.trim().length < 2;

  return (
    <div ref={boxRef} className="relative w-full min-w-0 max-w-xl">
      <div className="glass flex items-center gap-2 rounded-full px-4 py-2 transition-shadow focus-within:shadow-[0_0_0_2px_color-mix(in_srgb,var(--acc)_55%,transparent)]">
        {busy ? (
          <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--faint)] border-t-[var(--acc)]" />
        ) : (
          <Icon kind="search" size={16} className="shrink-0" />
        )}
        <input
          id="aura-global-search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (results?.length) pick(results[0]);
              else if (showRecent && recents.length) pick(recents[0]);
            }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search any city on Earth…"
          className="w-full min-w-0 bg-transparent text-sm font-medium outline-none placeholder:text-[var(--faint)]"
          aria-label="Search city"
        />
        {q && (
          <button onClick={() => { setQ(""); setResults(null); }} className="chip-btn rounded-full p-1 hover:bg-[var(--glass2)]" aria-label="Clear search">
            <Icon kind="x" size={13} />
          </button>
        )}
      </div>

      {open && (results || showRecent || err) && (
        <div className="search-dropdown anim-fadeUp absolute inset-x-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl shadow-2xl">
          {err && <div className="px-4 py-3 text-xs font-medium" style={{ color: "var(--coral)" }}>Search is unreachable right now - try again in a moment.</div>}
          {results && results.length === 0 && !err && (
            <div className="px-4 py-3 text-xs font-medium" style={{ color: "var(--mut)" }}>No matches for “{q}”. Try a bigger nearby city.</div>
          )}
          {results?.map((r) => (
            <button key={r.id} onClick={() => pick(r)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--glass2)]">
              <Icon kind="pin" size={15} className="shrink-0" />
              <span className="text-sm font-bold">{r.name}</span>
              <span className="truncate text-xs" style={{ color: "var(--mut)" }}>{[r.region, r.country].filter(Boolean).join(", ")}</span>
            </button>
          ))}
          {showRecent && (
            <>
              {recents.length > 0 && (
                <>
                  <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--faint)" }}>Recent</div>
                  {recents.map((r) => (
                    <button key={r.id} onClick={() => pick(r)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--glass2)]">
                      <Icon kind="clock" size={15} className="shrink-0" />
                      <span className="text-sm font-bold">{r.name}</span>
                      <span className="truncate text-xs" style={{ color: "var(--mut)" }}>{r.country}</span>
                    </button>
                  ))}
                </>
              )}
              <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--faint)" }}>Trending in Aura</div>
              {["lis", "tyo", "cpt", "syd", "sin", "rio"].map((id) => {
                const c = catalog.find((x) => x.id === id);
                if (!c) return null;
                return (
                  <button key={id} onClick={() => pickCatalog(id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--glass2)]">
                    <Icon kind="spark" size={15} className="shrink-0" />
                    <span className="text-sm font-bold">{c.name}</span>
                    <span className="truncate text-xs" style={{ color: "var(--mut)" }}>{c.country} · {REGION_LABELS[c.region] ?? c.region}</span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const { geo, locate, compare, openCompare, goHome, view, theme, toggleTheme, records, refreshAll, refreshing, online, unit, setUnit } = useAura();
  const latest = useMemo(() => {
    let t = 0;
    for (const r of Object.values(records)) t = Math.max(t, r.fetchedAt);
    return t;
  }, [records]);

  return (
    <header className="sticky top-0 z-40">
      <div className="glass border-x-0 border-t-0">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
          <button onClick={goHome} className="group flex shrink-0 items-center gap-2.5" aria-label="Aura home">
            <LogoMark size={30} />
            <span className="hidden flex-col items-start leading-none sm:flex">
              <span className="font-display text-lg font-bold tracking-wide">AURA</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.24em]" style={{ color: "var(--faint)" }}>Weather intelligence</span>
            </span>
          </button>

          <div className="order-last flex w-full min-w-0 justify-center px-0.5 sm:order-none sm:w-auto sm:flex-1 sm:px-1">
            <SearchBox />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:ml-0">
            <button
              onClick={locate}
              className="chip-btn glass flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold hover:bg-[var(--glass2)]"
              title="Use my location"
            >
              {geo.status === "locating" ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--faint)] border-t-[var(--acc)]" />
              ) : (
                <Icon kind="locate" size={15} className={geo.status === "ok" ? "text-[var(--mint)]" : ""} />
              )}
              <span className="hidden md:inline">{geo.status === "ok" ? "Located" : "Locate"}</span>
            </button>

            <button
              onClick={openCompare}
              className={`chip-btn glass relative flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold hover:bg-[var(--glass2)] ${view.name === "compare" ? "!bg-[var(--glass3)]" : ""}`}
              title="Compare cities"
            >
              <Icon kind="compare" size={15} />
              <span className="hidden md:inline">Compare</span>
              {compare.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--acc)] px-1 text-[9px] font-black text-[var(--acc-ink)]">
                  {compare.length}
                </span>
              )}
            </button>

            <button
              onClick={refreshAll}
              disabled={!online || refreshing}
              className="chip-btn glass flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold hover:bg-[var(--glass2)] disabled:opacity-50"
              title={!online ? "You're offline - showing cached data" : "Refresh all live data"}
              aria-label="Refresh world pulse"
            >
              <Icon kind="refresh" size={14} className={refreshing ? "animate-spin" : ""} />
              <span className="hidden lg:inline">
                {refreshing ? "Refreshing…" : latest ? `Updated ${agoLabel(latest)}` : "Refresh"}
              </span>
            </button>

            <div className="glass flex h-9 items-center rounded-full p-0.5" role="group" aria-label="Temperature unit">
              {(["C", "F"] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => setUnit(u)}
                  aria-pressed={unit === u}
                  aria-label={u === "C" ? "Use Celsius" : "Use Fahrenheit"}
                  className="chip-btn h-full rounded-full px-2 text-xs font-black"
                  style={unit === u ? { background: "var(--acc)", color: "var(--acc-ink)" } : { color: "var(--faint)" }}
                >
                  °{u}
                </button>
              ))}
            </div>

            <button
              onClick={toggleTheme}
              className="chip-btn glass flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--glass2)]"
              title={theme === "dark" ? "Switch to light" : "Switch to dark"}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              <Icon kind={theme === "dark" ? "sun" : "moon"} size={15} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
