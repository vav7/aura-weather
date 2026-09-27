# Deploying the fixed Aura build

The workspace repo (`aura-weather/`) contains 3 commits on top of the original
`a1b8840` HEAD:

```
aa6a7fa  Fix mobile horizontal overflow & alignment (filters, air-quality panel, rank rows, header, carousels)
3dc72a8  Rebuild Air quality panel with container queries (fix desktop tile overlap); darker premium palette + glass/headline sheen
2ccd5bb  Second micro-step darker palette; docs: how to view/deploy the fixed build
```

## Option A — push from your machine (recommended, keeps Vercel git auto-build)

1. Copy the whole `aura-weather/` folder from this workspace over your local clone
   (or clone fresh and apply the patch: `git am aura-weather-fixes.patch` — the patch
   file sits in the workspace root and contains all commits).
2. `git push origin main` (or your default branch).
3. Vercel (project wired to `vav7/aura-weather`) detects Vite automatically and
   redeploys in ~1 min. Hard-refresh the live URL (Ctrl/Cmd+Shift+R) afterwards.

## Option B — deploy the prebuilt static output

`aura-weather/dist/` is a fresh production build of the fixed code.

- Vercel CLI: `npx vercel deploy --prod dist` (static, no build step needed), or
- any static host: upload the contents of `dist/` (SPA fallback to `index.html`
  is optional — the app is hash/state routed; `sw.js` ships inside `dist/`).

## Verifying after deploy

- Mobile (390 px): filters wrap inside the card, rank rows are two balanced lines,
  nothing touches the screen edge.
- PC: open any city → Air quality: PM2.5 / PM10 / Ozone / NO₂ tiles sit in their own
  boxes (4-up on wide panels, 2×2 on narrow), Morning/Now/Tonight never overlap.
- Dark theme is a touch deeper everywhere (body, header, search bar, cards) on both
  mobile and PC; light theme unchanged.
