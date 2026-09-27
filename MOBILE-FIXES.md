# Mobile layout & alignment fixes

Verified with headless Chromium (Playwright) at 320 / 360 / 390 px and 1280 px on the
World Pulse board, any city view (Air quality panel included) and the Compare view:
`document.scrollWidth === clientWidth` everywhere and no element overflows its box.

## Root causes found

1. **Full-bleed horizontal scrollers** (`-mx-4 … px-4` + `overflow-x-auto`) made the mode
   chips and the Region/Temp/Air filter rows run edge-to-edge past the content column and
   off the screen; their no-wrap chip content also raised the section's min-content width
   to 374 px (wider than the 358 px container), stretching whole sections sideways.
2. **Air quality panel**: the action chip (`inline-flex`, no-wrap) next to the score dial
   forced a ~374 px min-content width, pushing the whole panel (and every sibling section)
   16 px past the page padding on phones; the sparkline caption row (`justify-between`)
   left "now" visually off-centre.
3. **Ranking rows**: on mobile the temperature dropped into a lonely second grid row with
   dead space beside it, while the AQI/rain line sat under the city name — rows looked
   misaligned/broken.
4. **Header**: at ≤360 px the fixed-width control cluster + non-shrinkable search input
   overflowed the viewport by ~20 px.
5. Pill-shaped banners (`rounded-full` + `flex-wrap`) turned into blobs when their text
   wrapped on narrow screens; the signals ticker truncated to a few words.

## What changed

- `src/index.css`
  - `html, body { overflow-x: clip }` — hard guard against any sideways page scroll
    (`clip`, not `hidden`, so `position: sticky` keeps working).
  - New `.fade-r` / `.fade-r-off-sm` utilities: right-edge mask fade that marks clipped
    rows as swipeable (disabled ≥sm where rows wrap instead).
- `src/components/pulse.tsx`
  - Region / Temp / Air filter rows: contained, wrapping flex rows — nothing scrolls off
    the box anymore; labels stay put.
  - Ranking-mode tablist: contained scroller + fade affordance (wraps ≥sm).
  - Ranking rows: mobile grid now row 1 = rank · city + country · star/dial/arrow,
    row 2 = icon + temp (left) and AQI · rain · top strength (right) spanning the free
    columns — no dead space, nothing clipped.
  - "Where should I go" & "My Cities" carousels: contained inside the content column with
    fade + snap instead of bleeding to the screen edges.
  - Signals ticker: two-line clamp on mobile instead of a hard one-word truncate;
    pill banners (`SyncStrip`, ticker, geo prompt, empty My Cities) use
    `rounded-3xl sm:rounded-full` so wrapped text keeps a sane shape; geo prompt stacks
    its message above the buttons on phones.
- `src/components/cityview.tsx`
  - Air quality panel: shrinkable text column (`min-w-0 flex-1`), wrappable action chip
    (`max-w-full`), advice text fills the column on mobile — panel now respects the page
    padding at every width; sparkline caption is a 3-col grid so "~8h ago / now / +10h"
    align left/centre/right under the curve; pollutant & morning/now/tonight tiles got
    `min-w-0`.
  - "Next 6 hours" scroller: fade + snap affordance.
  - "Tomorrow vs today" rows wrap instead of squeezing on 320 px screens.
- `src/components/header.tsx`
  - Below `sm` the header wraps: row 1 = logo + controls, row 2 = full-width search
    (previously a ~60 px unusable pill; at 360 px it overflowed the viewport).
  - Search box/input got `min-w-0` so they can shrink inside the flex row.
- `src/components/compare.tsx`
  - Suggestion chips + metrics table scrollers got the fade affordance; city cards move
    the name below the remove/PICK badges so they never overlap on narrow columns.

## Premium / darker pass (round 2)

- Dark palette deepened a touch: `--bg0 #04070e`, `--bg1 #08101c`, softer `--mut/--faint`,
  thinner `--line`, slightly more transparent glass, deeper ambient washes — same accent
  identity, just a lil' darker & richer.
- `.glass` / `.glass2`: blur raised to 16/20 px with `saturate(130%)` and a deeper drop
  shadow for a more premium glass feel.
- New `.headline-sheen` (gradient-clipped text, light-theme variant included) applied to
  the board headline, brief headline, decision headline, city name and compare title.
- **Air quality panel rebuilt with container queries** (`@container/air`,
  `@container/aircol`): the old `lg:grid-cols-[auto_1fr]` let the dial/text track eat all
  the width on desktop, starving the stats column until PM2.5/PM10/Ozone/NO₂ and
  Morning/Now/Tonight tiles printed on top of each other (the overlap seen on PC).
  Now the panel stacks dial-over-stats unless the *panel itself* is ≥48 rem wide, and the
  pollutant grid switches 2→4 columns only when its own column is ≥24 rem; labels/values
  truncate instead of colliding. Dial block top-aligns in side-by-side mode.

## Seeing the fixes / deploying

The fixes live in this workspace (`localhost:3000` dev server, or `npm run build` → `dist/`).
The old Vercel deployment (`aura-weather-intelligence.vercel.app`) still serves the
pre-fix bundle — if the Air quality tiles look overlapped, you are viewing the old build
or a cached bundle. Hard-refresh (Ctrl/Cmd+Shift+R), or redeploy: push these commits to
the GitHub repo wired to Vercel, or upload `dist/` (static output, no server needed).

## How to re-verify

```bash
npm install && npm run dev          # http://localhost:3000
python3 scripts/overflow_check.py http://localhost:3000/ 390 shots/check.png
python3 scripts/final_sweep.py      # home + city + compare @390/360 + desktop
```
