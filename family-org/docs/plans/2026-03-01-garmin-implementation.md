# Garmin Fitness Integration - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Display Garmin Connect activities on the React dashboard and kiosk for multiple family members.

**Architecture:** Uses `garminconnect` Python library to poll activities from Garmin Connect every 12 hours. Follows the existing Go4Schools integration pattern: encrypted credentials on User model, async service, RabbitMQ worker sync, settings UI for connect/disconnect.

**Tech Stack:** garminconnect (Python), FastAPI, SQLAlchemy, React/TypeScript, server-rendered HTML (kiosk)

---

### Task 1: Add garminconnect dependency

**Files:**
- Modify: `backend/requirements.txt`

**Step 1: Add the dependency**

Add `garminconnect` after line 18 (playwright) in `backend/requirements.txt`:

```
garminconnect
```

**Step 2: Install in Docker**

Run:
```bash
cd /home/brian/git/family-org/family-org
docker exec family-org-worker-1 pip install garminconnect
docker exec family-org-backend-1 pip install garminconnect
```

**Step 3: Commit**

```bash
git add backend/requirements.txt
git commit -m "feat(garmin): add garminconnect dependency"
```

---

### Task 2: Add GarminActivity model and User fields

**Files:**
- Modify: `backend/app/models.py` (lines 24-25 for User fields, after line 130 for new model)

**Step 1: Add Garmin credential fields to User model**

In `backend/app/models.py`, after line 24 (`go4schools_password`), before line 25 (blank line), add:

```python
    garmin_email = Column(String, nullable=True)
    garmin_password = Column(String, nullable=True)  # Fernet-encrypted
```

**Step 2: Add relationship to User model**

After line 29 (`alerts = relationship(...)`), add:

```python
    garmin_activities = relationship("GarminActivity", back_populates="user", cascade="all, delete-orphan")
```

**Step 3: Add GarminActivity model**

After line 130 (end of Alert model), add:

```python

class GarminActivity(Base):
    __tablename__ = "garmin_activities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    garmin_activity_id = Column(String, unique=True, index=True, nullable=False)
    activity_type = Column(String, nullable=False)
    name = Column(String, nullable=False)
    start_time = Column(DateTime, nullable=False)
    duration_seconds = Column(Integer, nullable=False)
    distance_meters = Column(Float, nullable=True)
    calories = Column(Integer, nullable=True)
    average_hr = Column(Integer, nullable=True)
    synced_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="garmin_activities")
```

**Step 4: Run a quick import check**

```bash
docker exec family-org-backend-1 python -c "from app.models import GarminActivity; print('Model OK')"
```

**Step 5: Create the table in the database**

The table will be auto-created on next restart via `Base.metadata.create_all()`, but we can also trigger it manually:

```bash
docker exec family-org-backend-1 python -c "from app.database import init_db; init_db(); print('Tables created')"
```

**Step 6: Add the two new User columns**

Since there's no alembic, add columns manually:

```bash
docker exec family-org-db-1 psql -U user -d family_org -p 5432 -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS garmin_email VARCHAR; ALTER TABLE users ADD COLUMN IF NOT EXISTS garmin_password VARCHAR;"
```

**Step 7: Commit**

```bash
git add backend/app/models.py
git commit -m "feat(garmin): add GarminActivity model and User credential fields"
```

---

### Task 3: Add Garmin schemas

**Files:**
- Modify: `backend/app/schemas.py` (after line 36, Go4SchoolsConnect)

**Step 1: Add GarminConnect schema**

In `backend/app/schemas.py`, after line 36 (`password: str` in Go4SchoolsConnect), add:

```python

class GarminConnect(BaseModel):
    email: str
    password: str
```

**Step 2: Commit**

```bash
git add backend/app/schemas.py
git commit -m "feat(garmin): add GarminConnect schema"
```

---

### Task 4: Create Garmin sync service

**Files:**
- Create: `backend/app/services/garmin.py`

**Step 1: Create the service file**

Create `backend/app/services/garmin.py`:

```python
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from garminconnect import Garmin
from ..models import User, GarminActivity
from ..services.encryption import decrypt


async def sync_activities(user: User, db: Session) -> dict:
    """Sync Garmin Connect activities for a user. Returns {"synced": int, "error": str|None}."""
    try:
        password = decrypt(user.garmin_password)
    except Exception:
        return {"synced": 0, "error": "Could not decrypt Garmin credentials."}

    try:
        client = Garmin(user.garmin_email, password)
        client.login()
    except Exception as e:
        return {"synced": 0, "error": f"Garmin login failed: {e}"}

    try:
        end = datetime.now()
        start = end - timedelta(days=7)
        activities = client.get_activities_by_date(
            start.strftime("%Y-%m-%d"),
            end.strftime("%Y-%m-%d"),
        )
    except Exception as e:
        return {"synced": 0, "error": f"Failed to fetch activities: {e}"}

    synced = 0
    for act in activities:
        garmin_id = str(act.get("activityId", ""))
        if not garmin_id:
            continue

        exists = db.query(GarminActivity).filter(
            GarminActivity.garmin_activity_id == garmin_id
        ).first()
        if exists:
            continue

        start_time = None
        start_local = act.get("startTimeLocal")
        if start_local:
            try:
                start_time = datetime.fromisoformat(start_local)
            except (ValueError, TypeError):
                continue

        activity = GarminActivity(
            user_id=user.id,
            garmin_activity_id=garmin_id,
            activity_type=act.get("activityType", {}).get("typeKey", "other"),
            name=act.get("activityName", "Activity"),
            start_time=start_time,
            duration_seconds=int(act.get("duration", 0)),
            distance_meters=act.get("distance"),
            calories=act.get("calories"),
            average_hr=act.get("averageHR"),
        )
        db.add(activity)
        synced += 1

    # Prune activities older than 14 days
    cutoff = datetime.now() - timedelta(days=14)
    db.query(GarminActivity).filter(
        GarminActivity.user_id == user.id,
        GarminActivity.start_time < cutoff,
    ).delete(synchronize_session=False)

    db.commit()
    return {"synced": synced, "error": None}
```

**Step 2: Verify import**

```bash
docker exec family-org-backend-1 python -c "from app.services.garmin import sync_activities; print('Service OK')"
```

**Step 3: Commit**

```bash
git add backend/app/services/garmin.py
git commit -m "feat(garmin): create Garmin sync service"
```

---

### Task 5: Add Garmin settings API endpoints

**Files:**
- Modify: `backend/app/routers/settings.py` (after line 117, end of file)
- Modify: `backend/app/schemas.py` (import already added in Task 3)

**Step 1: Update import in settings.py**

In `backend/app/routers/settings.py`, modify line 7 to add GarminConnect:

```python
from ..schemas import PreferencesUpdate, Go4SchoolsConnect, GarminConnect
```

**Step 2: Add Garmin endpoints**

After line 117 (end of `go4schools_status`), add:

```python


@router.post("/garmin")
async def connect_garmin(creds: GarminConnect, db: Session = Depends(get_db), current_user: User = Depends(get_me)):
    current_user.garmin_email = creds.email
    current_user.garmin_password = encrypt(creds.password)
    prefs = dict(current_user.preferences or {})
    prefs.pop("garmin_error", None)
    prefs["garmin_last_sync"] = None
    current_user.preferences = prefs
    db.add(current_user)
    db.commit()
    await send_sync_message("garmin_sync", {"user_id": current_user.id})
    return {"status": "connected"}


@router.delete("/garmin")
def disconnect_garmin(db: Session = Depends(get_db), current_user: User = Depends(get_me)):
    from ..models import GarminActivity
    current_user.garmin_email = None
    current_user.garmin_password = None
    prefs = dict(current_user.preferences or {})
    prefs.pop("garmin_error", None)
    prefs.pop("garmin_last_sync", None)
    current_user.preferences = prefs
    db.query(GarminActivity).filter(GarminActivity.user_id == current_user.id).delete()
    db.add(current_user)
    db.commit()
    return {"status": "disconnected"}


@router.post("/garmin/sync")
async def sync_garmin(current_user: User = Depends(get_me)):
    if not current_user.garmin_email:
        raise HTTPException(status_code=400, detail="Garmin not connected")
    await send_sync_message("garmin_sync", {"user_id": current_user.id})
    return {"status": "sync_triggered"}


@router.get("/garmin/status")
def garmin_status(current_user: User = Depends(get_me)):
    prefs = current_user.preferences or {}
    return {
        "connected": current_user.garmin_email is not None,
        "email": current_user.garmin_email,
        "last_sync": prefs.get("garmin_last_sync"),
        "error": prefs.get("garmin_error"),
    }
```

**Step 3: Commit**

```bash
git add backend/app/routers/settings.py backend/app/schemas.py
git commit -m "feat(garmin): add connect/disconnect/sync/status API endpoints"
```

---

### Task 6: Add Garmin activities dashboard API endpoint

**Files:**
- Modify: `backend/app/routers/dashboard.py` (after the existing `/alerts/{alert_id}/dismiss` endpoint, before the kiosk endpoint)

**Step 1: Add the activities endpoint**

In `backend/app/routers/dashboard.py`, add the import at the top (after the existing model imports around line 5):

Add `GarminActivity` to the models import line.

Then add a new endpoint before the kiosk endpoint (before line 121 `@router.get("/kiosk"...`):

```python
@router.get("/activities")
def get_activities(db: Session = Depends(get_db)):
    """Get last 7 days of Garmin activities grouped by user."""
    from datetime import timedelta
    cutoff = datetime.now() - timedelta(days=7)
    activities = db.query(GarminActivity).filter(
        GarminActivity.start_time >= cutoff
    ).order_by(GarminActivity.start_time.desc()).all()

    grouped = {}
    for act in activities:
        uid = act.user_id
        if uid not in grouped:
            user = act.user
            grouped[uid] = {
                "user_id": uid,
                "user_name": user.name if user else "Unknown",
                "color": (user.preferences or {}).get("color", "#6366f1") if user else "#6366f1",
                "activities": [],
            }
        grouped[uid]["activities"].append({
            "id": act.id,
            "activity_type": act.activity_type,
            "name": act.name,
            "start_time": act.start_time.isoformat() if act.start_time else None,
            "duration_seconds": act.duration_seconds,
            "distance_meters": act.distance_meters,
            "calories": act.calories,
            "average_hr": act.average_hr,
        })

    return list(grouped.values())
```

**Step 2: Commit**

```bash
git add backend/app/routers/dashboard.py
git commit -m "feat(garmin): add activities dashboard API endpoint"
```

---

### Task 7: Add Garmin worker sync tasks

**Files:**
- Modify: `backend/app/worker.py`

**Step 1: Add garmin_sync handler in process_sync**

In `backend/app/worker.py`, after the `go4schools_sync` handler (after line 233), add:

```python
    elif msg_type == "garmin_sync":
        try:
            from .services.garmin import sync_activities
            result = await sync_activities(user, db)
            prefs = dict(user.preferences or {})
            if result["error"]:
                prefs["garmin_error"] = result["error"]
                print(f"[Worker] Garmin error for {user.email}: {result['error']}")
            else:
                prefs.pop("garmin_error", None)
                print(f"[Worker] Synced {result['synced']} Garmin activities for {user.email}")
            prefs["garmin_last_sync"] = datetime.now(timezone.utc).isoformat()
            user.preferences = prefs
            db.add(user)
            db.commit()

            from .services.rabbitmq import send_sync_message
            await send_sync_message("dashboard_refresh", {"user_id": user_id}, routing_key="broadcast_queue")
        except Exception as e:
            print(f"[Worker] Garmin fatal error: {e}")
```

**Step 2: Add periodic sync function**

After the `go4schools_daily_sync` function (after line 271), add:

```python
async def garmin_periodic_sync():
    """Periodic task to sync Garmin activities for all connected users."""
    await asyncio.sleep(1800)  # 30-minute offset from other tasks
    while True:
        try:
            db: Session = SessionLocal()
            users = db.query(User).filter(User.garmin_email.isnot(None)).all()
            for user in users:
                from .services.rabbitmq import send_sync_message
                await send_sync_message("garmin_sync", {"user_id": user.id})
                print(f"[Worker] Queued Garmin sync for {user.email}")
            db.close()
        except Exception as e:
            print(f"[Worker] Error in garmin_periodic_sync: {e}")
        await asyncio.sleep(43200)  # Every 12 hours
```

**Step 3: Register the task in main()**

In the `main()` function, after line 291 (`asyncio.create_task(go4schools_daily_sync())`), add:

```python
    asyncio.create_task(garmin_periodic_sync())
```

**Step 4: Commit**

```bash
git add backend/app/worker.py
git commit -m "feat(garmin): add worker sync handler and periodic task"
```

---

### Task 8: Add frontend types and fetch activities in App

**Files:**
- Modify: `frontend/src/types.ts` (after line 119)
- Modify: `frontend/src/App.tsx`

**Step 1: Add GarminActivity type**

In `frontend/src/types.ts`, after line 119 (end of FamilyChildOverview), add:

```typescript

export interface GarminActivity {
  id: number
  activity_type: string
  name: string
  start_time: string
  duration_seconds: number
  distance_meters: number | null
  calories: number | null
  average_hr: number | null
}

export interface UserActivities {
  user_id: number
  user_name: string
  color: string
  activities: GarminActivity[]
}
```

**Step 2: Add activities state and fetch in App.tsx**

In `frontend/src/App.tsx`:

Add to the imports (line 6):
```typescript
import type { User, Chore, Reward, Event, Alert, LeagueEntry, UserActivities } from './types'
```

Add state after `leagueTable` state (after line 29):
```typescript
  const [activities, setActivities] = useState<UserActivities[]>([])
```

Add to the `fetchData` Promise.all array (after the league-table fetch, line 57):
```typescript
      fetch('/api/dashboard/activities').then(res => res.json()),
```

Add to the destructuring (line 58):
```typescript
    ]).then(([userData, choresData, rewardsData, eventsData, alertsData, leagueData, activitiesData]) => {
```

Add after `setLeagueTable` (after line 64):
```typescript
      setActivities(activitiesData || [])
```

Pass to Dashboard (after line 214, the `leagueTable` prop):
```typescript
                activities={activities}
```

**Step 3: Commit**

```bash
git add frontend/src/types.ts frontend/src/App.tsx
git commit -m "feat(garmin): add frontend types and fetch activities data"
```

---

### Task 9: Create RecentActivities dashboard component

**Files:**
- Create: `frontend/src/components/dashboard/RecentActivities.tsx`
- Modify: `frontend/src/components/dashboard/Dashboard.tsx`

**Step 1: Create the component**

Create `frontend/src/components/dashboard/RecentActivities.tsx`:

```tsx
import { Activity, Bike, Footprints, Dumbbell } from 'lucide-react'
import { NeuCard } from '../ui/NeuCard'
import type { UserActivities } from '../../types'

interface RecentActivitiesProps {
  activities: UserActivities[]
}

const activityIcon = (type: string) => {
  switch (type) {
    case 'running': return Activity
    case 'cycling': return Bike
    case 'walking': case 'hiking': return Footprints
    default: return Dumbbell
  }
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function formatDistance(meters: number | null): string | null {
  if (!meters) return null
  return `${(meters / 1000).toFixed(1)} km`
}

export function RecentActivities({ activities }: RecentActivitiesProps) {
  const allActivities = activities.flatMap(u =>
    u.activities.map(a => ({ ...a, user_name: u.user_name, color: u.color }))
  ).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
    .slice(0, 5)

  if (allActivities.length === 0) return null

  return (
    <NeuCard>
      <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2 mb-4">
        <Activity className="h-4 w-4 text-accent-primary" />
        Recent Activities
      </h2>

      <div className="space-y-2">
        {allActivities.map(act => {
          const Icon = activityIcon(act.activity_type)
          const dist = formatDistance(act.distance_meters)
          return (
            <div
              key={act.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-surface-raised border border-border-muted"
            >
              <div className="p-2 rounded-lg bg-accent-primary/10">
                <Icon className="h-4 w-4 text-accent-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text-primary text-sm truncate">{act.name}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {formatDuration(act.duration_seconds)}
                  {dist && ` · ${dist}`}
                  {act.calories && ` · ${act.calories} cal`}
                </p>
              </div>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                style={{ backgroundColor: `${act.color}20`, color: act.color }}
              >
                {act.user_name.split(' ')[0]}
              </span>
            </div>
          )
        })}
      </div>
    </NeuCard>
  )
}
```

**Step 2: Wire into Dashboard**

In `frontend/src/components/dashboard/Dashboard.tsx`:

Add import (after line 3):
```typescript
import { RecentActivities } from './RecentActivities'
```

Add to imports (line 5):
```typescript
import type { User, Chore, Event, LeagueEntry, Alert, UserActivities } from '../../types'
```

Add to DashboardProps interface (after line 13, `alerts`):
```typescript
  activities: UserActivities[]
```

Add to destructured props (line 20):
```typescript
  user, chores, events, leagueTable, alerts, activities,
```

Add after UpcomingEvents (after line 57):
```tsx
      <RecentActivities activities={activities} />
```

**Step 3: Commit**

```bash
git add frontend/src/components/dashboard/RecentActivities.tsx frontend/src/components/dashboard/Dashboard.tsx
git commit -m "feat(garmin): add RecentActivities dashboard component"
```

---

### Task 10: Add Garmin section to Settings UI

**Files:**
- Modify: `frontend/src/components/settings/SettingsView.tsx`

**Step 1: Add Garmin state variables**

After the Go4Schools state variables (after line 25, `g4sSaving`), add:

```typescript
  const [garminEmail, setGarminEmail] = useState('')
  const [garminPassword, setGarminPassword] = useState('')
  const [garminStatus, setGarminStatus] = useState<{
    connected: boolean; email: string | null; last_sync: string | null; error: string | null
  } | null>(null)
  const [garminSaving, setGarminSaving] = useState(false)
```

**Step 2: Add Garmin status fetch**

In the existing `useEffect` that fetches Go4Schools status, add alongside it:

```typescript
    fetch('/api/settings/garmin/status')
      .then(res => res.json())
      .then(setGarminStatus)
      .catch(() => {})
```

**Step 3: Add Garmin handler functions**

After the Go4Schools handlers, add:

```typescript
  const handleGarminConnect = () => {
    if (!garminEmail || !garminPassword) return
    setGarminSaving(true)
    fetch('/api/settings/garmin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: garminEmail, password: garminPassword }),
    })
      .then(res => {
        if (!res.ok) throw new Error('Connection failed')
        return res.json()
      })
      .then(() => {
        toast.success('Garmin connected! Syncing activities...')
        setGarminPassword('')
        return fetch('/api/settings/garmin/status').then(r => r.json()).then(setGarminStatus)
      })
      .catch(err => toast.error(err.message))
      .finally(() => setGarminSaving(false))
  }

  const handleGarminDisconnect = () => {
    fetch('/api/settings/garmin', { method: 'DELETE' })
      .then(() => {
        toast.info('Garmin disconnected')
        setGarminStatus({ connected: false, email: null, last_sync: null, error: null })
        setGarminEmail('')
      })
  }

  const handleGarminSync = () => {
    fetch('/api/settings/garmin/sync', { method: 'POST' })
      .then(() => toast.success('Garmin sync triggered'))
  }
```

**Step 4: Add Garmin UI section**

After the Go4Schools NeuCard section (find the closing `</NeuCard>` of Go4Schools), add the Garmin section. It follows the exact same pattern as Go4Schools but with `Activity` icon from Lucide:

```tsx
      <NeuCard>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-accent-primary/10">
            <Activity className="h-5 w-5 text-accent-primary" />
          </div>
          <h2 className="text-lg font-bold text-text-primary">Garmin Connect</h2>
        </div>

        {garminStatus?.connected ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-surface-raised border border-border-muted space-y-2">
              <p className="text-sm text-text-primary"><span className="text-text-muted">Account:</span> {garminStatus.email}</p>
              {garminStatus.last_sync && (
                <p className="text-xs text-text-muted">Last synced: {new Date(garminStatus.last_sync).toLocaleString()}</p>
              )}
              {garminStatus.error && (
                <p className="text-xs text-accent-red bg-accent-red/10 rounded-lg px-3 py-1.5 inline-block">{garminStatus.error}</p>
              )}
            </div>
            <div className="flex gap-3">
              <NeuButton variant="teal" size="sm" onClick={handleGarminSync}>Sync Now</NeuButton>
              <NeuButton variant="ghost" size="sm" onClick={handleGarminDisconnect}>Disconnect</NeuButton>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <input
              type="email"
              placeholder="Garmin email"
              value={garminEmail}
              onChange={e => setGarminEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-surface-raised border border-border-muted text-text-primary text-sm focus:outline-none focus:border-accent-primary"
            />
            <input
              type="password"
              placeholder="Garmin password"
              value={garminPassword}
              onChange={e => setGarminPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-surface-raised border border-border-muted text-text-primary text-sm focus:outline-none focus:border-accent-primary"
            />
            <NeuButton variant="teal" onClick={handleGarminConnect} disabled={garminSaving}>
              {garminSaving ? 'Connecting...' : 'Connect'}
            </NeuButton>
          </div>
        )}
      </NeuCard>
```

Add `Activity` to the Lucide imports at the top of the file.

**Step 5: Commit**

```bash
git add frontend/src/components/settings/SettingsView.tsx
git commit -m "feat(garmin): add Garmin Connect section to settings"
```

---

### Task 11: Add Garmin activities to kiosk dashboard

**Files:**
- Modify: `backend/app/routers/dashboard.py` (kiosk endpoint)

**Step 1: Query Garmin activities in the kiosk endpoint**

In the kiosk endpoint function, after the events query and before the HTML generation, add a query for recent activities:

```python
    # Garmin activities (last 7 days)
    garmin_cutoff = now - timedelta(days=7)
    garmin_activities = db.query(GarminActivity).filter(
        GarminActivity.start_time >= garmin_cutoff
    ).order_by(GarminActivity.start_time.desc()).limit(5).all()
```

**Step 2: Build the activities HTML**

After the events_html generation (after line 342), add:

```python
    # Garmin activities HTML
    activities_html = ""
    if garmin_activities:
        for act in garmin_activities:
            dur_h = act.duration_seconds // 3600
            dur_m = (act.duration_seconds % 3600) // 60
            dur_str = f"{dur_h}h {dur_m}m" if dur_h > 0 else f"{dur_m}m"
            dist_str = f" &middot; {act.distance_meters / 1000:.1f} km" if act.distance_meters else ""
            cal_str = f" &middot; {act.calories} cal" if act.calories else ""
            owner_color = _safe_color((act.user.preferences or {}).get("color", "#6366f1")) if act.user else "#6366f1"
            first_name = _esc(act.user.name.split()[0]) if act.user and act.user.name else "?"
            date_str = act.start_time.strftime("%a %d %b") if act.start_time else ""
            activities_html += (
                f'<div class="event-row">'
                f'<div class="event-top">'
                f'<span class="event-summary">{_esc(act.name)}</span>'
                f'<span class="event-owner" style="background:{owner_color};">{first_name}</span>'
                f'</div>'
                f'<div class="event-time">{date_str} &middot; {dur_str}{dist_str}{cal_str}</div>'
                f'</div>'
            )
    else:
        activities_html = '<p class="empty-state">No recent activities.</p>'
```

**Step 3: Add the activities card to the sidebar**

In the kiosk HTML template, after the upcoming events sidebar card (after line 463), add:

```python
  <div class="card sidebar-card">
   <h2 class="section-title">Recent Activities</h2>
   {activities_html}
  </div>
```

**Step 4: Ensure GarminActivity is imported**

Make sure `GarminActivity` is included in the models import at the top of dashboard.py.

**Step 5: Commit**

```bash
git add backend/app/routers/dashboard.py
git commit -m "feat(garmin): add activities section to kiosk dashboard"
```

---

### Task 12: Rebuild and test

**Step 1: Rebuild Docker containers**

```bash
cd /home/brian/git/family-org/family-org
docker compose down
docker compose up -d --build
```

**Step 2: Verify backend starts**

```bash
docker logs family-org-backend-1 --tail 20
```

Expected: No import errors, FastAPI startup message.

**Step 3: Verify worker starts**

```bash
docker logs family-org-worker-1 --tail 20
```

Expected: RabbitMQ connection success, no errors.

**Step 4: Verify new API endpoints exist**

```bash
curl -s http://localhost:8000/api/settings/garmin/status | python3 -m json.tool
curl -s http://localhost:8000/api/dashboard/activities | python3 -m json.tool
```

**Step 5: Check the table was created**

```bash
docker exec family-org-db-1 psql -U user -d family_org -p 5432 -c "\d garmin_activities"
```

**Step 6: Verify frontend renders**

Open the app in browser, check:
- Dashboard loads without errors (no activities shown yet — that's correct)
- Settings page shows new "Garmin Connect" section
- Kiosk view at `/api/dashboard/kiosk` loads without errors

**Step 7: Final commit and push**

```bash
git add -A
git commit -m "feat(garmin): complete Garmin fitness integration"
git push
```
