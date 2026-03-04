# Kiosk Task Card Frequency Tabs & Auto-Rotation

**Date:** 2026-03-04
**Status:** Approved

## Goal

Split each kiosk dashboard task card (Evelyn, Rafe, Family Tasks) into Daily, Weekly and Monthly frequency tabs that auto-rotate, with a vertical scroll ticker for lists that overflow the card height. Fully hands-free, display-only, pure CSS — no JavaScript.

## Current State

- Kiosk endpoint: `GET /api/dashboard/kiosk` in `family-org/backend/app/routers/dashboard.py`
- Each child card groups chores by roster name
- Family Tasks card shows unassigned chores
- Chores already have a `frequency` field: "daily", "weekly", "monthly", "once"
- Server-rendered HTML with inline CSS, no JS, auto-refreshes every 60s

## Design

### Per-Card Structure

Each card (child or family) contains:

1. **Header** — name, progress count, progress bar (unchanged)
2. **Tab bar** — three pills: Daily, Weekly, Monthly
3. **Tab panels** — one per frequency, each containing roster-grouped chore lists
4. **Active tab highlight** — the currently visible tab pill is visually highlighted

If a frequency has no chores for that card, that tab is skipped in the rotation.

### Tab Auto-Rotation

- Pure CSS `@keyframes` cycling through opacity on each tab panel
- Cycle: ~10 seconds per tab, 30 seconds total loop
- Each card gets a slight `animation-delay` offset so they don't all switch in unison
- Tab pills also animate to show which is active (matching opacity/color keyframes)

### Vertical Scroll Ticker (Overflow)

When a tab's chore list exceeds the card's available height:

- Server-side: if item count exceeds a threshold (e.g. 6 items), duplicate the list HTML inside a ticker wrapper
- CSS `@keyframes` scrolls the ticker upward using `translateY`
- Speed: ~30px/sec (gentle, readable)
- `overflow: hidden` on the card body clips the content
- Short lists don't get the ticker wrapper — they display statically

### Card Height

- Cards get a fixed `max-height` to prevent layout expansion
- This is the trigger for the ticker: content taller than max-height scrolls

### Progress Count

- The header progress count (e.g. "3/7") reflects all frequencies combined, not just the active tab

## Data Flow

Server-side Python changes in `kiosk_dashboard()`:

1. When building each child's roster chore list, group chores by `frequency` within each roster
2. Generate three tab panels per card (daily, weekly, monthly)
3. Within each panel, show roster groups containing only chores of that frequency
4. Track which frequencies have chores to determine which tabs to include
5. Generate inline CSS keyframes tailored to the number of active tabs per card
6. For ticker: count items per tab, duplicate HTML and add ticker class if threshold exceeded

## Files to Modify

- `family-org/backend/app/routers/dashboard.py` — kiosk endpoint HTML generation

## Constraints

- No JavaScript (Raspberry Pi 1B, server-rendered HTML only)
- No external resources (inline CSS only)
- Must not break existing layout (sidebar, summary strip, alerts)
- `overflow: hidden` on body already set — cards must stay within viewport
