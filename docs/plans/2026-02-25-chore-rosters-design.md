# Chore Rosters Design

**Date:** 2026-02-25
**Status:** Approved

## Problem

Currently chores are global — there's no way to assign a defined set of daily/weekly tasks to individual children. Parents need to create a reusable block of tasks, assign it to each child, and have each child independently unlock bonus jobs upon completing their assigned tasks.

## Solution

Introduce **Rosters** — named templates of standard chores that parents create once and assign to one or more children. Each child gets independent completion tracking. When a child completes all standard chores in their assigned roster(s), they individually unlock a shared pool of bonus jobs.

## Data Model

### New table: `rosters`

| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| name | String | e.g. "Weekday Chores" |
| created_by | FK users.id | Parent who created it |
| created_at | DateTime | |

### New table: `roster_assignments`

| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| roster_id | FK rosters.id | |
| user_id | FK users.id | Child assigned to this roster |

A roster can be assigned to multiple children. A child can have multiple rosters.

### Changes to `chores` table

- Add `roster_id` (Integer, FK rosters.id, nullable) — links a chore to a roster template
- Bonus chores (`is_bonus=True`) remain roster-free (`roster_id=NULL`) — they're the shared pool
- Go4Schools and AI chores remain roster-free

### New table: `chore_completions`

| Column | Type | Notes |
|--------|------|-------|
| id | Integer PK | |
| chore_id | FK chores.id | |
| user_id | FK users.id | Child who completed it |
| completed_at | DateTime | When they completed it |

This replaces the current `is_completed` / `last_completed_at` on Chore for roster chores. Each child has their own completion record per chore. Auto-reset at midnight deletes daily completion records; weekly completions reset Monday.

## Bonus Unlock Logic

A child can access bonus jobs when: all standard chores across ALL their assigned rosters are completed (i.e. they have a `chore_completions` record for today for every chore in every roster assigned to them).

Each child unlocks independently — Child A finishing their roster does not affect Child B's access.

## API Endpoints

### Roster CRUD (parent-only)
- `POST /rosters` — create roster with name
- `GET /rosters` — list all rosters with their chores and assignments
- `PUT /rosters/{id}` — update roster name
- `DELETE /rosters/{id}` — delete roster and its chores

### Roster Assignment (parent-only)
- `POST /rosters/{id}/assign` — assign roster to child(ren)
- `DELETE /rosters/{id}/assign/{user_id}` — unassign child

### Roster Chores (parent-only)
- `POST /rosters/{id}/chores` — add chore to roster
- Existing `PUT /chores/{id}` and `DELETE /chores/{id}` work for roster chores

### Child View
- `GET /chores/my` — returns chores grouped by roster with per-user completion status
- `PUT /chores/{id}/complete` — updated to create chore_completion record instead of mutating chore

### Bonus Check
- `GET /chores/bonus-unlocked` — returns whether current user has completed all roster chores

## UI Changes

### Parent: Roster Management
New section in the Chores tab (or a sub-tab). Parent can:
- Create/edit/delete rosters
- Add/remove chores within a roster
- Assign rosters to children (multi-select family members)
- See each child's progress per roster

### Child: Dashboard & Chores View
- Dashboard ChoreChecklist shows chores grouped by roster name
- Progress bar per roster
- Bonus pool section appears only when all rosters are complete (per-child)

### What stays the same
- Bonus chores remain in a shared pool (no roster_id)
- Points/balance system unchanged
- Go4Schools homework chores stay roster-free
- AI personal chores stay roster-free
- Rewards system unchanged

## Reset Behaviour

Daily chores: completion records deleted at midnight (existing worker cron job extended).
Weekly chores: completion records deleted Monday midnight.
Monthly chores: completion records deleted 1st of month.
