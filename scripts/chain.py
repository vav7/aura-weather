"""Dump ancestor chain with layout info for key sections."""
import json
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 390, "height": 844})
    page.goto("http://localhost:3000/", wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(6000)
    out = page.evaluate("""() => {
      const chain = (el) => {
        const rows = [];
        let q = el;
        while (q && q !== document.body) {
          const r = q.getBoundingClientRect();
          const cs = getComputedStyle(q);
          rows.push({
            tag: q.tagName.toLowerCase(),
            cls: (q.className || '').toString().slice(0, 70),
            w: Math.round(r.width), sw: q.scrollWidth,
            disp: cs.display, dir: cs.flexDirection, wrap: cs.flexWrap,
            ox: cs.overflowX, wprop: cs.width, minw: cs.minWidth, als: cs.alignSelf,
          });
          q = q.parentElement;
        }
        return rows;
      };
      const sec = document.querySelector('section.mt-10');
      return { board: chain(sec) };
    }""")
    for row in out["board"]:
        print(json.dumps(row))
    browser.close()
