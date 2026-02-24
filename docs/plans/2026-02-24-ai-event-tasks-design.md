# AI Event-Driven Personal Tasks — Design

## Overview

The AI agent scans upcoming calendar events and automatically creates personal preparation tasks. For example, a "Birthday Party" event triggers "Buy birthday card" and "Buy present" chores assigned to the user, visible only to them.

## Personal Chores

Add `personal` (Boolean, default false) to the Chore model. Personal chores are only visible to their assignee. The `GET /chores/` endpoint filters: return all non-personal chores plus personal chores where `assignee_id == current_user.id`.

## AI Task Generation

New method `generate_event_tasks()` on `FamilyAIAgent`, called in the worker's hourly loop:

1. For each user, query events starting in 7-14 days (1-week lead time window)
2. For each event, send the summary to Ollama: "Given this calendar event, suggest 0-3 short preparation tasks as a JSON array"
3. Create returned tasks as personal chores: `source="ai"`, `personal=true`, `frequency="once"`, `due_date=event_date - 1 day`
4. Dedup via `source_id = hash(event_google_id + task_title)` to avoid recreating on subsequent runs

## Fallback (Ollama unavailable)

Simple keyword matching:
- "birthday" → ["Buy birthday card", "Buy present"]
- "dentist"/"doctor" → ["Prepare any paperwork or questions"]
- "meeting"/"interview" → ["Prepare notes"]

## Data Model

Chore additions:
- `personal` (Boolean, default false)

SQL migration:
```sql
ALTER TABLE chores ADD COLUMN IF NOT EXISTS personal BOOLEAN DEFAULT false;
```

## Dashboard Impact

Personal chores appear only on the assigned user's chore list. The league table counts all completed chores including personal ones.
