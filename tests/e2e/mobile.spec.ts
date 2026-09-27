import { test, expect, Page } from "@playwright/test";

/** Wait for the live board to sync enough to rank cities. */
async function waitForBoard(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("section.mt-10 button[aria-expanded]").first()).toBeVisible({ timeout: 45_000 });
}

async function openFirstCity(page: Page) {
  await page.locator("section.mt-10 button[aria-expanded]").first().click();
  await page.locator("button:has-text('Explore')").first().click();
  await expect(page.locator("h2", { hasText: "Next 6 hours" })).toBeVisible({ timeout: 45_000 });
}

test("page never scrolls sideways", async ({ page }) => {
  await waitForBoard(page);
  const { doc, client } = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(doc).toBeLessThanOrEqual(client);
});

test("filter chips stay inside their box (no edge bleed)", async ({ page }) => {
  await waitForBoard(page);
  const box = await page.locator("section.mt-10").boundingBox();
  const chip = await page.locator("div[aria-label='Region filter']").boundingBox();
  expect(box).not.toBeNull();
  expect(chip).not.toBeNull();
  expect(chip!.x).toBeGreaterThanOrEqual(box!.x - 1);
  expect(chip!.x + chip!.width).toBeLessThanOrEqual(box!.x + box!.width + 1);
});

test("city view: Next 6 hours actually slides", async ({ page }) => {
  await waitForBoard(page);
  await openFirstCity(page);
  const scroller = page.locator("section:has(h2:text('Next 6 hours')) .no-scrollbar");
  const m = await scroller.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
  expect(m.sw).toBeGreaterThan(m.cw); // there is something to swipe
  await scroller.evaluate((el) => el.scrollBy({ left: 200 }));
  await page.waitForTimeout(400);
  const left = await scroller.evaluate((el) => el.scrollLeft);
  expect(left).toBeGreaterThan(0);
});

test("city view: air-quality tiles never overlap or escape the panel", async ({ page }) => {
  await waitForBoard(page);
  await openFirstCity(page);
  await expect(page.locator("h2", { hasText: "Air quality" })).toBeVisible({ timeout: 30_000 });
  const panel = page.locator("section:has(h2:text('Air quality'))");
  await panel.scrollIntoViewIfNeeded();
  const report = await panel.evaluate((el) => {
    const pr = el.getBoundingClientRect();
    const tiles = [...el.querySelectorAll(".hairline")].map((t) => t.getBoundingClientRect());
    const overlap = tiles.some((a, i) =>
      tiles.some((b, j) => i < j && a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2),
    );
    const escaped = tiles.some((t) => t.left < pr.left - 1 || t.right > pr.right + 1);
    return { overlap, escaped, n: tiles.length };
  });
  expect(report.n).toBeGreaterThanOrEqual(3);
  expect(report.overlap).toBe(false);
  expect(report.escaped).toBe(false);
});

test("ranking rows keep their two-line mobile rhythm", async ({ page }) => {
  await waitForBoard(page);
  const row = page.locator("section.mt-10 .glass.lift").first();
  const box = await row.boundingBox();
  const vp = page.viewportSize();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(vp!.width + 1);
});

test("atlas board renders the live map (or graceful fallback)", async ({ page }) => {
  test.skip(!process.env.CI && !process.env.ATLAS_E2E, "webgl-heavy: run with ATLAS_E2E=1 or in CI");
  await waitForBoard(page);
  const section = page.locator("section[aria-label='Atlas board']");
  await section.scrollIntoViewIfNeeded();
  await expect(section).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2500); // lazy chunk + style load
  const hasCanvas = await section.locator("canvas").count();
  const hasFallback = await section.locator("svg").count();
  expect(hasCanvas + hasFallback).toBeGreaterThan(0);
  if (hasCanvas) {
    await expect(section.locator("button:has-text('Score')").first()).toBeVisible();
    await expect(section.locator("button:has-text('Radar')").first()).toBeVisible();
  }
});
