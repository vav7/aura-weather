# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mobile.spec.ts >> page never scrolls sideways
- Location: tests/e2e/mobile.spec.ts:15:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/
Call log:
  - navigating to "http://localhost:3000/", waiting until "domcontentloaded"

```

# Test source

```ts
  1  | import { test, expect, Page } from "@playwright/test";
  2  | 
  3  | /** Wait for the live board to sync enough to rank cities. */
  4  | async function waitForBoard(page: Page) {
> 5  |   await page.goto("/", { waitUntil: "domcontentloaded" });
     |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/
  6  |   await expect(page.locator("section.mt-10 button[aria-expanded]").first()).toBeVisible({ timeout: 45_000 });
  7  | }
  8  | 
  9  | async function openFirstCity(page: Page) {
  10 |   await page.locator("section.mt-10 button[aria-expanded]").first().click();
  11 |   await page.locator("button:has-text('Explore')").first().click();
  12 |   await expect(page.locator("h2", { hasText: "Next 6 hours" })).toBeVisible({ timeout: 45_000 });
  13 | }
  14 | 
  15 | test("page never scrolls sideways", async ({ page }) => {
  16 |   await waitForBoard(page);
  17 |   const { doc, client } = await page.evaluate(() => ({
  18 |     doc: document.documentElement.scrollWidth,
  19 |     client: document.documentElement.clientWidth,
  20 |   }));
  21 |   expect(doc).toBeLessThanOrEqual(client);
  22 | });
  23 | 
  24 | test("filter chips stay inside their box (no edge bleed)", async ({ page }) => {
  25 |   await waitForBoard(page);
  26 |   const box = await page.locator("section.mt-10").boundingBox();
  27 |   const chip = await page.locator("div[aria-label='Region filter']").boundingBox();
  28 |   expect(box).not.toBeNull();
  29 |   expect(chip).not.toBeNull();
  30 |   expect(chip!.x).toBeGreaterThanOrEqual(box!.x - 1);
  31 |   expect(chip!.x + chip!.width).toBeLessThanOrEqual(box!.x + box!.width + 1);
  32 | });
  33 | 
  34 | test("city view: Next 6 hours actually slides", async ({ page }) => {
  35 |   await waitForBoard(page);
  36 |   await openFirstCity(page);
  37 |   const scroller = page.locator("section:has(h2:text('Next 6 hours')) .no-scrollbar");
  38 |   const m = await scroller.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
  39 |   expect(m.sw).toBeGreaterThan(m.cw); // there is something to swipe
  40 |   await scroller.evaluate((el) => el.scrollBy({ left: 200 }));
  41 |   await page.waitForTimeout(400);
  42 |   const left = await scroller.evaluate((el) => el.scrollLeft);
  43 |   expect(left).toBeGreaterThan(0);
  44 | });
  45 | 
  46 | test("city view: air-quality tiles never overlap or escape the panel", async ({ page }) => {
  47 |   await waitForBoard(page);
  48 |   await openFirstCity(page);
  49 |   await expect(page.locator("h2", { hasText: "Air quality" })).toBeVisible({ timeout: 30_000 });
  50 |   const panel = page.locator("section:has(h2:text('Air quality'))");
  51 |   await panel.scrollIntoViewIfNeeded();
  52 |   const report = await panel.evaluate((el) => {
  53 |     const pr = el.getBoundingClientRect();
  54 |     const tiles = [...el.querySelectorAll(".hairline")].map((t) => t.getBoundingClientRect());
  55 |     const overlap = tiles.some((a, i) =>
  56 |       tiles.some((b, j) => i < j && a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2),
  57 |     );
  58 |     const escaped = tiles.some((t) => t.left < pr.left - 1 || t.right > pr.right + 1);
  59 |     return { overlap, escaped, n: tiles.length };
  60 |   });
  61 |   expect(report.n).toBeGreaterThanOrEqual(3);
  62 |   expect(report.overlap).toBe(false);
  63 |   expect(report.escaped).toBe(false);
  64 | });
  65 | 
  66 | test("ranking rows keep their two-line mobile rhythm", async ({ page }) => {
  67 |   await waitForBoard(page);
  68 |   const row = page.locator("section.mt-10 .glass.lift").first();
  69 |   const box = await row.boundingBox();
  70 |   const vp = page.viewportSize();
  71 |   expect(box).not.toBeNull();
  72 |   expect(box!.x).toBeGreaterThanOrEqual(0);
  73 |   expect(box!.x + box!.width).toBeLessThanOrEqual(vp!.width + 1);
  74 | });
  75 | 
  76 | test("atlas board renders the live map (or graceful fallback)", async ({ page }) => {
  77 |   test.skip(!process.env.CI && !process.env.ATLAS_E2E, "webgl-heavy: run with ATLAS_E2E=1 or in CI");
  78 |   await waitForBoard(page);
  79 |   const section = page.locator("section[aria-label='Atlas board']");
  80 |   await section.scrollIntoViewIfNeeded();
  81 |   await expect(section).toBeVisible({ timeout: 30_000 });
  82 |   await page.waitForTimeout(2500); // lazy chunk + style load
  83 |   const hasCanvas = await section.locator("canvas").count();
  84 |   const hasFallback = await section.locator("svg").count();
  85 |   expect(hasCanvas + hasFallback).toBeGreaterThan(0);
  86 |   if (hasCanvas) {
  87 |     await expect(section.locator("button:has-text('Score')").first()).toBeVisible();
  88 |     await expect(section.locator("button:has-text('Radar')").first()).toBeVisible();
  89 |   }
  90 | });
  91 | 
```