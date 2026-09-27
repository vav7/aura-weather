import { Component, lazy, ReactNode, Suspense } from "react";
import { AuraProvider, useAura } from "./store";
import Ambient from "./components/ambient";
import Header from "./components/header";
import WorldPulse from "./components/pulse";
import { Icon, LogoMark } from "./components/ui";

// non-critical routes load on demand - the shell + World Pulse ship first
const CityView = lazy(() => import("./components/cityview"));
const Compare = lazy(() => import("./components/compare"));

function ViewFallback() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6" aria-busy="true" aria-label="Loading view">
      <div className="skel h-44 rounded-3xl" />
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="skel h-32 rounded-3xl" />
        <div className="skel h-32 rounded-3xl" />
        <div className="skel h-32 rounded-3xl" />
      </div>
    </div>
  );
}

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <p className="font-display text-xl font-bold">Aura hit a turbulence pocket.</p>
          <p className="mt-2 text-sm" style={{ color: "var(--mut)" }}>A render error slipped through - your data is safe in the cache.</p>
          <button onClick={() => { this.setState({ failed: false }); window.location.hash = ""; }} className="chip-btn mt-5 rounded-full bg-[var(--acc)] px-5 py-2 text-sm font-black text-[var(--acc-ink)]">
            Recover
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Views() {
  const { view } = useAura();
  if (view.name === "city") {
    return (
      <Suspense fallback={<ViewFallback />}>
        <CityView key={view.id} id={view.id} />
      </Suspense>
    );
  }
  if (view.name === "compare") {
    return (
      <Suspense fallback={<ViewFallback />}>
        <Compare />
      </Suspense>
    );
  }
  return <WorldPulse />;
}

function Footer() {
  const { synced } = useAura();
  return (
    <footer className="border-t" style={{ borderColor: "var(--line)" }}>
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-2.5">
          <LogoMark size={22} />
          <div>
            <div className="font-display text-sm font-bold leading-none">AURA</div>
            <div className="mt-0.5 text-[10px] font-medium" style={{ color: "var(--faint)" }}>Weather, made useful.</div>
          </div>
        </div>
        <p className="max-w-md text-[11px] leading-relaxed font-medium" style={{ color: "var(--faint)" }}>
          Live data: Open-Meteo forecast &amp; air-quality feeds, with provider fallback and an offline-tolerant cache.
          Scores are transparent blends - open any row to see the math.
          {synced.total > 0 && ` Currently tracking ${synced.total} cities.`}
        </p>
        <div className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: "var(--mint)" }}>
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-[var(--mint)]" />
          systems nominal
        </div>
      </div>
    </footer>
  );
}

function Shell() {
  return (
    <div className="flex min-h-screen flex-col">
      <Ambient />
      <Header />
      <main className="flex-1">
        <Boundary>
          <Views />
        </Boundary>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <AuraProvider>
      <Shell />
    </AuraProvider>
  );
}

export { Icon };
