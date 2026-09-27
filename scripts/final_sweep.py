"""Final sweep: document width + real inner overflow across views & widths."""
import json
from playwright.sync_api import sync_playwright

CHECK = """() => {
  const de = document.documentElement;
  const inScroller = (el) => {
    let p = el.parentElement;
    while (p) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
      p = p.parentElement;
    }
    return false;
  };
  const clippedBy = (el) => {
    let p = el.parentElement;
    while (p) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'hidden' || ox === 'clip' || ox === 'auto' || ox === 'scroll') return true;
      p = p.parentElement;
    }
    return false;
  };
  const inner = [];
  const visuallyCut = [];
  const vw = de.clientWidth;
  for (const el of document.querySelectorAll('*')) {
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (st.overflowX !== 'auto' && st.overflowX !== 'scroll' && st.overflowX !== 'hidden' && st.overflowX !== 'clip') {
      if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0 && !clippedBy(el)) {
        inner.push({ tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 70),
                     sw: el.scrollWidth, cw: el.clientWidth, text: (el.textContent || '').trim().slice(0, 40) });
      }
    }
    // content visually chopped at the viewport edge (clipped by page guard, not a scroller)
    const txt = (el.textContent || '').trim();
    if (r.width > 0 && r.right > vw + 2 && !inScroller(el) && txt.length > 0 && el.children.length <= 3
        && st.pointerEvents !== 'none') {
      visuallyCut.push({ tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 60),
                         right: Math.round(r.right), text: txt.slice(0, 40) });
    }
  }
  return { doc: de.scrollWidth, client: vw, inner: inner.slice(0, 10), cut: visuallyCut.slice(0, 10) };
}"""

with sync_playwright() as p:
    browser = p.chromium.launch()
    for width in (390, 360):
        page = browser.new_page(viewport={"width": width, "height": 844}, device_scale_factor=2)
        page.goto("http://localhost:3000/", wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(5000)
        print(f"--- HOME @{width}:", json.dumps(page.evaluate(CHECK)))
        # city view
        row = page.query_selector("section.mt-10 button[aria-expanded]")
        if row:
            row.click()
            page.wait_for_timeout(500)
            ex = page.query_selector("button:has-text('Explore')")
            if ex:
                ex.click()
                page.wait_for_timeout(1200)
                try:
                    page.wait_for_selector("h2:has-text('Air quality')", timeout=25000)
                    page.wait_for_timeout(3000)
                    print(f"--- CITY @{width}:", json.dumps(page.evaluate(CHECK)))
                except Exception as e:
                    print("city wait failed", e)
            # back home via logo
            page.query_selector("header button[aria-label='Aura home']").click()
            page.wait_for_timeout(1200)
        # compare view
        page.query_selector("header button[title='Compare cities']").click()
        page.wait_for_timeout(1500)
        # add two cities from suggestion chips
        chips = page.query_selector_all("div.no-scrollbar.fade-r.mt-5 button")
        for ch in chips[:2]:
            ch.click()
            page.wait_for_timeout(700)
        print(f"--- COMPARE @{width}:", json.dumps(page.evaluate(CHECK)))
        if width == 390:
            page.screenshot(path="shots2/cmp_390.png", full_page=True)
        page.close()

    # desktop regression
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.goto("http://localhost:3000/", wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(5000)
    print("--- HOME @1280:", json.dumps(page.evaluate(CHECK)))
    page.screenshot(path="shots2/desktop_home.png")
    browser.close()
