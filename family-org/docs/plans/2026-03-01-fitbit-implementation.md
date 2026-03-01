# Fitbit Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Fitbit OAuth 2.0 activity tracking, unifying storage with Garmin into a single `fitness_activities` table.

**Architecture:** Fitbit uses OAuth 2.0 Authorization Code Grant with PKCE. Users click "Connect Fitbit" → redirect to Fitbit → callback with auth code → exchange for tokens. Activities fetched via REST API, stored in unified table alongside Garmin data.

**Tech Stack:** Fitbit Web API (OAuth 2.0), httpx (already installed), FastAPI, SQLAlchemy, React/TypeScript

---

### Task 1: Add Fitbit config settings

**Files:**
- Modify: `backend/app/config.py`
- Modify: `docker-compose.yml`
- Modify: `.env` (if exists)

**Step 1: Add Fitbit settings to config.py**

In `backend/app/config.py`, after `OLLAMA_MODEL` (line 13), add:

```python
    FITBIT_CLIENT_ID: str = os.getenv("FITBIT_CLIENT_ID", "")
    FITBIT_CLIENT_SECRET: str = os.getenv("FITBIT_CLIENT_SECRET", "")
    FITBIT_REDIRECT_URI: str = os.getenv("FITBIT_REDIRECT_URI", "http://localhost:8090/settings/fitbit/callback")
```

**Step 2: Add Fitbit env vars to docker-compose.yml**

In `docker-compose.yml`, add to both `backend` and `worker` environment sections:

```yaml
      - FITBIT_CLIENT_ID=${FITBIT_CLIENT_ID}
      - FITBIT_CLIENT_SECRET=${FITBIT_CLIENT_SECRET}
      - FITBIT_REDIRECT_URI=${PUBLIC_URL}/api/settings/fitbit/callback
```

**Step 3: Commit**

```bash
git add backend/app/config.py docker-compose.yml
git commit -m "feat(fitbit): add Fitbit OAuth config settings"
```

---

### Task 2: Migrate GarminActivity → FitnessActivity (unified table)

**Files:**
- Modify: `backend/app/models.py`

**Step 1: Rename model and add source column**

In `backend/app/models.py`, replace the entire `GarminActivity` class (lines 134-149) with:

```python
class FitnessActivity(Base):
    __tablename__ = "fitness_activities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    source = Column(String, nullable=False, default="garmin")  # "garmin" or "fitbit"
    external_activity_id = Column(String, unique=True, index=True, nullable=False)
    activity_type = Column(String, nullable=False)
    name = Column(String, nullable=False)
    start_time = Column(DateTime, nullable=False)
    duration_seconds = Column(Integer, nullable=False)
    distance_meters = Column(Float, nullable=True)
    calories = Column(Integer, nullable=True)
    average_hr = Column(Integer, nullable=True)
    synced_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="fitness_activities")
```

**Step 2: Update User relationship**

Change `garmin_activities` relationship (line 32) to:

```python
    fitness_activities = relationship("FitnessActivity", back_populates="user", cascade="all, delete-orphan")
```

**Step 3: Add Fitbit token fields to User**

After `garmin_password` (line 26), add:

```python
    fitbit_access_token = Column(String, nullable=True)
    fitbit_refresh_token = Column(String, nullable=True)
    fitbit_user_id = Column(String, nullable=True)
```

**Step 4: Migrate the database table**

```bash
docker exec family-org-db-1 psql -U user -d family_org -p 5432 -c "
ALTER TABLE garmin_activities RENAME TO fitness_activities;
ALTER TABLE fitness_activities RENAME COLUMN garmin_activity_id TO external_activity_id;
ALTER TABLE fitness_activities ADD COLUMN IF NOT EXISTS source VARCHAR NOT NULL DEFAULT 'garmin';
ALTER TABLE users ADD COLUMN IF NOT EXISTS fitbit_access_token VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fitbit_refresh_token VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fitbit_user_id VARCHAR;
"
```

**Step 5: Verify**

```bash
docker exec family-org-backend-1 python -c "from app.models import FitnessActivity; print('Model OK')"
```

**Step 6: Commit**

```bash
git add backend/app/models.py
git commit -m "feat(fitbit): rename GarminActivity to FitnessActivity, add source column and Fitbit tokens"
```

---

### Task 3: Update Garmin service to use FitnessActivity

**Files:**
- Modify: `backend/app/services/garmin.py`

**Step 1: Update all GarminActivity references**

In `backend/app/services/garmin.py`:

- Line 6: Change `from ..models import GarminActivity, User` to `from ..models import FitnessActivity, User`
- Line 43: Change `db.query(GarminActivity)` to `db.query(FitnessActivity)`
- Line 43: Change `.filter(GarminActivity.garmin_activity_id == garmin_id)` to `.filter(FitnessActivity.external_activity_id == garmin_id)`
- Line 69: Change `GarminActivity(` to `FitnessActivity(`
- Line 71: Change `garmin_activity_id=garmin_id,` to `source="garmin", external_activity_id=garmin_id,`
- Line 85: Change `db.query(GarminActivity).filter(GarminActivity.user_id` to `db.query(FitnessActivity).filter(FitnessActivity.user_id == user.id, FitnessActivity.source == "garmin",`
- Line 87: Change `GarminActivity.start_time < cutoff,` to `FitnessActivity.start_time < cutoff,`

**Step 2: Commit**

```bash
git add backend/app/services/garmin.py
git commit -m "refactor(garmin): update service to use unified FitnessActivity model"
```

---

### Task 4: Update dashboard endpoint and kiosk to use FitnessActivity

**Files:**
- Modify: `backend/app/routers/dashboard.py`

**Step 1: Update model import**

Change `GarminActivity` to `FitnessActivity` in the models import line (line 11).

**Step 2: Update /activities endpoint**

In the `get_activities` function (lines 121-152), replace all `GarminActivity` references with `FitnessActivity`. Update the docstring to say "fitness activities" instead of "Garmin activities".

**Step 3: Update kiosk query**

Find the kiosk Garmin activities query (`db.query(GarminActivity)`) and replace `GarminActivity` with `FitnessActivity`.

**Step 4: Commit**

```bash
git add backend/app/routers/dashboard.py
git commit -m "refactor(fitness): update dashboard endpoints to use unified FitnessActivity"
```

---

### Task 5: Update Garmin settings endpoints to use FitnessActivity

**Files:**
- Modify: `backend/app/routers/settings.py`

**Step 1: Update disconnect_garmin**

In `disconnect_garmin` (line 136), change:
```python
    from ..models import GarminActivity
```
to:
```python
    from ..models import FitnessActivity
```

And change the delete query (line 143):
```python
    db.query(FitnessActivity).filter(FitnessActivity.user_id == current_user.id, FitnessActivity.source == "garmin").delete()
```

**Step 2: Commit**

```bash
git add backend/app/routers/settings.py
git commit -m "refactor(garmin): update settings to use FitnessActivity with source filter"
```

---

### Task 6: Create Fitbit sync service

**Files:**
- Create: `backend/app/services/fitbit.py`

**Step 1: Create the service**

Create `backend/app/services/fitbit.py`:

```python
from datetime import datetime, timedelta

import httpx
from sqlalchemy.orm import Session

from ..models import FitnessActivity, User
from ..config import settings


async def _refresh_token(user: User, db: Session) -> str | None:
    """Refresh Fitbit access token. Returns new access token or None."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.fitbit.com/oauth2/token",
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": user.fitbit_refresh_token,
                    "client_id": settings.FITBIT_CLIENT_ID,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                auth=(settings.FITBIT_CLIENT_ID, settings.FITBIT_CLIENT_SECRET),
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            user.fitbit_access_token = data["access_token"]
            user.fitbit_refresh_token = data["refresh_token"]
            db.add(user)
            db.commit()
            return data["access_token"]
    except Exception:
        return None


async def sync_activities(user: User, db: Session) -> dict:
    """Sync Fitbit activities for a user.

    Fetches activities from the last 7 days, deduplicates by external_activity_id,
    and prunes activities older than 14 days.

    Returns dict with keys: synced (int), error (str|None)
    """
    try:
        token = user.fitbit_access_token

        # Fetch activities
        after_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.fitbit.com/1/user/-/activities/list.json",
                params={
                    "afterDate": after_date,
                    "sort": "desc",
                    "limit": 50,
                    "offset": 0,
                },
                headers={"Authorization": f"Bearer {token}"},
            )

            # Refresh token if expired
            if resp.status_code == 401:
                token = await _refresh_token(user, db)
                if not token:
                    return {"synced": 0, "error": "Fitbit token refresh failed. Please reconnect."}
                resp = await client.get(
                    "https://api.fitbit.com/1/user/-/activities/list.json",
                    params={
                        "afterDate": after_date,
                        "sort": "desc",
                        "limit": 50,
                        "offset": 0,
                    },
                    headers={"Authorization": f"Bearer {token}"},
                )

            if resp.status_code != 200:
                return {"synced": 0, "error": f"Fitbit API error: {resp.status_code}"}

            data = resp.json()

        activities = data.get("activities", [])
        synced = 0

        for act in activities:
            log_id = str(act.get("logId", ""))
            if not log_id:
                continue

            existing = (
                db.query(FitnessActivity)
                .filter(FitnessActivity.external_activity_id == log_id)
                .first()
            )
            if existing:
                continue

            # Parse start time
            start_time_str = act.get("startTime") or act.get("originalStartTime")
            start_time = None
            if start_time_str:
                try:
                    start_time = datetime.fromisoformat(start_time_str.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    try:
                        start_time = datetime.strptime(start_time_str[:19], "%Y-%m-%dT%H:%M:%S")
                    except (ValueError, TypeError):
                        continue

            # Duration is in milliseconds from Fitbit
            duration_ms = act.get("duration", 0)
            duration_seconds = int(duration_ms / 1000) if duration_ms else 0

            # Distance: Fitbit returns in km by default
            distance_km = act.get("distance")
            distance_meters = float(distance_km) * 1000 if distance_km else None

            record = FitnessActivity(
                user_id=user.id,
                source="fitbit",
                external_activity_id=log_id,
                activity_type=act.get("activityName", "Activity").lower().replace(" ", "_"),
                name=act.get("activityName", "Activity"),
                start_time=start_time or datetime.now(),
                duration_seconds=duration_seconds,
                distance_meters=distance_meters,
                calories=act.get("caloriesBurned") or act.get("calories"),
                average_hr=None,  # Not in activity list response
            )
            db.add(record)
            synced += 1

        # Prune old Fitbit activities
        cutoff = datetime.now() - timedelta(days=14)
        db.query(FitnessActivity).filter(
            FitnessActivity.user_id == user.id,
            FitnessActivity.source == "fitbit",
            FitnessActivity.start_time < cutoff,
        ).delete(synchronize_session=False)

        db.commit()
        return {"synced": synced, "error": None}

    except Exception as e:
        db.rollback()
        return {"synced": 0, "error": str(e)[:200]}
```

**Step 2: Verify**

```bash
docker exec family-org-backend-1 python -c "from app.services.fitbit import sync_activities; print('Service OK')"
```

**Step 3: Commit**

```bash
git add backend/app/services/fitbit.py
git commit -m "feat(fitbit): create Fitbit sync service with OAuth token refresh"
```

---

### Task 7: Add Fitbit OAuth and settings endpoints

**Files:**
- Modify: `backend/app/routers/settings.py`

**Step 1: Add Fitbit endpoints**

After the existing Garmin endpoints (end of file), add:

```python
import hashlib
import base64
import secrets

@router.get("/fitbit/login")
async def fitbit_login(db: Session = Depends(get_db), current_user: User = Depends(get_me)):
    """Start Fitbit OAuth flow — redirect to Fitbit authorization page."""
    # Generate PKCE code verifier and challenge
    code_verifier = secrets.token_urlsafe(64)
    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode()).digest()
    ).rstrip(b"=").decode()

    # Store code_verifier in preferences for callback
    prefs = dict(current_user.preferences or {})
    prefs["fitbit_code_verifier"] = code_verifier
    current_user.preferences = prefs
    db.add(current_user)
    db.commit()

    from urllib.parse import urlencode
    params = urlencode({
        "response_type": "code",
        "client_id": settings.FITBIT_CLIENT_ID,
        "redirect_uri": settings.FITBIT_REDIRECT_URI,
        "scope": "activity",
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    })
    from fastapi.responses import RedirectResponse
    return RedirectResponse(f"https://www.fitbit.com/oauth2/authorize?{params}")


@router.get("/fitbit/callback")
async def fitbit_callback(code: str, db: Session = Depends(get_db), current_user: User = Depends(get_me)):
    """Fitbit OAuth callback — exchange code for tokens."""
    prefs = dict(current_user.preferences or {})
    code_verifier = prefs.pop("fitbit_code_verifier", None)
    if not code_verifier:
        raise HTTPException(status_code=400, detail="No pending Fitbit authorization")

    import httpx
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.fitbit.com/oauth2/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.FITBIT_REDIRECT_URI,
                "client_id": settings.FITBIT_CLIENT_ID,
                "code_verifier": code_verifier,
            },
            auth=(settings.FITBIT_CLIENT_ID, settings.FITBIT_CLIENT_SECRET),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail=f"Fitbit token exchange failed: {resp.text[:200]}")

    data = resp.json()
    current_user.fitbit_access_token = data["access_token"]
    current_user.fitbit_refresh_token = data["refresh_token"]
    current_user.fitbit_user_id = data.get("user_id")
    prefs.pop("fitbit_error", None)
    prefs["fitbit_last_sync"] = None
    current_user.preferences = prefs
    db.add(current_user)
    db.commit()

    # Trigger immediate sync
    await send_sync_message("fitbit_sync", {"user_id": current_user.id})

    # Redirect back to settings page
    from fastapi.responses import RedirectResponse
    return RedirectResponse(f"{settings.FRONTEND_URL}?tab=settings")


@router.delete("/fitbit")
def disconnect_fitbit(db: Session = Depends(get_db), current_user: User = Depends(get_me)):
    from ..models import FitnessActivity
    current_user.fitbit_access_token = None
    current_user.fitbit_refresh_token = None
    current_user.fitbit_user_id = None
    prefs = dict(current_user.preferences or {})
    prefs.pop("fitbit_error", None)
    prefs.pop("fitbit_last_sync", None)
    prefs.pop("fitbit_code_verifier", None)
    current_user.preferences = prefs
    db.query(FitnessActivity).filter(FitnessActivity.user_id == current_user.id, FitnessActivity.source == "fitbit").delete()
    db.add(current_user)
    db.commit()
    return {"status": "disconnected"}


@router.post("/fitbit/sync")
async def sync_fitbit(current_user: User = Depends(get_me)):
    if not current_user.fitbit_access_token:
        raise HTTPException(status_code=400, detail="Fitbit not connected")
    await send_sync_message("fitbit_sync", {"user_id": current_user.id})
    return {"status": "sync_triggered"}


@router.get("/fitbit/status")
def fitbit_status(current_user: User = Depends(get_me)):
    prefs = current_user.preferences or {}
    return {
        "connected": current_user.fitbit_access_token is not None,
        "fitbit_user_id": current_user.fitbit_user_id,
        "last_sync": prefs.get("fitbit_last_sync"),
        "error": prefs.get("fitbit_error"),
    }
```

**Step 2: Commit**

```bash
git add backend/app/routers/settings.py
git commit -m "feat(fitbit): add OAuth login/callback and settings endpoints"
```

---

### Task 8: Add Fitbit worker sync tasks

**Files:**
- Modify: `backend/app/worker.py`

**Step 1: Add fitbit_sync handler**

After the `garmin_sync` handler (after line 254), add:

```python
    elif msg_type == "fitbit_sync":
        try:
            from .services.fitbit import sync_activities
            result = await sync_activities(user, db)
            prefs = dict(user.preferences or {})
            if result["error"]:
                prefs["fitbit_error"] = result["error"]
                print(f"[Worker] Fitbit error for {user.email}: {result['error']}")
            else:
                prefs.pop("fitbit_error", None)
                print(f"[Worker] Synced {result['synced']} Fitbit activities for {user.email}")
            prefs["fitbit_last_sync"] = datetime.now(timezone.utc).isoformat()
            user.preferences = prefs
            db.add(user)
            db.commit()

            from .services.rabbitmq import send_sync_message
            await send_sync_message("dashboard_refresh", {"user_id": user_id}, routing_key="broadcast_queue")
        except Exception as e:
            print(f"[Worker] Fitbit fatal error: {e}")
```

**Step 2: Add periodic sync function**

After `garmin_periodic_sync` function (after line 308), add:

```python
async def fitbit_periodic_sync():
    """Periodic task to sync Fitbit activities for all connected users."""
    await asyncio.sleep(2700)  # 45-minute offset
    while True:
        try:
            db: Session = SessionLocal()
            users = db.query(User).filter(User.fitbit_access_token.isnot(None)).all()
            for user in users:
                from .services.rabbitmq import send_sync_message
                await send_sync_message("fitbit_sync", {"user_id": user.id})
                print(f"[Worker] Queued Fitbit sync for {user.email}")
            db.close()
        except Exception as e:
            print(f"[Worker] Error in fitbit_periodic_sync: {e}")
        await asyncio.sleep(43200)  # Every 12 hours
```

**Step 3: Register in main()**

After `asyncio.create_task(garmin_periodic_sync())` (line 329), add:

```python
    asyncio.create_task(fitbit_periodic_sync())
```

**Step 4: Commit**

```bash
git add backend/app/worker.py
git commit -m "feat(fitbit): add worker sync handler and periodic task"
```

---

### Task 9: Update frontend types

**Files:**
- Modify: `frontend/src/types.ts`

**Step 1: Rename GarminActivity to FitnessActivity**

In `frontend/src/types.ts`, rename the interface (lines 121-130):

```typescript
export interface FitnessActivity {
  id: number
  activity_type: string
  name: string
  start_time: string
  duration_seconds: number
  distance_meters: number | null
  calories: number | null
  average_hr: number | null
}
```

Update the `UserActivities` interface (line 136) to reference it:

```typescript
  activities: FitnessActivity[]
```

**Step 2: Update RecentActivities.tsx import**

No change needed — it imports `UserActivities`, not `GarminActivity` directly.

**Step 3: Commit**

```bash
git add frontend/src/types.ts
git commit -m "refactor(fitness): rename GarminActivity to FitnessActivity in frontend types"
```

---

### Task 10: Add Fitbit section to Settings UI

**Files:**
- Modify: `frontend/src/components/settings/SettingsView.tsx`

**Step 1: Add Fitbit state variables**

After the Garmin state variables (after line 31), add:

```typescript
  const [fitbitStatus, setFitbitStatus] = useState<{
    connected: boolean; fitbit_user_id: string | null; last_sync: string | null; error: string | null
  } | null>(null)
```

**Step 2: Add Fitbit status fetch**

In the useEffect that fetches Garmin status, add alongside:

```typescript
    fetch('/api/settings/fitbit/status')
      .then(res => res.json())
      .then(setFitbitStatus)
      .catch(() => {})
```

**Step 3: Add Fitbit handler functions**

After the Garmin handlers, add:

```typescript
  const handleFitbitDisconnect = () => {
    fetch('/api/settings/fitbit', { method: 'DELETE' })
      .then(() => {
        toast.info('Fitbit disconnected')
        setFitbitStatus({ connected: false, fitbit_user_id: null, last_sync: null, error: null })
      })
  }

  const handleFitbitSync = () => {
    fetch('/api/settings/fitbit/sync', { method: 'POST' })
      .then(() => toast.success('Fitbit sync triggered'))
  }
```

**Step 4: Add Fitbit UI section**

After the Garmin NeuCard section, add. Note: uses `Heart` icon from Lucide (add to imports):

```tsx
      <NeuCard>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-accent-blue/10">
            <Heart className="h-5 w-5 text-accent-blue" />
          </div>
          <h2 className="text-lg font-bold text-text-primary">Fitbit</h2>
        </div>

        {fitbitStatus?.connected ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-surface-raised border border-border-muted space-y-2">
              <p className="text-sm text-text-primary"><span className="text-text-muted">User ID:</span> {fitbitStatus.fitbit_user_id}</p>
              {fitbitStatus.last_sync && (
                <p className="text-xs text-text-muted">Last synced: {new Date(fitbitStatus.last_sync).toLocaleString()}</p>
              )}
              {fitbitStatus.error && (
                <p className="text-xs text-accent-red bg-accent-red/10 rounded-lg px-3 py-1.5 inline-block">{fitbitStatus.error}</p>
              )}
            </div>
            <div className="flex gap-3">
              <NeuButton variant="teal" size="sm" onClick={handleFitbitSync}>Sync Now</NeuButton>
              <NeuButton variant="ghost" size="sm" onClick={handleFitbitDisconnect}>Disconnect</NeuButton>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-text-muted">Connect your Fitbit account to track activities.</p>
            <NeuButton variant="teal" onClick={() => { window.location.href = '/api/settings/fitbit/login' }}>
              Connect Fitbit
            </NeuButton>
          </div>
        )}
      </NeuCard>
```

Add `Heart` to the Lucide imports at the top of the file.

**Step 5: Commit**

```bash
git add frontend/src/components/settings/SettingsView.tsx
git commit -m "feat(fitbit): add Fitbit section to settings UI"
```

---

### Task 11: Rebuild and test

**Step 1: Rebuild Docker containers**

```bash
cd /home/brian/git/family-org/family-org
docker compose down
docker compose up -d --build
```

**Step 2: Verify backend starts**

```bash
docker logs family-org-backend-1 --tail 10
```

Expected: No import errors.

**Step 3: Verify worker starts**

```bash
docker logs family-org-worker-1 --tail 10
```

**Step 4: Verify existing Garmin data still works**

```bash
curl -s http://localhost:8090/dashboard/activities | python3 -m json.tool
```

Expected: Existing Garmin activities still appear (now with `source` field).

**Step 5: Verify Fitbit endpoints exist**

```bash
curl -s http://localhost:8090/settings/fitbit/status
```

Expected: `{"detail":"Not authenticated"}` (auth required — endpoint exists).

**Step 6: Verify kiosk works**

```bash
curl -s http://localhost:8090/dashboard/kiosk | grep -c "Recent Activities"
```

Expected: 1

**Step 7: Verify frontend**

Open app in browser, check:
- Dashboard loads (existing Garmin activities still show)
- Settings shows new "Fitbit" section with "Connect Fitbit" button
- Kiosk at `/api/dashboard/kiosk` loads

**Step 8: Final commit and push**

```bash
git push
```

---

## Setup Instructions for Fitbit Developer App

Before testing the OAuth flow, register at https://dev.fitbit.com:

1. Go to https://dev.fitbit.com/apps/new
2. Application Name: "Scanlon Plan"
3. Application Type: "Personal"
4. Callback URL: `https://family.brian-scanlon.uk/api/settings/fitbit/callback`
5. Default Access Type: "Read Only"
6. OAuth 2.0 scopes: select "Activity"
7. Copy Client ID and Client Secret
8. Add to `.env`:
   ```
   FITBIT_CLIENT_ID=your_client_id
   FITBIT_CLIENT_SECRET=your_client_secret
   ```
9. Rebuild containers: `docker compose up -d --build`
