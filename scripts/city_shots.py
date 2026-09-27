"""City view screenshots at mobile width."""
import sys
from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 else "shots2"
WIDTH = int(sys.argv[2]) if len(sys.argv) > 2 else 390

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": WIDTH, "height": 844}, device_scale_factor=2)
    page.goto("http://localhost:3000/", wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(5000)

    # open row 1 -> expand -> Explore
    row = page.query_selector("section.mt-10 button[aria-expanded]")
    row.click()
    page.wait_for_timeout(600)
    explore = page.query_selector("button:has-text('Explore')")
    explore.click()
    page.wait_for_timeout(1500)
    page.wait_for_selector("h2:has-text('Air quality')", timeout=30000)
    page.wait_for_timeout(4000)

    def shot(sel, name):
        els = page.query_selector_all(sel)
        if els:
            els[0].scroll_into_view_if_needed()
            page.wait_for_timeout(800)
            els[0].screenshot(path=f"{OUT}/{name}.png")
            print("saved", name)
        else:
            print("MISSING", sel)

    page.screenshot(path=f"{OUT}/c_top.png")
    shot("section:has(h2:text('Air quality'))", "c_air")
    shot("section:has(h2:text('Next 6 hours'))", "c_next6")
    shot("section:has(h2:text('7-day outlook'))", "c_week")
    shot("section:has(h2:text('Tomorrow vs today'))", "c_tvt")
    browser.close()
