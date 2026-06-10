from playwright.sync_api import sync_playwright
import time

BASE_URL = "http://127.0.0.1:8000"


def run():
    print("Starting UI smoke tests against:", BASE_URL)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        try:
            page.goto(BASE_URL, timeout=15000)
            print("Loaded frontend")

            # Wait for project timeline list to appear
            page.wait_for_selector('#project-timeline-controls', timeout=5000)
            print("Timeline controls present")

            # Try filter interactions
            page.select_option('#timeline-filter-type', '')
            time.sleep(0.5)
            page.select_option('#timeline-filter-stage', '')
            time.sleep(0.5)
            print("Filters interacted")

            # Click Load more (if present)
            try:
                load_more = page.query_selector('#timeline-load-more')
                if load_more:
                    load_more.click()
                    print("Clicked Load more")
            except Exception:
                pass

            # Attempt to open first timeline event details
            first_item = page.query_selector('.timeline-item')
            if first_item:
                first_item.click()
                print("Opened first timeline item")
                time.sleep(0.5)

                # If stage modal contains a docpicker, try to interact with its select
                try:
                    if page.query_selector('select[name="linked_note_id"]'):
                        print("Linked note select present")
                except Exception:
                    pass

            # Try opening Log Usage button on a stage (if present)
            btn = page.query_selector('button:has-text("Log Usage")')
            if btn:
                btn.click()
                print("Opened Log Usage modal")
                time.sleep(0.5)
                # Close modal by pressing Escape
                page.keyboard.press('Escape')

            print("Smoke tests completed successfully")
        finally:
            context.close()
            browser.close()


if __name__ == '__main__':
    run()
