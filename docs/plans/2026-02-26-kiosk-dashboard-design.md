# Kiosk Dashboard Design

## Context

The family-org app needs a lightweight kiosk view for Raspberry Pi 1B devices (single-core ARM11 @ 700 MHz, 512 MB RAM) driving 1080p TVs on the local network. The server hosts the app; the Pi just runs a browser displaying the dashboard.

## Approach

A new FastAPI endpoint (`/api/dashboard/kiosk`) that returns a self-contained, server-rendered HTML page. No JavaScript framework, no external resources. The browser auto-refreshes every 60 seconds via `<meta http-equiv="refresh">`.

## Layout

Parent view showing the whole family's status on a dark-themed 1080p display:

- **Header**: App name ("The Scanlon Plan") + current date
- **Summary strip**: Chores done (family total), events today count, combined balance
- **Per-child chore sections**: Each child's roster progress with color-coded headers, checkmarks for completed/pending chores
- **League table**: Family standings by points
- **Upcoming events**: Next 5 events with date/time/location
- **Alerts**: Active (non-dismissed) alerts at the bottom

## Key Decisions

- **Pure HTML + inline CSS**: No JS, no external dependencies. Pi 1B browser renders static HTML only.
- **`<meta http-equiv="refresh" content="60">`**: Auto-refresh with zero client logic.
- **Dark theme**: Suited for always-on TV display.
- **Child colors**: Uses each child's `preferences.color` for section borders/headers.
- **No authentication**: Local network kiosk. Serves parent view for the whole family.
- **Single endpoint**: Queries the same data as the React dashboard, renders server-side.

## Included

- Summary stats (chores done, events today, total balance)
- Per-child chore progress with roster grouping
- League table
- Upcoming events (next 5)
- Active alerts

## Excluded

- Chore completion interaction (display only, not interactive)
- Alert feedback buttons
- Bonus chore section
- Calendar navigation
