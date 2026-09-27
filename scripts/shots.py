"""Capture close-up screenshots of key sections at mobile width."""
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

    def shot(selector, name, nth=0):
        els = page.query_selector_all(selector)
        if len(els) > nth:
            els[nth].scroll_into_view_if_needed()
            page.wait_for_timeout(700)
            els[nth].screenshot(path=f"{OUT}/{name}.png")
            print("saved", name)
        else:
            print("MISSING", selector)

    # top of page (header + sync strip + signals)
    page.screenshot(path=f"{OUT}/m_top.png")
    # brief card
    shot("section.mt-3", "m_brief", 0)
    # filters row of world pulse
    shot("div.mt-3.flex.flex-col.gap-2", "m_filters")
    # rank list rows
    shot("section.mt-10", "m_board")
    # decision time
    shot("section.mt-12", "m_decision")

    # open first city row -> city view with air quality
    rows = page.query_selector_all("[data-cityrow], a[href*='city'], button")
    # click the first ranking row: find text Paris
    try:
        page.get_by_text("Paris", exact=False).first.click(timeout=5000)
        page.wait_for_timeout(5000)
        page.screenshot(path=f"{OUT}/m_city_top.png")
        shot("section:has(h2:text('Air quality'))", "m_air")
        shot("section:has(h2:text('Next 6 hours'))", "m_next6")
        shot("section:has(h2:text('7-day outlook'))", "m_week")
        shot("section:has(h2:text('Best windows · next 36h'))", "m_windows")
    except Exception as e:
        print("city nav failed:", e)

    browser.close()
