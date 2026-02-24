import hashlib
from datetime import datetime
from playwright.async_api import async_playwright
from sqlalchemy.orm import Session
from ..models import User, Chore
from .encryption import decrypt


def _make_source_id(subject: str, title: str, due: str) -> str:
    raw = f"{subject}|{title}|{due}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


async def scrape_homework(user: User, db: Session) -> dict:
    """Log into Go4Schools and scrape homework for a user.

    Returns dict with keys: synced (int), error (str|None)
    """
    email = user.go4schools_email
    password = decrypt(user.go4schools_password)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        try:
            # Navigate to student login
            await page.goto("https://www.go4schools.com/students/", timeout=30000)

            # Fill login form
            await page.fill('input[type="email"]', email)
            await page.fill('input[type="password"]', password)
            await page.click("#go-sign-in-button")

            # Wait for navigation after login
            await page.wait_for_load_state("networkidle", timeout=15000)

            # Check for login failure
            if "sign in" in (await page.title()).lower():
                return {"synced": 0, "error": "Login failed — check your email and password"}

            # Navigate to homework page
            homework_link = page.locator('a:has-text("Homework"), a[href*="homework"]').first
            if await homework_link.count() > 0:
                await homework_link.click()
                await page.wait_for_load_state("networkidle", timeout=15000)
            else:
                await page.goto("https://www.go4schools.com/students/homework.aspx", timeout=30000)
                await page.wait_for_load_state("networkidle", timeout=15000)

            # Scrape homework items from table or card layout
            homework_items = []

            rows = page.locator("table tbody tr, .homework-item, [class*='homework'] .card, [class*='homework'] .row")
            count = await rows.count()

            if count == 0:
                return {"synced": 0, "error": None}

            for i in range(count):
                row = rows.nth(i)
                cells = await row.locator("td").all_text_contents()

                if len(cells) >= 3:
                    homework_items.append({
                        "subject": cells[0].strip(),
                        "title": cells[1].strip(),
                        "due": cells[2].strip(),
                        "description": cells[3].strip() if len(cells) > 3 else "",
                    })

            # Upsert homework as chores
            seen_source_ids = set()
            synced = 0

            for item in homework_items:
                source_id = _make_source_id(item["subject"], item["title"], item["due"])
                seen_source_ids.add(source_id)

                existing = db.query(Chore).filter(Chore.source_id == source_id).first()
                if existing:
                    continue

                due_date = None
                for fmt in ("%d/%m/%Y", "%d %b %Y", "%Y-%m-%d"):
                    try:
                        due_date = datetime.strptime(item["due"], fmt)
                        break
                    except ValueError:
                        continue

                chore_title = f"{item['subject']}: {item['title']}"
                chore = Chore(
                    title=chore_title[:200],
                    description=item.get("description", "")[:500] or None,
                    source="go4schools",
                    source_id=source_id,
                    due_date=due_date,
                    frequency="once",
                    is_bonus=False,
                    points=5,
                    assignee_id=user.id,
                )
                db.add(chore)
                synced += 1

            db.commit()
            return {"synced": synced, "error": None}

        except Exception as e:
            return {"synced": 0, "error": str(e)[:200]}
        finally:
            await browser.close()
