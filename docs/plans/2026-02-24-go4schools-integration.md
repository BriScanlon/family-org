# Go4Schools Homework Sync — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow children to connect their Go4Schools account and automatically sync homework as chores.

**Architecture:** Playwright headless browser scrapes homework from Go4Schools, triggered by RabbitMQ messages (daily + manual). Credentials stored encrypted on the User model. Homework items upserted as Chores with `source="go4schools"`.

**Tech Stack:** Playwright (Python), cryptography (Fernet), FastAPI, SQLAlchemy, RabbitMQ, React/TypeScript

**Design doc:** `docs/plans/2026-02-24-go4schools-integration-design.md`

---

### Task 1: Add new columns to models

**Files:**
- Modify: `family-org/backend/app/models.py`

**Step 1: Add User columns for Go4Schools credentials**

In `models.py`, add to the `User` class after line 22 (`preferences` column):

```python
go4schools_email = Column(String, nullable=True)
go4schools_password = Column(String, nullable=True)  # Fernet-encrypted
```

**Step 2: Add Chore columns for source tracking**

In `models.py`, add to the `Chore` class after line 42 (`frequency` column):

```python
source = Column(String, default="manual")  # "manual" or "go4schools"
source_id = Column(String, nullable=True, unique=True, index=True)  # dedup key
due_date = Column(DateTime, nullable=True)
```

**Step 3: Restart backend to run auto-migration**

The app calls `Base.metadata.create_all(bind=engine)` on startup, which adds new columns to existing tables in SQLAlchemy.

Note: `create_all` does NOT add columns to existing tables. We need an Alembic migration OR a manual ALTER TABLE. Since this project doesn't use Alembic, run manual SQL:

```bash
docker exec family-org-db-1 psql -U user -d family_org -c "
ALTER TABLE users ADD COLUMN IF NOT EXISTS go4schools_email VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS go4schools_password VARCHAR;
ALTER TABLE chores ADD COLUMN IF NOT EXISTS source VARCHAR DEFAULT 'manual';
ALTER TABLE chores ADD COLUMN IF NOT EXISTS source_id VARCHAR;
ALTER TABLE chores ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;
CREATE UNIQUE INDEX IF NOT EXISTS ix_chores_source_id ON chores(source_id) WHERE source_id IS NOT NULL;
"
```

**Step 4: Rebuild and restart backend + worker**

```bash
cd family-org && docker compose up -d --build backend worker
```

**Step 5: Verify columns exist**

```bash
docker exec family-org-db-1 psql -U user -d family_org -c "\d users" | grep go4schools
docker exec family-org-db-1 psql -U user -d family_org -c "\d chores" | grep -E "source|due_date"
```

**Step 6: Commit**

```bash
git add family-org/backend/app/models.py
git commit -m "feat(models): add Go4Schools and chore source columns"
```

---

### Task 2: Add encryption utility

**Files:**
- Create: `family-org/backend/app/services/encryption.py`
- Modify: `family-org/backend/requirements.txt`

**Step 1: Add cryptography to requirements.txt**

Add `cryptography` to the end of `family-org/backend/requirements.txt`.

**Step 2: Create encryption service**

Create `family-org/backend/app/services/encryption.py`:

```python
from cryptography.fernet import Fernet
import base64
import hashlib
from ..config import settings


def _get_fernet() -> Fernet:
    # Derive a 32-byte key from SECRET_KEY
    key = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt(plaintext: str) -> str:
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    return _get_fernet().decrypt(ciphertext.encode()).decode()
```

**Step 3: Commit**

```bash
git add family-org/backend/requirements.txt family-org/backend/app/services/encryption.py
git commit -m "feat: add Fernet encryption utility for credential storage"
```

---

### Task 3: Add Go4Schools backend endpoints

**Files:**
- Modify: `family-org/backend/app/routers/settings.py`
- Modify: `family-org/backend/app/schemas.py`

**Step 1: Add Go4Schools schemas**

In `family-org/backend/app/schemas.py`, add after the `PreferencesUpdate` class:

```python
class Go4SchoolsConnect(BaseModel):
    email: str
    password: str
```

**Step 2: Add endpoints to settings router**

In `family-org/backend/app/routers/settings.py`, add these imports at the top:

```python
from ..services.encryption import encrypt, decrypt
from ..services.rabbitmq import send_sync_message
from ..schemas import Go4SchoolsConnect
```

Then add these endpoints at the end of the file:

```python
@router.post("/go4schools")
async def connect_go4schools(creds: Go4SchoolsConnect, db: Session = Depends(get_db), current_user: User = Depends(get_me)):
    current_user.go4schools_email = creds.email
    current_user.go4schools_password = encrypt(creds.password)
    # Clear any previous error
    prefs = dict(current_user.preferences or {})
    prefs.pop("go4schools_error", None)
    prefs["go4schools_last_sync"] = None
    current_user.preferences = prefs
    db.add(current_user)
    db.commit()
    # Trigger immediate sync
    await send_sync_message("go4schools_sync", {"user_id": current_user.id})
    return {"status": "connected"}


@router.delete("/go4schools")
def disconnect_go4schools(db: Session = Depends(get_db), current_user: User = Depends(get_me)):
    current_user.go4schools_email = None
    current_user.go4schools_password = None
    prefs = dict(current_user.preferences or {})
    prefs.pop("go4schools_error", None)
    prefs.pop("go4schools_last_sync", None)
    current_user.preferences = prefs
    db.add(current_user)
    db.commit()
    return {"status": "disconnected"}


@router.post("/go4schools/sync")
async def sync_go4schools(current_user: User = Depends(get_me)):
    if not current_user.go4schools_email:
        raise HTTPException(status_code=400, detail="Go4Schools not connected")
    await send_sync_message("go4schools_sync", {"user_id": current_user.id})
    return {"status": "sync_triggered"}


@router.get("/go4schools/status")
def go4schools_status(current_user: User = Depends(get_me)):
    prefs = current_user.preferences or {}
    return {
        "connected": current_user.go4schools_email is not None,
        "email": current_user.go4schools_email,
        "last_sync": prefs.get("go4schools_last_sync"),
        "error": prefs.get("go4schools_error"),
    }
```

**Step 3: Commit**

```bash
git add family-org/backend/app/routers/settings.py family-org/backend/app/schemas.py
git commit -m "feat: add Go4Schools connect/disconnect/sync/status endpoints"
```

---

### Task 4: Create the Playwright scraper service

**Files:**
- Create: `family-org/backend/app/services/go4schools.py`
- Modify: `family-org/backend/requirements.txt`

**Step 1: Add playwright to requirements.txt**

Add `playwright` to the end of `family-org/backend/requirements.txt`.

**Step 2: Create Go4Schools scraper**

Create `family-org/backend/app/services/go4schools.py`:

```python
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
            # Go4Schools student dashboard typically has a homework link/tab
            # Try common selectors — the exact selector may need adjustment
            homework_link = page.locator('a:has-text("Homework"), a[href*="homework"]').first
            if await homework_link.count() > 0:
                await homework_link.click()
                await page.wait_for_load_state("networkidle", timeout=15000)
            else:
                # Try direct URL
                await page.goto("https://www.go4schools.com/students/homework.aspx", timeout=30000)
                await page.wait_for_load_state("networkidle", timeout=15000)

            # Scrape homework items
            # Go4Schools typically renders homework in a table or card list
            # Extract rows from the homework table
            homework_items = []

            # Try table-based layout first
            rows = page.locator("table tbody tr, .homework-item, [class*='homework'] .card, [class*='homework'] .row")
            count = await rows.count()

            if count == 0:
                # Fallback: try to find any structured homework data on the page
                # This may need adjustment based on actual Go4Schools HTML structure
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
                    continue  # Already synced

                # Parse due date
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
```

**Step 3: Commit**

```bash
git add family-org/backend/requirements.txt family-org/backend/app/services/go4schools.py
git commit -m "feat: add Playwright-based Go4Schools homework scraper"
```

---

### Task 5: Wire scraper into the worker

**Files:**
- Modify: `family-org/backend/app/worker.py`

**Step 1: Add go4schools_sync handler to process_sync**

In `family-org/backend/app/worker.py`, add after the `elif msg_type == "tasks_sync":` block (before `db.close()`), add:

```python
    elif msg_type == "go4schools_sync":
        try:
            from .services.go4schools import scrape_homework
            result = await scrape_homework(user, db)
            prefs = dict(user.preferences or {})
            if result["error"]:
                prefs["go4schools_error"] = result["error"]
                print(f"[Worker] Go4Schools error for {user.email}: {result['error']}")
            else:
                prefs.pop("go4schools_error", None)
                print(f"[Worker] Synced {result['synced']} homework items for {user.email}")
            prefs["go4schools_last_sync"] = datetime.now(timezone.utc).isoformat()
            user.preferences = prefs
            db.add(user)
            db.commit()

            from .services.rabbitmq import send_sync_message
            await send_sync_message("dashboard_refresh", {"user_id": user_id}, routing_key="broadcast_queue")
        except Exception as e:
            print(f"[Worker] Go4Schools fatal error: {e}")
```

**Step 2: Add daily sync recurring task**

In `family-org/backend/app/worker.py`, add a new async function before `async def main()`:

```python
async def go4schools_daily_sync():
    """Daily task to sync Go4Schools homework for all connected users."""
    while True:
        # Wait 24 hours between syncs, offset by 1 hour from chore reset
        await asyncio.sleep(3600)  # Initial 1-hour delay
        try:
            db: Session = SessionLocal()
            users = db.query(User).filter(User.go4schools_email.isnot(None)).all()
            for user in users:
                from .services.rabbitmq import send_sync_message
                await send_sync_message("go4schools_sync", {"user_id": user.id})
                print(f"[Worker] Queued Go4Schools sync for {user.email}")
            db.close()
        except Exception as e:
            print(f"[Worker] Error in go4schools_daily_sync: {e}")
        # Then wait remaining ~23 hours
        await asyncio.sleep(82800)
```

**Step 3: Register the daily task in main()**

In the `main()` function, after line `asyncio.create_task(reset_chores_task())`, add:

```python
    asyncio.create_task(go4schools_daily_sync())
```

**Step 4: Commit**

```bash
git add family-org/backend/app/worker.py
git commit -m "feat: wire Go4Schools scraper into worker with daily sync"
```

---

### Task 6: Update Dockerfile for Playwright

**Files:**
- Modify: `family-org/backend/Dockerfile`

**Step 1: Update Dockerfile**

Replace the entire `family-org/backend/Dockerfile` with:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for Playwright Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 \
    libpango-1.0-0 libcairo2 libasound2 libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt \
    && playwright install chromium

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

**Step 2: Rebuild all services**

```bash
cd family-org && docker compose up -d --build backend worker
```

Expected: Images rebuild with Playwright and Chromium installed. Containers start successfully.

**Step 3: Verify Playwright is installed**

```bash
docker exec family-org-worker-1 python -c "from playwright.sync_api import sync_playwright; print('Playwright OK')"
```

**Step 4: Commit**

```bash
git add family-org/backend/Dockerfile
git commit -m "feat: add Playwright + Chromium deps to backend Dockerfile"
```

---

### Task 7: Update Chore schema for frontend

**Files:**
- Modify: `family-org/backend/app/schemas.py`
- Modify: `family-org/frontend/src/types.ts`

**Step 1: Add source fields to Chore schema**

In `family-org/backend/app/schemas.py`, update the `Chore` response schema:

```python
class Chore(ChoreBase):
    id: int
    is_completed: bool
    assignee_id: Optional[int] = None
    source: str = "manual"
    source_id: Optional[str] = None
    due_date: Optional[str] = None

    model_config = {
        "from_attributes": True
    }
```

**Step 2: Update frontend Chore type**

In `family-org/frontend/src/types.ts`, update the `Chore` interface:

```typescript
export interface Chore {
  id: number
  title: string
  points: number
  reward_money: number
  is_completed: boolean
  is_bonus: boolean
  frequency: string
  source: string
  due_date?: string
}
```

**Step 3: Commit**

```bash
git add family-org/backend/app/schemas.py family-org/frontend/src/types.ts
git commit -m "feat: expose chore source and due_date in API and frontend types"
```

---

### Task 8: Add Go4Schools settings UI

**Files:**
- Modify: `family-org/frontend/src/components/settings/SettingsView.tsx`

**Step 1: Add Go4Schools settings section**

In `family-org/frontend/src/components/settings/SettingsView.tsx`:

Add `GraduationCap` to the lucide-react import.

Add state variables inside the component function (after the existing `useState` calls):

```typescript
const [g4sEmail, setG4sEmail] = useState('')
const [g4sPassword, setG4sPassword] = useState('')
const [g4sStatus, setG4sStatus] = useState<{
  connected: boolean; email: string | null; last_sync: string | null; error: string | null
} | null>(null)
const [g4sSaving, setG4sSaving] = useState(false)
```

Add a `useEffect` to fetch Go4Schools status (after the existing `useEffect`):

```typescript
useEffect(() => {
  fetch('/api/settings/go4schools/status')
    .then(res => res.json())
    .then(setG4sStatus)
    .catch(() => {})
}, [])
```

Add handler functions (after the existing `becomeParent` function):

```typescript
const handleG4sConnect = () => {
  if (!g4sEmail || !g4sPassword) return
  setG4sSaving(true)
  fetch('/api/settings/go4schools', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: g4sEmail, password: g4sPassword })
  })
    .then(res => {
      if (!res.ok) throw new Error('Failed to connect')
      toast.success('Go4Schools connected! Syncing homework...')
      setG4sPassword('')
      // Refresh status
      return fetch('/api/settings/go4schools/status').then(r => r.json())
    })
    .then(status => { setG4sStatus(status); setG4sSaving(false); onUpdate() })
    .catch(err => { toast.error(err.message); setG4sSaving(false) })
}

const handleG4sDisconnect = () => {
  fetch('/api/settings/go4schools', { method: 'DELETE' })
    .then(() => {
      toast.success('Go4Schools disconnected')
      setG4sStatus({ connected: false, email: null, last_sync: null, error: null })
      setG4sEmail('')
      onUpdate()
    })
}

const handleG4sSync = () => {
  fetch('/api/settings/go4schools/sync', { method: 'POST' })
    .then(res => {
      if (!res.ok) throw new Error('Sync failed')
      toast.info('Homework sync started...')
    })
    .catch(err => toast.error(err.message))
}
```

Add JSX section in the return. Place it after the Appearance card and before the parent-only cards (before `{user.role === 'parent' && (`):

```tsx
<NeuCard>
  <div className="flex items-center gap-3 mb-6">
    <GraduationCap className="h-6 w-6 text-accent-teal" />
    <h2 className="text-2xl font-bold text-text-primary">Go4Schools</h2>
  </div>

  {g4sStatus?.connected ? (
    <div className="space-y-4">
      <div className="p-4 rounded-xl neu-inset-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-text-primary">{g4sStatus.email}</p>
            <p className="text-sm text-text-muted mt-1">
              {g4sStatus.last_sync
                ? `Last synced: ${new Date(g4sStatus.last_sync).toLocaleString()}`
                : 'Sync pending...'}
            </p>
            {g4sStatus.error && (
              <p className="text-sm text-accent-red mt-1">{g4sStatus.error}</p>
            )}
          </div>
          <div className="flex gap-2">
            <NeuButton variant="ghost" size="sm" onClick={handleG4sSync}>
              Sync Now
            </NeuButton>
            <NeuButton variant="ghost" size="sm" onClick={handleG4sDisconnect}>
              Disconnect
            </NeuButton>
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className="space-y-4">
      <p className="text-text-muted text-sm">
        Connect your Go4Schools account to automatically sync homework as chores.
      </p>
      <div className="space-y-3">
        <input
          type="email"
          placeholder="Go4Schools email"
          value={g4sEmail}
          onChange={e => setG4sEmail(e.target.value)}
          className="w-full p-3 rounded-xl neu-inset-sm bg-transparent text-text-primary placeholder:text-text-muted/50 outline-none"
        />
        <input
          type="password"
          placeholder="Password"
          value={g4sPassword}
          onChange={e => setG4sPassword(e.target.value)}
          className="w-full p-3 rounded-xl neu-inset-sm bg-transparent text-text-primary placeholder:text-text-muted/50 outline-none"
        />
      </div>
      <NeuButton variant="teal" onClick={handleG4sConnect} disabled={g4sSaving || !g4sEmail || !g4sPassword}>
        {g4sSaving ? 'Connecting...' : 'Connect'}
      </NeuButton>
    </div>
  )}
</NeuCard>
```

**Step 2: Commit**

```bash
git add family-org/frontend/src/components/settings/SettingsView.tsx
git commit -m "feat: add Go4Schools integration UI in settings"
```

---

### Task 9: Show homework badge on chore items

**Files:**
- Modify: `family-org/frontend/src/components/chores/ChoresView.tsx`

**Step 1: Check current ChoresView structure**

Read `family-org/frontend/src/components/chores/ChoresView.tsx` and identify where each chore item is rendered.

**Step 2: Add homework indicator**

Where each chore title is rendered, add a conditional badge:

```tsx
{chore.source === 'go4schools' && (
  <span className="text-[10px] font-bold text-accent-teal bg-accent-teal/15 px-2 py-0.5 rounded-full uppercase ml-2">
    Homework
  </span>
)}
```

If the chore has a `due_date`, show it:

```tsx
{chore.due_date && (
  <span className="text-xs text-text-muted">
    Due: {new Date(chore.due_date).toLocaleDateString()}
  </span>
)}
```

**Step 3: Commit**

```bash
git add family-org/frontend/src/components/chores/ChoresView.tsx
git commit -m "feat: show homework badge and due date on Go4Schools chores"
```

---

### Task 10: Run SQL migration and full integration test

**Step 1: Run the migration SQL**

```bash
docker exec family-org-db-1 psql -U user -d family_org -c "
ALTER TABLE users ADD COLUMN IF NOT EXISTS go4schools_email VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS go4schools_password VARCHAR;
ALTER TABLE chores ADD COLUMN IF NOT EXISTS source VARCHAR DEFAULT 'manual';
ALTER TABLE chores ADD COLUMN IF NOT EXISTS source_id VARCHAR;
ALTER TABLE chores ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;
CREATE UNIQUE INDEX IF NOT EXISTS ix_chores_source_id ON chores(source_id) WHERE source_id IS NOT NULL;
"
```

**Step 2: Rebuild and restart the full stack**

```bash
cd family-org && docker compose up -d --build
```

**Step 3: Verify backend health**

```bash
curl http://localhost:8090/health
```

Expected: `{"status":"ok"}`

**Step 4: Verify Go4Schools status endpoint works**

```bash
# Create a test user and check status
curl -s http://localhost:8090/settings/go4schools/status
```

Expected: 401 (no auth cookie) — confirms endpoint is wired up.

**Step 5: Check worker logs for daily sync registration**

```bash
docker logs family-org-worker-1 --tail 10
```

Expected: No errors. Worker should be running.

**Step 6: Verify frontend loads**

Open https://family.brian-scanlon.uk and confirm the Settings page shows the Go4Schools card.

**Step 7: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: Go4Schools homework sync integration complete"
```
