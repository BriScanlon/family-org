# Go4Schools Homework Sync — Design

## Overview

Allow children to connect their Go4Schools account in Settings. A Playwright-based scraper logs into Go4Schools, extracts homework, and creates chores automatically. Syncs daily and on manual trigger.

## Architecture

No new Docker services. Playwright is added to the backend Dockerfile and runs inside the existing worker process. The scraper is triggered via RabbitMQ messages (same pattern as calendar/tasks sync).

```
Settings UI → POST /settings/go4schools → saves encrypted creds
                                        → sends RabbitMQ "go4schools_sync" message
Worker → receives message → launches Playwright headless browser
       → logs into Go4Schools → scrapes homework → upserts Chores
```

Daily sync: a recurring task in the worker (alongside `reset_chores_task`) iterates all users with Go4Schools credentials and triggers a sync for each.

## Data Model Changes

### User model additions
- `go4schools_email` (String, nullable) — school email address
- `go4schools_password` (String, nullable) — Fernet-encrypted at rest

### Chore model additions
- `source` (String, default "manual") — "manual" or "go4schools"
- `source_id` (String, nullable, unique) — dedup key (hash of subject+title+due_date)
- `due_date` (DateTime, nullable) — homework due date

## Encryption

Go4Schools passwords are encrypted using Python's `cryptography.fernet` module with a key derived from the app's `SECRET_KEY`. Encrypted at write time in the settings endpoint, decrypted at read time in the worker before login.

## Scraper Flow

1. Launch headless Chromium via Playwright
2. Navigate to `https://www.go4schools.com/students/`
3. Fill email field, password field on the "Sign in with GO" tab
4. Click `#go-sign-in-button`
5. Wait for navigation to the student dashboard
6. Navigate to homework section
7. Extract for each homework item: subject, title, due date, description
8. For each item, generate `source_id = hash(subject + title + due_date)`
9. Upsert as Chore: `source="go4schools"`, `frequency="once"`, `assignee_id=user.id`
10. Chores with `source="go4schools"` whose `source_id` no longer appears → mark completed

## Settings UI

New card in SettingsView (visible to all users):

- **Go4Schools** section with school icon
- Email + password input fields
- "Connect" button → saves creds, triggers immediate sync
- Status line: "Last synced: ..." or error message
- "Sync Now" button for manual trigger (only shown when connected)
- "Disconnect" button to clear credentials

## Backend Endpoints

- `POST /settings/go4schools` — save encrypted credentials, trigger sync
- `DELETE /settings/go4schools` — clear credentials
- `POST /settings/go4schools/sync` — manual sync trigger
- `GET /settings/go4schools/status` — returns connection status and last sync time

## Worker Integration

- New `go4schools_sync` case in `process_sync()` — runs the Playwright scraper for a given user
- New `go4schools_daily_sync()` recurring task — every 24h, iterates users with Go4Schools creds and sends a sync message for each

## Error Handling

- Login failure → store error in user preferences (`go4schools_error`), show in settings UI
- Scraper timeout (30s) → retry once, then store error
- Invalid credentials → clear stored password, show "re-enter password"
- Go4Schools site structure change → scraper fails gracefully, logs error, doesn't corrupt existing chores

## Dockerfile Changes

Add to backend Dockerfile:
- `pip install playwright cryptography`
- `playwright install chromium --with-deps`

This increases the image size but avoids a separate service.
