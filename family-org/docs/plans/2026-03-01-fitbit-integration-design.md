# Fitbit Fitness Integration Design

**Date:** 2026-03-01
**Status:** Approved

## Goal

Add Fitbit activity tracking to the family organiser, feeding into the existing unified "Recent Activities" card on both the React dashboard and kiosk.

## Approach

Use Fitbit's official OAuth 2.0 Web API to fetch activities. Unify storage by renaming `garmin_activities` to `fitness_activities` with a `source` column, so Garmin and Fitbit activities appear together.

## Prerequisites

Register a Fitbit Developer app at https://dev.fitbit.com:
- Application type: "Personal" (for family use)
- OAuth 2.0 redirect URI: `https://family.brian-scanlon.uk/api/settings/fitbit/callback`
- Required scopes: `activity`

## Data Model Changes

### Rename table: `garmin_activities` → `fitness_activities`

| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| user_id | Integer FK → users.id | |
| source | String | "garmin" or "fitbit" |
| external_activity_id | String, unique | Was garmin_activity_id |
| activity_type | String | |
| name | String | |
| start_time | DateTime | |
| duration_seconds | Integer | |
| distance_meters | Float, nullable | |
| calories | Integer, nullable | |
| average_hr | Integer, nullable | |
| synced_at | DateTime | |

### Model class rename: `GarminActivity` → `FitnessActivity`

All references updated: garmin service, worker, dashboard endpoint, frontend types.

### User model additions

- `fitbit_access_token` (String, nullable)
- `fitbit_refresh_token` (String, nullable)
- `fitbit_user_id` (String, nullable) — Fitbit's user ID from OAuth

### Preferences keys

- `fitbit_error` — last sync error
- `fitbit_last_sync` — ISO timestamp

## Config Additions

- `FITBIT_CLIENT_ID`
- `FITBIT_CLIENT_SECRET`
- `FITBIT_REDIRECT_URI`

## OAuth 2.0 Flow

1. User clicks "Connect Fitbit" → GET `/settings/fitbit/login`
2. Backend generates PKCE code_verifier/challenge, stores in session/preferences
3. Redirects to `https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=...&scope=activity&code_challenge=...`
4. User approves → redirected to `/settings/fitbit/callback?code=...`
5. Backend exchanges code for access_token + refresh_token
6. Tokens stored on User model, triggers first sync
7. Redirects user back to settings page

## API Endpoints

### Settings (in `routers/settings.py`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/settings/fitbit/login` | Generate PKCE, redirect to Fitbit auth |
| GET | `/settings/fitbit/callback` | Exchange code for tokens, trigger sync |
| DELETE | `/settings/fitbit` | Disconnect — clear tokens, delete activities |
| POST | `/settings/fitbit/sync` | Manual sync trigger |
| GET | `/settings/fitbit/status` | `{connected, last_sync, error}` |

### Dashboard

Existing `GET /dashboard/activities` updated to query `fitness_activities` table (already serves both sources).

## Sync Service

New file: `services/fitbit.py`

`sync_activities(user, db)`:
1. Check access token, refresh if expired via POST to `/oauth2/token`
2. GET `/1/user/-/activities/list.json?afterDate=<7d_ago>&sort=desc&limit=50`
3. Dedup by `external_activity_id` with `source="fitbit"`
4. Map fields: `activityName`→name, `duration`(ms)→duration_seconds, `distance`(convert units)→distance_meters, `caloriesBurned`→calories
5. Prune >14 days old
6. Return `{"synced": int, "error": str|None}`

## Worker

- `fitbit_sync` message handler in `process_sync()` (same pattern as Garmin)
- `fitbit_periodic_sync()` every 12 hours, 45-minute initial offset
- Registered in `main()`

## Frontend

### Settings UI
- "Fitbit" section in SettingsView.tsx
- Disconnected: "Connect Fitbit" button → navigates to `/api/settings/fitbit/login`
- Connected: last sync, error, Sync Now, Disconnect

### Dashboard & Kiosk
- No new components — existing RecentActivities and kiosk section query the unified endpoint
- Rename `GarminActivity` → `FitnessActivity` in types.ts

## Risks

- Fitbit API rate limit: 150 calls/hour per user (generous for 2x/day sync)
- Official API — much more stable than Garmin's unofficial library
