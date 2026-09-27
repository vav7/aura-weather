"""Detect elements that overflow the viewport horizontally (mobile view)."""
import json
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000/"
WIDTH = int(sys.argv[2]) if len(sys.argv) > 2 else 390
SHOT = sys.argv[3] if len(sys.argv) > 3 else "/tmp/mobile_full.png"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": WIDTH, "height": 844},
                            device_scale_factor=2,
                            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
    page.goto(URL, wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(4000)

    doc_overflow = page.evaluate("""() => {
      const de = document.documentElement;
      return {
        scrollWidth: de.scrollWidth,
        clientWidth: de.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
      };
    }""")
    print("DOCUMENT:", json.dumps(doc_overflow))

    offenders = page.evaluate("""(vw) => {
      const out = [];
      const seen = new Set();
      const els = document.querySelectorAll('*');
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        // element itself crosses the viewport edge (allow 1px tolerance)
        if (r.right > vw + 1 || r.left < -1) {
          // skip elements inside an intentional horizontal scroller (overflow-x auto/scroll)
          let p = el.parentElement, scroller = null;
          while (p) {
            const st = getComputedStyle(p);
            if ((st.overflowX === 'auto' || st.overflowX === 'scroll') && p.scrollWidth > p.clientWidth) { scroller = p; break; }
            p = p.parentElement;
          }
          if (scroller) continue;
          const path = [];
          let q = el;
          while (q && path.length < 5) {
            let seg = q.tagName.toLowerCase();
            if (q.id) seg += '#' + q.id;
            if (q.className && typeof q.className === 'string') {
              const cls = q.className.trim().split(/\\s+/).slice(0, 4).join('.');
              if (cls) seg += '.' + cls;
            }
            path.unshift(seg);
            q = q.parentElement;
          }
          const key = path.join(' > ');
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({
            tag: el.tagName.toLowerCase(),
            cls: (typeof el.className === 'string' ? el.className : '').slice(0, 120),
            text: (el.textContent || '').trim().slice(0, 60),
            left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width),
            path: key.slice(0, 240),
          });
        }
      }
      return out.slice(0, 40);
    }""", WIDTH)

    print(f"\nOFFENDERS ({len(offenders)}):")
    for o in offenders:
        print(json.dumps(o))

    # find elements whose scrollWidth exceeds clientWidth (inner overflow) - excluding known scrollers
    inner = page.evaluate("""() => {
      const out = [];
      for (const el of document.querySelectorAll('*')) {
        const st = getComputedStyle(el);
        if (st.overflowX === 'auto' || st.overflowX === 'scroll' || st.overflowX === 'hidden') continue;
        if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
          out.push({
            tag: el.tagName.toLowerCase(),
            cls: (typeof el.className === 'string' ? el.className : '').slice(0, 100),
            scrollWidth: el.scrollWidth, clientWidth: el.clientWidth,
            text: (el.textContent || '').trim().slice(0, 50),
          });
        }
      }
      return out.slice(0, 25);
    }""")
    print(f"\nINNER OVERFLOW ({len(inner)}):")
    for o in inner:
        print(json.dumps(o))

    page.screenshot(path=SHOT, full_page=True)
    print(f"\nScreenshot saved: {SHOT}")
    browser.close()
