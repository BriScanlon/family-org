# Garmin Fitness Integration Design

**Date:** 2026-03-01
**Status:** Approved

## Goal

Display Garmin Connect activities (runs, walks, cycling, etc.) on both the React dashboard and kiosk view for multiple family members. Display only — no points or gamification.

## Approach

Use the `garminconnect` Python library (unofficial, MIT licensed) to poll activities from Garmin Connect. Follows the existing Go4Schools integration pattern throughout.

## Data Model

### New table: `garmin_activities`

| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| user_id | Integer FK → users.id | |
| garmin_activity_id | String, unique | Dedup key from Garmin |
| activity_type | String | "running", "cycling", "walking", etc. |
| name | String | User-given name e.g. "Morning Run" |
| start_time | DateTime | |
| duration_seconds | Integer | |
| distance_meters | Float, nullable | Not all activities have distance |
| calories | Integer, nullable | |
| average_hr | Integer, nullable | |
| synced_at | DateTime | When we pulled it |

### User model additions

- `garmin_email` (String, nullable)
- `garmin_password` (String, nullable) — Fernet encrypted

### Preferences keys

- `garmin_error` — last sync error message
- `garmin_last_sync` — ISO timestamp of last sync

## Backend Service

New file: `backend/app/services/garmin.py`

`sync_activities(user, db)`:
1. Decrypt stored password
2. Create `Garmin` client, login with email/password
3. Fetch activities from last 7 days via `get_activities_by_date()`
4. Dedup by `garmin_activity_id` — skip existing
5. Extract: type, name, start time, duration, distance, calories, avg HR
6. Prune activities older than 14 days
7. Return `{"synced": int, "error": str|None}`

## API Endpoints

### Settings (in `routers/settings.py`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/settings/garmin` | Connect — save encrypted creds, trigger first sync |
| DELETE | `/api/settings/garmin` | Disconnect — clear creds, delete activity data |
| POST | `/api/settings/garmin/sync` | Manual sync trigger |
| GET | `/api/settings/garmin/status` | `{connected, email, last_sync, error}` |

### Dashboard (in `routers/dashboard.py`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/dashboard/activities` | Last 7 days of activities, grouped by user |

Response shape:
```json
[
  {
    "user_id": 1,
    "user_name": "Brian",
    "color": "#6366f1",
    "activities": [
      {
        "id": 1,
        "activity_type": "running",
        "name": "Morning Run",
        "start_time": "2026-03-01T07:30:00",
        "duration_seconds": 1800,
        "distance_meters": 5000,
        "calories": 350,
        "average_hr": 145
      }
    ]
  }
]
```

## Worker Sync

### Periodic: `garmin_periodic_sync()`
- Every 12 hours, 30-minute initial offset
- Queries users with `garmin_email IS NOT NULL`
- Sends `"garmin_sync"` RabbitMQ message per user

### Event-driven: `msg_type == "garmin_sync"` in `process_sync()`
- Calls `sync_activities(user, db)`
- Updates preferences (`garmin_last_sync`, `garmin_error`)
- Broadcasts `dashboard_refresh`

Registered in `main()`: `asyncio.create_task(garmin_periodic_sync())`

## Frontend

### React Dashboard
New component: `components/dashboard/RecentActivities.tsx`
- Fetches `/api/dashboard/activities`
- Activity rows: type icon, name, duration, distance, user color pill
- Icons: Lucide `Activity`, `Bike`, `Footprints` mapped by activity_type
- Empty state when no data
- Shown on Dashboard page below existing widgets

### Types
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
```

### Settings UI
New "Garmin Connect" section in `SettingsView.tsx` after Go4Schools:
- Disconnected: email + password inputs, Connect button
- Connected: email display, last sync, error badge, Sync Now + Disconnect buttons

### Kiosk Dashboard
New "Recent Activities" section in server-rendered HTML:
- Below upcoming events in sidebar
- Activity type, name, duration, distance, user color badge
- Breathing animation for burn-in prevention
- Only shown if any family member has Garmin connected

## Migration

Alembic migration for:
- `garmin_activities` table
- `garmin_email` and `garmin_password` columns on `users`

## Dependencies

- `garminconnect` pip package added to requirements

## Risks

- Unofficial API — can break if Garmin changes backend
- Mitigated by graceful error handling + status display (same as Go4Schools)
