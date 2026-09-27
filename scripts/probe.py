"""Find innermost elements inside section.mt-10 whose width forces 374px."""
import json
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000/"
WIDTH = int(sys.argv[2]) if len(sys.argv) > 2 else 390

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": WIDTH, "height": 844})
    page.goto(URL, wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(6000)
    out = page.evaluate("""() => {
      const sec = document.querySelector('section.mt-10');
      if (!sec) return ['no section'];
      const res = [];
      const walk = (el, depth) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (r.width > 360) {
          const kids = [...el.children].map(k => k.getBoundingClientRect().width);
          res.push({
            depth, tag: el.tagName.toLowerCase(),
            cls: (el.className || '').toString().slice(0, 90),
            w: Math.round(r.width), disp: cs.display, wrap: cs.flexWrap, ox: cs.overflowX,
            maxw: cs.maxWidth, kidWidths: kids.map(Math.round).slice(0, 8),
            text: (el.textContent || '').trim().slice(0, 40),
          });
        }
        for (const k of el.children) walk(k, depth + 1);
      };
      walk(sec, 0);
      return res;
    }""")
    for row in out:
        print(json.dumps(row))
    browser.close()
