# Aura — Weather, Made Useful 
[![CI](https://github.com/vav7/aura-weather/actions/workflows/ci.yml/badge.svg)](https://github.com/vav7/aura-weather/actions/workflows/ci.yml)
**Live link - https://aura-weather-intelligence.vercel.app/**

Aura is a premium, decision-focused weather web app built with React, TypeScript, and Vite. Instead of only showing forecast numbers, Aura turns weather and air-quality data into practical answers such as **where conditions are best, when to go outside, and what activity makes sense right now**.

## ✨ What Aura does

- **World Pulse** — browse weather conditions across a global catalog of 99 cities.
- **Live weather** — current conditions, hourly forecasts, and multi-day forecast data.
- **Air quality** — current AQI data when available, surfaced alongside weather conditions.
- **Weather intelligence** — scores and rankings turn raw weather data into useful decisions.
- **Interactive Atlas board** - MapLibre globe with animated RainViewer precipitation radar, switchable score / clean-air / warmth heat layers, glowing top-10 markers and hover verdicts. The map chunk is viewport-gated (never downloaded until you scroll near it) and degrades to the classic SVG board offline or with `?atlas=legacy`.
- **Activity-aware rankings** — explore the best places for overall weather, clean air, running, walking, travel, warmth, cool weather, low rain, high rain, and weekend escapes.
- **Ask Aura** — a rule-based weather assistant that answers natural-language questions and can route users to city views, rankings, or comparisons.
- **City details** — open a city for deeper weather, air-quality, activity-window, tonight, and tomorrow-vs-today insights.
- **Compare cities** — compare up to four cities side by side.
- **My Cities** — save favorite cities locally for quick access.
- **Location support** — use browser geolocation to personalize the experience without making location permission a hard requirement.
- **Dark/light UI** — premium glass-style interface with responsive layouts and reduced-motion support.
- **Resilient data loading** — progressive city loading, request timeouts/retries, fallback-provider support, and timestamped local caching.
- **Offline-friendly shell** — a service worker keeps the app shell available for returning visits while weather API calls remain live.

## 🧱 Tech stack

- **React 18**
- **TypeScript**
- **Vite 6**
- **Tailwind CSS 4 / `@tailwindcss/vite`**
- **Framer Motion** for UI animation
- **Lucide React** for icons
- **Recharts** for data visualizations
- **Open-Meteo** for weather, air quality, and geocoding
- **Optional WeatherAPI fallback**
- **Browser localStorage** for preferences, favorites, comparisons, and cached snapshots
- **Service Worker** for offline shell/static-asset caching

## 📁 Project structure

```text
.
├── public/
│   └── sw.js                 # Offline shell / asset caching
├── src/
│   ├── components/           # Header, World Pulse, city view, compare, UI, etc.
│   ├── lib/
│   │   ├── data.ts           # City catalog and shared data types
│   │   ├── engine.ts          # Scoring, ranking, recommendations, Ask Aura
│   │   └── net.ts             # Weather/AQ API calls, fallback, caching, networking
│   ├── App.tsx                # App shell and view routing
│   ├── store.tsx              # Global Aura state and persistence
│   ├── main.tsx               # Application entry point + service worker registration
│   └── index.css              # Global visual system and styles
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
└── vite.config.js
```

## 🚀 Run locally

### 1. Install dependencies

```bash
npm install
```

### 2. Start the development server

```bash
npm run dev
```

Vite will print the local URL in the terminal (normally `http://localhost:3000`).

### 3. Create a production build

```bash
npm run build
```

### 4. Type-check the project

```bash
npm run typecheck
```

## 🌦️ Data sources

Aura primarily uses **Open-Meteo** for:

- forecast/weather data
- air-quality data
- location/geocoding searches

The networking layer also contains an **optional WeatherAPI fallback**. The fallback is only used when a WeatherAPI key is configured.

### Optional environment variable

Create a `.env` file in the project root when you want to enable the WeatherAPI fallback:

```env
VITE_WEATHERAPI_KEY=your_key_here
```

The app works without this variable using Open-Meteo as its primary provider.

> Never commit real API keys or secrets to GitHub.

## 🧠 How the weather intelligence works

Aura separates raw data fetching from the decision layer. Weather records are normalized first, then the intelligence engine calculates scores, rankings, activity recommendations, and explanations from the available data.

The World Pulse includes modes such as:

- Best overall
- Cleanest air
- Best for running
- Best for walking
- Best for travel
- Warmest
- Coolest
- Least rain
- Most rain
- Weekend escapes

The scoring engine is designed to account for multiple conditions rather than temperature alone. Activity-specific logic can weigh factors such as temperature, rain probability, humidity, wind, UV, visibility, and air quality differently.

## 🗺️ City catalog

Aura ships with a curated catalog of **99 cities** distributed across multiple regions. Each city is represented with structured metadata including coordinates, timezone, region, and tags used by the ranking and recommendation system.

## ⚡ Reliability & performance

The app is designed to remain useful when network conditions are imperfect.

- City requests are isolated so one failed city does not take down the World Pulse.
- Requests use timeouts and retries.
- The networking layer supports provider fallback.
- Successful city data can be stored as a timestamped local snapshot.
- Cached data can be reused while a fresh request is attempted.
- Geolocation is an enhancement rather than the only way to enter the app.
- The service worker caches the application shell and same-origin static assets.
- Cross-origin weather API requests are intentionally not intercepted by the service worker.

## 🎨 Design direction

Aura aims for a restrained premium-weather aesthetic:

- dark/light glass surfaces
- warm accent treatment
- strong typography hierarchy
- subtle motion
- responsive mobile-to-desktop layouts
- concise, decision-oriented copy

The UI is intentionally more like a **weather intelligence product** than a conventional weather dashboard.

## 🔐 Privacy notes

Aura's client-side persistence uses browser `localStorage` for app preferences and cached experience data. Geolocation is requested through the browser when the user chooses to use location services.

No backend authentication or user account system is required for the core weather experience.

## 🌐 Deployment

Because Aura is a Vite single-page application, it can be deployed to any static hosting platform that supports a Vite production build.

### Vercel

1. Push the project to GitHub.
2. Import the repository into Vercel.
3. Use the default Vite settings, or set:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Add `VITE_WEATHERAPI_KEY` in Vercel only if the optional WeatherAPI fallback is required.
5. Deploy.

### Netlify

1. Connect the GitHub repository.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Add `VITE_WEATHERAPI_KEY` as an environment variable only when needed.

### Other static hosts

Run:

```bash
npm run build
```

Then publish the generated `dist/` directory.

For hosts that require explicit SPA fallback behavior, configure unknown application routes to serve `index.html`.

## 🧪 Recommended checks before shipping

```bash
npm install
npm run typecheck
npm run build
```

Then verify the production build for:

- city search
- location permission and denial
- World Pulse loading
- ranking mode changes
- city detail pages
- Ask Aura
- city comparison
- favorites / My Cities
- dark/light mode
- mobile layouts
- offline/revisit behavior

## 📄 License

This repository does not currently declare a software license. Add a `LICENSE` file and update this section before distributing the project publicly under a specific license.

---

**Aura — Weather, made useful.**

## 🛠 Engineering & quality gates

- **Unit tests** - `npm test` (Vitest): 28 tests over the scoring engine, AQI bands, WMO code map, unit math, rankings, best-window search, alert rules and day deltas - all on deterministic fixtures, no network.
- **E2E tests** - `npm run test:e2e` (Playwright, mobile 390px + desktop 1280 projects): no sideways page scroll, filters contained in their card, Next-6-hours strip actually swipes, air-quality tiles never overlap or escape the panel, ranking rows keep their rhythm.
- **Typecheck & build** - `npm run typecheck`, `npm run build` (strict TS, code-split routes).
- **Lighthouse budgets** - `npm run lhci`: accessibility / best-practices / SEO are hard gates (>=0.9), performance is a tracked warning budget.
- **CI** - `.github/workflows/ci.yml` runs typecheck, unit, build, e2e and Lighthouse on every push/PR.
- **Layout regression harness** - `scripts/final_sweep.py` measures document width and clipped content across home/city/compare at 390/360/1280.
