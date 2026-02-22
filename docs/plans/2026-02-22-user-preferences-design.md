# User Preferences & Dark/Light Theme Toggle

**Date:** 2026-02-22
**Status:** Approved

## Overview

Per-user persistent preferences system, starting with a dark/light mode toggle. Preferences stored as a JSON column on the User model for flexibility. Theme switching via CSS variable overrides triggered by a class on `<html>`.

## Decisions

- **Auth scope:** Logged-in users only. Unauthenticated users see default dark theme.
- **Storage:** JSON column (`preferences`) on User model. Flexible for future settings without schema changes.
- **Theme approach:** React Context + CSS class toggle. Swap CSS variables under `.light` class — zero component changes needed since the entire design system uses CSS variables.
- **Light theme style:** Neumorphic light — same shadow/depth language, inverted palette.

## Backend

### User Model

Add `preferences` column (JSON, default `{}`):

```python
preferences = Column(JSON, default=dict, nullable=False, server_default="{}")
```

### API Endpoints

**`GET /api/settings/preferences`** — Returns user's preferences object.

**`PATCH /api/settings/preferences`** — Accepts partial JSON, merges into existing preferences, returns updated result.

**`GET /api/auth/me`** — Include `preferences` in response so frontend can hydrate on login.

## Frontend

### ThemeProvider Context (`src/contexts/ThemeContext.tsx`)

- Provides `theme` ("dark" | "light") and `toggleTheme()`
- On mount, reads from user object (fetched via `/auth/me`)
- On toggle: updates `<html>` class + calls PATCH endpoint
- Default: "dark"

### CSS Variables (`index.css`)

Current `:root` stays as dark theme. Add `.light` override block:

| Variable | Dark | Light |
|----------|------|-------|
| neu-base | #1e1e22 | #d8d8dc |
| neu-dark | #151518 | #b8b8bc |
| neu-light | #27272c | #ffffff |
| text-primary | #e4e4e7 | #1e1e22 |
| text-secondary | #a1a1aa | #52525b |
| text-muted | #71717a | #71717a |
| Accents | unchanged | unchanged |

### UI Integration

- **Settings page:** Theme toggle using NeuButton (dark/light options)
- **Navbar:** Sun/moon icon for quick toggle access

## Data Flow

```
Login → GET /auth/me → preferences.theme → ThemeProvider sets <html> class
Toggle → ThemeProvider updates class + state → PATCH /settings/preferences
```
