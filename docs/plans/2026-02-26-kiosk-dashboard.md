# Kiosk Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a server-rendered HTML kiosk endpoint that Raspberry Pi 1B devices can display on 1080p TVs, auto-refreshing every 60 seconds.

**Architecture:** A single new endpoint `/api/dashboard/kiosk` in the existing dashboard router. It queries the same data as the React dashboard (family overview, league table, events, alerts) and returns a self-contained HTML page with inline CSS. No JavaScript, no external resources. Dark theme optimised for always-on TV display.

**Tech Stack:** FastAPI, SQLAlchemy, Python f-strings for HTML templating, inline CSS.

---

### Task 1: Add the kiosk endpoint with summary data

**Files:**
- Modify: `family-org/backend/app/routers/dashboard.py`
- Test: `family-org/tests/test_e2e.py`

**Step 1: Write the failing test**

Add to `test_e2e.py`:

```python
def test_kiosk_dashboard_returns_html(self):
    response = requests.get(f"{self.BACKEND_URL}/dashboard/kiosk")
    self.assertEqual(response.status_code, 200)
    self.assertIn("text/html", response.headers["content-type"])
    self.assertIn("The Scanlon Plan", response.text)
    self.assertIn('<meta http-equiv="refresh" content="60">', response.text)
```

**Step 2: Run test to verify it fails**

Run: `cd family-org && docker compose exec backend python -m pytest tests/test_e2e.py::TestFamilyOrgEndToEnd::test_kiosk_dashboard_returns_html -v`
Expected: FAIL (404 or AttributeError)

**Step 3: Write the kiosk endpoint**

Add to `dashboard.py` (before the ConnectionManager class, after the existing endpoints). Add `from datetime import datetime` and `from fastapi.responses import HTMLResponse` to the imports, and add `Roster, RosterAssignment, ChoreCompletion` to the models import.

```python
@router.get("/kiosk", response_class=HTMLResponse)
def kiosk_dashboard(db: Session = Depends(get_db)):
    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    date_str = now.strftime("%A %-d %B")

    # --- Summary data ---
    children = db.query(User).filter(User.role != "parent").all()
    total_chores = 0
    total_completed = 0
    total_balance = 0.0

    child_sections = []
    for child in children:
        color = (child.preferences or {}).get("color", "#6366f1")
        assignments = db.query(RosterAssignment).filter(
            RosterAssignment.user_id == child.id
        ).all()
        child_rosters_html = ""
        child_done = 0
        child_total = 0
        for a in assignments:
            roster = db.query(Roster).filter(Roster.id == a.roster_id).first()
            if not roster:
                continue
            chores = db.query(Chore).filter(Chore.roster_id == roster.id).all()
            chore_rows = ""
            for c in chores:
                comp = db.query(ChoreCompletion).filter(
                    ChoreCompletion.chore_id == c.id,
                    ChoreCompletion.user_id == child.id,
                    ChoreCompletion.completed_at >= today_start
                ).first()
                is_done = comp is not None
                if is_done:
                    child_done += 1
                child_total += 1
                icon = "&#10003;" if is_done else "&#9675;"
                style = "opacity:0.5;text-decoration:line-through" if is_done else ""
                chore_rows += f'<div class="chore-row" style="{style}"><span class="chore-icon">{icon}</span> {_esc(c.title)}</div>\n'
            child_rosters_html += f'<div class="roster-label">{_esc(roster.name)}</div>\n{chore_rows}'

        total_chores += child_total
        total_completed += child_done
        total_balance += child.balance or 0

        pct = int(child_done / child_total * 100) if child_total > 0 else 0
        child_sections.append(
            f'<div class="card child-card">'
            f'<div class="child-header" style="border-color:{color}">'
            f'<span class="child-name">{_esc(child.name)}</span>'
            f'<span class="child-progress">{child_done}/{child_total}</span></div>'
            f'<div class="progress-bar"><div class="progress-fill" style="width:{pct}%;background:{color}"></div></div>'
            f'{child_rosters_html}</div>'
        )

    # --- Events ---
    events = db.query(Event).order_by(Event.start_time).all()
    upcoming = [e for e in events if e.start_time >= now.isoformat()][:5]
    events_html = ""
    for e in upcoming:
        try:
            dt = datetime.fromisoformat(e.start_time)
            time_str = dt.strftime("%-d %b %-I:%M%p").lower()
        except (ValueError, TypeError):
            time_str = e.start_time
        user = db.query(User).filter(User.id == e.user_id).first()
        loc = f' &middot; {_esc(e.location)}' if e.location else ""
        name = f' <span class="event-who">({_esc(user.name)})</span>' if user else ""
        events_html += f'<div class="event-row"><span class="event-time">{time_str}</span> {_esc(e.summary)}{name}{loc}</div>\n'
    if not events_html:
        events_html = '<div class="empty">No upcoming events</div>'

    # --- League table ---
    league = get_league_table(db)
    league_html = ""
    for i, entry in enumerate(league):
        rank = i + 1
        league_html += (
            f'<div class="league-row">'
            f'<span class="rank">#{rank}</span>'
            f'<span class="league-name">{_esc(entry["name"])}</span>'
            f'<span class="league-pts">{entry["total_points"]} pts</span>'
            f'</div>\n'
        )

    # --- Alerts (all non-dismissed, for all users) ---
    alerts = db.query(Alert).filter(Alert.is_dismissed == False).order_by(Alert.created_at.desc()).limit(3).all()
    alerts_html = ""
    for a in alerts:
        alerts_html += f'<div class="alert-row">{_esc(a.message)}</div>\n'

    # --- Events today count ---
    today_end = today_start.replace(hour=23, minute=59, second=59)
    today_iso = today_start.isoformat()
    today_end_iso = today_end.isoformat()
    events_today = len([e for e in events if today_iso <= e.start_time <= today_end_iso])

    children_grid = "\n".join(child_sections)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1920">
<meta http-equiv="refresh" content="60">
<title>The Scanlon Plan</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{background:#0f172a;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif;padding:24px;min-height:100vh}}
.header{{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}}
.header h1{{font-size:28px;font-weight:700;color:#f8fafc}}
.header .date{{font-size:18px;color:#94a3b8}}
.summary-strip{{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px}}
.summary-card{{background:#1e293b;border-radius:12px;padding:16px 20px;text-align:center}}
.summary-value{{font-size:32px;font-weight:700;color:#f8fafc}}
.summary-label{{font-size:13px;color:#94a3b8;margin-top:4px;text-transform:uppercase;letter-spacing:0.05em}}
.main-grid{{display:grid;grid-template-columns:1fr 340px;gap:24px}}
.children-grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}}
.card{{background:#1e293b;border-radius:12px;padding:16px;overflow:hidden}}
.child-header{{display:flex;justify-content:space-between;align-items:center;border-top:3px solid;padding-top:8px;margin-bottom:8px}}
.child-name{{font-size:18px;font-weight:600;color:#f8fafc}}
.child-progress{{font-size:14px;color:#94a3b8}}
.progress-bar{{height:6px;background:#334155;border-radius:3px;margin-bottom:12px;overflow:hidden}}
.progress-fill{{height:100%;border-radius:3px;transition:width 0.3s}}
.roster-label{{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin:8px 0 4px}}
.chore-row{{font-size:14px;padding:3px 0;color:#cbd5e1}}
.chore-icon{{margin-right:6px}}
.sidebar{{display:flex;flex-direction:column;gap:16px}}
.section-title{{font-size:14px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px}}
.league-row{{display:flex;align-items:center;gap:8px;padding:6px 0;font-size:15px}}
.rank{{color:#64748b;min-width:28px}}
.league-name{{flex:1;color:#f8fafc}}
.league-pts{{color:#fbbf24;font-weight:600}}
.event-row{{padding:6px 0;font-size:14px;color:#cbd5e1;border-bottom:1px solid #1e293b}}
.event-time{{color:#94a3b8;margin-right:8px}}
.event-who{{color:#64748b;font-size:12px}}
.alert-bar{{background:#78350f;border:1px solid #92400e;border-radius:12px;padding:12px 16px;margin-top:24px}}
.alert-row{{font-size:14px;color:#fde68a;padding:4px 0}}
.empty{{color:#475569;font-style:italic;font-size:14px}}
</style>
</head>
<body>
<div class="header">
<h1>The Scanlon Plan</h1>
<div class="date">{date_str}</div>
</div>
<div class="summary-strip">
<div class="summary-card">
<div class="summary-value">{total_completed}/{total_chores}</div>
<div class="summary-label">Chores Done</div>
</div>
<div class="summary-card">
<div class="summary-value">{events_today}</div>
<div class="summary-label">Events Today</div>
</div>
<div class="summary-card">
<div class="summary-value">&pound;{total_balance:.2f}</div>
<div class="summary-label">Family Balance</div>
</div>
</div>
<div class="main-grid">
<div class="children-grid">
{children_grid}
</div>
<div class="sidebar">
<div class="card">
<div class="section-title">League Table</div>
{league_html if league_html else '<div class="empty">Hidden</div>'}
</div>
<div class="card">
<div class="section-title">Upcoming Events</div>
{events_html}
</div>
</div>
</div>
{f'<div class="alert-bar">{alerts_html}</div>' if alerts_html else ''}
</body>
</html>"""
    return HTMLResponse(content=html)


def _esc(text: str) -> str:
    """Escape HTML entities."""
    if not text:
        return ""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
```

**Step 4: Update imports at top of dashboard.py**

Add to existing imports:
```python
from datetime import datetime
from fastapi.responses import HTMLResponse
```

Update models import to:
```python
from ..models import User, Event, Alert, Chore, Roster, RosterAssignment, ChoreCompletion
```

**Step 5: Run test to verify it passes**

Run: `cd family-org && docker compose exec backend python -m pytest tests/test_e2e.py::TestFamilyOrgEndToEnd::test_kiosk_dashboard_returns_html -v`
Expected: PASS

**Step 6: Commit**

```bash
git add family-org/backend/app/routers/dashboard.py family-org/tests/test_e2e.py
git commit -m "feat: add server-rendered kiosk dashboard endpoint for Pi displays"
```

---

### Task 2: Manual verification and polish

**Step 1: Open the kiosk endpoint in a browser**

Navigate to `http://localhost:8090/dashboard/kiosk` and verify:
- Dark theme renders correctly
- Summary strip shows chores/events/balance
- Each child card shows with correct color and chore progress
- League table displays in sidebar
- Upcoming events list shows with times
- Alerts bar appears at bottom (if any alerts exist)
- Page auto-refreshes after 60 seconds

**Step 2: Test with empty data states**

Verify the page renders cleanly when:
- No events exist (shows "No upcoming events")
- League table is hidden by parent preference (shows "Hidden")
- No alerts exist (alert bar is hidden)
- A child has no roster assignments (card still renders, shows 0/0)

**Step 3: Commit any polish fixes**

```bash
git add family-org/backend/app/routers/dashboard.py
git commit -m "fix: polish kiosk dashboard edge cases"
```
