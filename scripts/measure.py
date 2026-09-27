"""Measure bounding rects of key elements at mobile width + viewport shots."""
import json
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000/"
OUT = sys.argv[2] if len(sys.argv) > 2 else "shots"
WIDTH = int(sys.argv[3]) if len(sys.argv) > 3 else 390

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": WIDTH, "height": 844}, device_scale_factor=2)
    page.goto(URL, wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(6000)

    info = page.evaluate("""() => {
      const pick = (sel, nth=0) => {
        const els = document.querySelectorAll(sel);
        const el = els[nth];
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return { sel, n: els.length, x: Math.round(r.x), w: Math.round(r.width), right: Math.round(r.right),
                 sw: el.scrollWidth, cw: el.clientWidth, ox: cs.overflowX, cls: (el.className||'').toString().slice(0,80) };
      };
      return [
        pick('#root'),
        pick('main'),
        pick('main > div > div'),               // container max-w-7xl
        pick('section.mt-10'),                  // world pulse board
        pick('section.mt-10 h1'),
        pick('div.mt-3.flex.flex-col.gap-2'),   // filters block
        pick('section.mt-10 .glass.lift', 0),   // first rank card
        pick('section.mt-10 .glass.lift', 0) && document.querySelectorAll('section.mt-10 .glass.lift')[0].querySelector('button'),
        pick('section.mt-12'),                  // decision time
        pick('header'),
      ].filter(Boolean);
    }""")
    for row in info:
        print(json.dumps(row))

    # viewport shots while scrolling
    for name, sel in [("v_board", "section.mt-10"), ("v_filters", "div.mt-3.flex.flex-col.gap-2")]:
        el = page.query_selector(sel)
        if el:
            el.scroll_into_view_if_needed()
            page.wait_for_timeout(600)
            page.screenshot(path=f"{OUT}/{name}.png")
            print("shot", name)
    browser.close()
