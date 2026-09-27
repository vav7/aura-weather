import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CITIES, City, CityRecord, LoadStatus, TempUnit, setUnitGlobal } from "./lib/data";
import { ModeId, AskAnswer, answerQuestion, calculateWeatherScore, metricsFromCurrent } from "./lib/engine";
import { FRESH_MS, GeoResult, PulseQueue, loadSnapshot, reverseGeocode, saveSnapshotDebounced } from "./lib/net";

export type View = { name: "home" } | { name: "city"; id: string } | { name: "compare" };

export interface GeoState {
  status: "idle" | "locating" | "ok" | "denied";
  id?: string;
  label?: string;
}

interface AuraState {
  theme: "dark" | "light";
  interests: string[];
  onboarded: boolean;
  view: View;
  mode: ModeId;
  records: Record<string, CityRecord>;
  statuses: Record<string, LoadStatus>;
  geo: GeoState;
  compare: string[];
  ask: { q: string; answer: AskAnswer | null; thinking: boolean };
  extraCities: City[];
  recents: GeoResult[];
  synced: { done: number; total: number };
}

interface AuraApi extends AuraState {
  catalog: City[];
  favorites: string[];
  refreshing: boolean;
  online: boolean;
  prevScores: Record<string, number>;
  unit: TempUnit;
  setUnit: (u: TempUnit) => void;
  setTheme: (t: "dark" | "light") => void;
  toggleTheme: () => void;
  setInterests: (ids: string[], done: boolean) => void;
  openCity: (id: string) => void;
  goHome: () => void;
  openCompare: () => void;
  setMode: (m: ModeId) => void;
  locate: () => void;
  dismissGeo: () => void;
  addFromGeocode: (g: GeoResult) => void;
  addCompare: (id: string) => void;
  removeCompare: (id: string) => void;
  setCompare: (ids: string[]) => void;
  askAura: (q: string) => void;
  clearAsk: () => void;
  retryAll: () => void;
  refreshAll: () => void;
  toggleFavorite: (id: string) => void;
}

const Ctx = createContext<AuraApi | null>(null);

const LS = {
  theme: "aura.theme",
  interests: "aura.interests",
  onboarded: "aura.onboarded",
  compare: "aura.compare",
  recents: "aura.recents",
  extras: "aura.extras",
  favs: "aura.favorites",
  view: "aura.lastView",
  unit: "aura.unit",
};

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeLS(key: string, v: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch { /* ignore */ }
}

export function AuraProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<"dark" | "light">(() =>
    (typeof document !== "undefined" && document.documentElement.dataset.theme === "light" ? "light" : "dark"),
  );
  const [interests, setInterestsState] = useState<string[]>(() => readLS(LS.interests, []));
  const [onboarded, setOnboarded] = useState<boolean>(() => readLS(LS.onboarded, false));
  const [view, setView] = useState<View>({ name: "home" });
  const [mode, setMode] = useState<ModeId>(() => {
    const saved = readLS<string[]>(LS.interests, []);
    const map: Record<string, ModeId> = {
      running: "running", walking: "walking", travel: "travel", air: "air",
      outdoors: "overall", photo: "overall", food: "overall", commute: "overall",
    };
    return saved.length ? map[saved[0]] ?? "overall" : "overall";
  });
  const [records, setRecords] = useState<Record<string, CityRecord>>({});
  const [statuses, setStatuses] = useState<Record<string, LoadStatus>>({});
  const [geo, setGeo] = useState<GeoState>({ status: "idle" });
  const [compare, setCompareState] = useState<string[]>(() => readLS(LS.compare, []));
  const [ask, setAsk] = useState<AuraState["ask"]>({ q: "", answer: null, thinking: false });
  const [extraCities, setExtraCities] = useState<City[]>(() => readLS(LS.extras, []));
  const [recents, setRecents] = useState<GeoResult[]>(() => readLS(LS.recents, []));
  const [synced, setSynced] = useState({ done: 0, total: 0 });
  const [favorites, setFavorites] = useState<string[]>(() => readLS(LS.favs, []));
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [prevScores, setPrevScores] = useState<Record<string, number>>({});
  const [unit, setUnitState] = useState<TempUnit>(() => {
    const u = readLS<TempUnit>(LS.unit, "C");
    setUnitGlobal(u === "F" ? "F" : "C"); // keep the global formatter in sync before first paint
    return u === "F" ? "F" : "C";
  });
  const setUnit = useCallback((u: TempUnit) => {
    setUnitState(u);
    setUnitGlobal(u);
    writeLS(LS.unit, u);
  }, []);

  const queueRef = useRef<PulseQueue | null>(null);
  const refreshPoll = useRef<ReturnType<typeof setInterval> | null>(null);
  const askCtx = useRef<string | undefined>(undefined);
  const bootedRef = useRef(false);
  const recordsRef = useRef(records);
  recordsRef.current = records;
  const catalogRef = useRef<City[]>(CITIES);
  const geoDismissed = useRef(false);

  const catalog = useMemo(() => {
    const ids = new Set(CITIES.map((c) => c.id));
    return [...CITIES, ...extraCities.filter((c) => !ids.has(c.id))];
  }, [extraCities]);
  catalogRef.current = catalog;

  const setTheme = useCallback((t: "dark" | "light") => {
    setThemeState(t);
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem(LS.theme, t); } catch { /* ignore */ }
  }, []);
  const toggleTheme = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [theme, setTheme]);

  /* ------------------------------ boot ------------------------------ */
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    // 1 · hydrate cache immediately - shell + cached cards paint before any network
    const cached = loadSnapshot();
    const cachedIds = Object.keys(cached);
    if (cachedIds.length) {
      const now = Date.now();
      const st: Record<string, LoadStatus> = {};
      for (const id of cachedIds) st[id] = now - cached[id].fetchedAt < FRESH_MS ? "live" : "stale";
      setRecords(cached);
      setStatuses(st);
      setSynced({ done: cachedIds.filter((id) => st[id] === "live").length, total: CITIES.length });

      // last-known state: if the user left on a city with a snapshot, take them back
      const saved = readLS<View>(LS.view, { name: "home" });
      if (saved.name === "city" && cached[saved.id]) setView(saved);

      // remember each cached city's last-visit score → watchlist "vs last time" deltas
      const prev: Record<string, number> = {};
      for (const id of cachedIds) {
        try {
          prev[id] = calculateWeatherScore(metricsFromCurrent(cached[id]), "overall").total;
        } catch { /* malformed cache entry - skip */ }
      }
      setPrevScores(prev);
    }

    // 2 · controlled live-refresh queue (concurrency-limited, per-city isolation)
    const q = new PulseQueue((id, status, rec) => {
      setStatuses((prev) => ({ ...prev, [id]: rec ? "live" : status }));
      if (rec) {
        setRecords((prev) => {
          const next = { ...prev, [id]: rec };
          saveSnapshotDebounced(next);
          return next;
        });
        setSynced((s) => ({ done: s.done + 1, total: Math.max(s.total, CITIES.length) }));
      }
    }, 4, 2);
    queueRef.current = q;

    // priority: fresh-cache misses first, featured next, everything else after
    const now = Date.now();
    const needsRefresh = (id: string) => !cached[id] || now - cached[id].fetchedAt >= FRESH_MS;
    const ordered = [
      ...catalogRef.current.filter((c) => c.featured && needsRefresh(c.id)),
      ...catalogRef.current.filter((c) => !c.featured && needsRefresh(c.id)),
    ];
    q.enqueue(ordered);
    setSynced((s) => ({ ...s, total: catalogRef.current.length, done: Math.min(s.done, catalogRef.current.length) }));
  }, []);

  /* --------------------------- geo: enhancement ----------------------- */
  const locatingRef = useRef(false);
  const locate = useCallback(() => {
    if (locatingRef.current) return; // never fire two permission prompts at once
    if (!("geolocation" in navigator)) {
      setGeo({ status: "denied" });
      return;
    }
    locatingRef.current = true;
    setGeo((g) => ({ ...g, status: "locating" }));
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const label = await reverseGeocode(latitude, longitude);
        const id = `loc_${latitude.toFixed(2)}_${longitude.toFixed(2)}`;
        const city: City = { id, name: label, country: "Near you", region: "YOU", lat: latitude, lon: longitude, tier: 2, tags: [], custom: true };
        setExtraCities((prev) => (prev.some((c) => c.id === id) ? prev : [...prev, city]));
        setGeo({ status: "ok", id, label });
        locatingRef.current = false;
        queueRef.current?.enqueue([city], 10);
      },
      () => {
        locatingRef.current = false;
        setGeo({ status: "denied" });
      },
      { timeout: 7000, maximumAge: 10 * 60 * 1000 },
    );
  }, []);

  const dismissGeo = useCallback(() => {
    geoDismissed.current = true;
    setGeo((g) => (g.status === "ok" ? g : { status: "denied" }));
  }, []);

  /* ------------------------------ actions ----------------------------- */
  const ensureCity = useCallback((id: string) => {
    const city = catalogRef.current.find((c) => c.id === id);
    if (city && !recordsRef.current[id] && queueRef.current) {
      queueRef.current.enqueue([city], 9);
    }
  }, []);

  const openCity = useCallback((id: string) => {
    ensureCity(id);
    setView({ name: "city", id });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [ensureCity]);

  const goHome = useCallback(() => {
    setView({ name: "home" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const openCompare = useCallback(() => {
    setView({ name: "compare" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const setInterests = useCallback((ids: string[], done: boolean) => {
    setInterestsState(ids);
    writeLS(LS.interests, ids);
    if (done) {
      setOnboarded(true);
      writeLS(LS.onboarded, true);
      if (ids.length) {
        const first = ids[0];
        const modeMap: Record<string, ModeId> = {
          outdoors: "overall", running: "running", walking: "walking", travel: "travel",
          air: "air", photo: "overall", food: "overall", commute: "overall",
        };
        setMode(modeMap[first] ?? "overall");
      }
    }
  }, []);

  const addFromGeocode = useCallback((g: GeoResult) => {
    const city: City = { id: g.id, name: g.name, country: g.country, region: g.region || "Search", lat: g.lat, lon: g.lon, tier: 2, tags: ["search"], custom: true };
    setExtraCities((prev) => (prev.some((c) => c.id === g.id) ? prev : [...prev, city]));
    writeLS(LS.extras, [...extraCities.filter((c) => c.id !== g.id), city].slice(-12));
    setRecents((prev) => {
      const next = [g, ...prev.filter((r) => r.id !== g.id)].slice(0, 6);
      writeLS(LS.recents, next);
      return next;
    });
    queueRef.current?.enqueue([city], 10);
    setView({ name: "city", id: g.id });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [extraCities]);

  const addCompare = useCallback((id: string) => {
    setCompareState((prev) => {
      if (prev.includes(id) || prev.length >= 4) return prev;
      const next = [...prev, id];
      writeLS(LS.compare, next);
      return next;
    });
  }, []);
  const removeCompare = useCallback((id: string) => {
    setCompareState((prev) => {
      const next = prev.filter((c) => c !== id);
      writeLS(LS.compare, next);
      return next;
    });
  }, []);
  const setCompare = useCallback((ids: string[]) => {
    setCompareState(ids.slice(0, 4));
    writeLS(LS.compare, ids.slice(0, 4));
  }, []);

  const askAura = useCallback((q: string) => {
    const question = q.trim();
    if (!question) return;
    setAsk({ q: question, answer: null, thinking: true });
    setTimeout(() => {
      const answer = answerQuestion(question, catalogRef.current, recordsRef.current, askCtx.current);
      if (answer.cityId) askCtx.current = answer.cityId; // follow-ups keep the city in scope
      setAsk({ q: question, answer, thinking: false });
    }, 420 + Math.random() * 380);
  }, []);
  const clearAsk = useCallback(() => setAsk({ q: "", answer: null, thinking: false }), []);

  const retryAll = useCallback(() => {
    const failed = Object.entries(statuses).filter(([, s]) => s === "error").map(([id]) => id);
    const cities = catalogRef.current.filter((c) => failed.includes(c.id));
    if (cities.length && queueRef.current) {
      for (const id of failed) setStatuses((p) => ({ ...p, [id]: "queued" }));
      queueRef.current.enqueue(cities, 8);
    }
  }, [statuses]);

  /* --------------------------- global refresh -------------------------- */
  const refreshAll = useCallback(() => {
    if (!queueRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return; // nothing to fetch offline
    setRefreshing(true);
    queueRef.current.enqueue(catalogRef.current, 6);
    if (refreshPoll.current) clearInterval(refreshPoll.current);
    refreshPoll.current = setInterval(() => {
      if (queueRef.current && queueRef.current.pending === 0) {
        if (refreshPoll.current) clearInterval(refreshPoll.current);
        refreshPoll.current = null;
        setRefreshing(false);
      }
    }, 1200);
  }, []);

  /* ------------------------- online / offline -------------------------- */
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // the moment connectivity returns, silently retry whatever failed
  useEffect(() => {
    if (!online) return;
    const failed = Object.entries(statuses).filter(([, s]) => s === "error").map(([id]) => id);
    if (failed.length && queueRef.current) {
      const cities = catalogRef.current.filter((c) => failed.includes(c.id));
      for (const id of failed) setStatuses((p) => ({ ...p, [id]: "queued" }));
      queueRef.current.enqueue(cities, 7);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  /* ----------------------------- favorites ----------------------------- */
  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 12);
      writeLS(LS.favs, next);
      return next;
    });
  }, []);

  // persist theme on first load
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // persist last view for the next visit
  useEffect(() => {
    writeLS(LS.view, view);
  }, [view]);

  const api: AuraApi = {
    theme, interests, onboarded, view, mode, records, statuses, geo, compare, ask,
    extraCities, recents, synced, catalog, favorites, refreshing, online, prevScores, unit,
    setTheme, toggleTheme, setUnit, setInterests, openCity, goHome, openCompare, setMode,
    locate, dismissGeo, addFromGeocode, addCompare, removeCompare, setCompare,
    askAura, clearAsk, retryAll, refreshAll, toggleFavorite,
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAura(): AuraApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAura outside provider");
  return v;
}
