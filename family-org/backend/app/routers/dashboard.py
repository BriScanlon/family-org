from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from typing import List
import json
from ..database import get_db
from ..services.ai_agent import FamilyAIAgent
from ..models import User, Event, Alert, Chore, Roster, RosterAssignment, ChoreCompletion
from .auth import get_me

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/league-table")
def get_league_table(db: Session = Depends(get_db)):
    # Check if any parent has hidden the league table
    parents = db.query(User).filter(User.role == "parent").all()
    for parent in parents:
        prefs = parent.preferences or {}
        if prefs.get("show_league_table") is False:
            return []

    users = db.query(User).all()
    league = []
    for user in users:
        standard_completed = db.query(Chore).filter(
            Chore.assignee_id == user.id,
            Chore.is_bonus == False,
            Chore.is_completed == True
        ).count()
        
        bonus_completed = db.query(Chore).filter(
            Chore.assignee_id == user.id,
            Chore.is_bonus == True,
            Chore.is_completed == True
        ).count()
        
        league.append({
            "user_id": user.id,
            "name": user.name,
            "standard_completed": standard_completed,
            "bonus_completed": bonus_completed,
            "total_points": user.points,
            "total_balance": user.balance
        })
    
    # Sort by standard_completed then bonus_completed
    league.sort(key=lambda x: (x["standard_completed"], x["bonus_completed"]), reverse=True)
    return league

@router.get("/events")
def get_family_events(db: Session = Depends(get_db)):
    events = db.query(Event).all()
    # Join with user to get names
    results = []
    for event in events:
        user = db.query(User).filter(User.id == event.user_id).first()
        results.append({
            "id": event.id,
            "summary": event.summary,
            "start_time": event.start_time,
            "end_time": event.end_time,
            "location": event.location,
            "user_name": user.name if user else "Unknown"
        })
    return results

@router.get("/alerts")
def get_active_alerts(db: Session = Depends(get_db), current_user: User = Depends(get_me)):
    return db.query(Alert).filter(
        Alert.user_id == current_user.id,
        Alert.is_dismissed == False
    ).order_by(Alert.created_at.desc()).all()

@router.post("/alerts/{alert_id}/feedback")
def submit_alert_feedback(alert_id: int, feedback: int, db: Session = Depends(get_db)):
    agent = FamilyAIAgent(db)
    agent.learn_from_feedback(alert_id, feedback)
    
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if alert:
        alert.is_dismissed = True
        db.commit()
    return {"status": "success"}

@router.post("/alerts/{alert_id}/dismiss")
def dismiss_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if alert:
        alert.is_dismissed = True
        db.commit()
    return {"status": "success"}

@router.get("/ai-analysis/{user_id}")
def get_ai_analysis(user_id: int, db: Session = Depends(get_db)):
    agent = FamilyAIAgent(db)
    analysis = agent.analyze_user_schedule(user_id)
    return analysis

import html as _html_mod

def _esc(s: str) -> str:
    """HTML-escape user-provided text."""
    return _html_mod.escape(str(s)) if s else ""


@router.get("/kiosk", response_class=HTMLResponse)
def kiosk_dashboard(db: Session = Depends(get_db)):
    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_str = now.strftime("%Y-%m-%d")
    today_display = now.strftime("%A %d %B %Y")

    # --- Children & chore progress ---
    children = db.query(User).filter(User.role != "parent").all()
    children_data = []
    total_chores = 0
    total_done = 0

    for child in children:
        assignments = db.query(RosterAssignment).filter(RosterAssignment.user_id == child.id).all()
        child_rosters = []
        child_done = 0
        child_total = 0
        for a in assignments:
            roster = db.query(Roster).filter(Roster.id == a.roster_id).first()
            if not roster:
                continue
            chores = db.query(Chore).filter(Chore.roster_id == roster.id).all()
            roster_chores = []
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
                roster_chores.append({"title": c.title, "done": is_done})
            child_rosters.append({"name": roster.name, "chores": roster_chores})
        total_chores += child_total
        total_done += child_done
        color = (child.preferences or {}).get("color", "#6366f1")
        children_data.append({
            "name": child.name,
            "color": color,
            "done": child_done,
            "total": child_total,
            "rosters": child_rosters,
        })

    # --- League table ---
    league = get_league_table(db)

    # --- Upcoming events ---
    now_iso = now.isoformat()
    events = db.query(Event).filter(Event.start_time >= now_iso).order_by(Event.start_time).limit(5).all()

    # --- Events today count ---
    today_end_str = today_str + "T23:59:59"
    events_today_count = db.query(Event).filter(
        Event.start_time >= today_str,
        Event.start_time <= today_end_str
    ).count()

    # --- Alerts (non-dismissed, for all users) ---
    alerts = db.query(Alert).filter(Alert.is_dismissed == False).order_by(Alert.created_at.desc()).limit(3).all()

    # --- Family balance ---
    family_balance = sum(c.balance or 0.0 for c in children)

    # --- Build HTML ---
    # Children cards
    children_html = ""
    if not children_data:
        children_html = '<p style="color:#94a3b8;">No children found.</p>'
    for ch in children_data:
        pct = int(ch["done"] / ch["total"] * 100) if ch["total"] > 0 else 0
        rosters_html = ""
        for r in ch["rosters"]:
            chore_rows = ""
            for cr in r["chores"]:
                icon = "&#10003;" if cr["done"] else "&#9675;"
                icon_color = "#22c55e" if cr["done"] else "#94a3b8"
                chore_rows += (
                    f'<div style="display:flex;align-items:center;gap:8px;padding:4px 0;">'
                    f'<span style="color:{icon_color};font-size:16px;">{icon}</span>'
                    f'<span style="color:#e2e8f0;">{_esc(cr["title"])}</span>'
                    f'</div>'
                )
            rosters_html += (
                f'<div style="margin-top:8px;">'
                f'<div style="color:#94a3b8;font-size:12px;text-transform:uppercase;'
                f'letter-spacing:0.05em;margin-bottom:4px;">{_esc(r["name"])}</div>'
                f'{chore_rows}'
                f'</div>'
            )
        children_html += (
            f'<div style="background:#1e293b;border-radius:12px;overflow:hidden;">'
            f'<div style="background:{_esc(ch["color"])};padding:12px 16px;">'
            f'<span style="color:#fff;font-weight:700;font-size:18px;">{_esc(ch["name"])}</span>'
            f'<span style="color:rgba(255,255,255,0.8);float:right;font-size:14px;">'
            f'{ch["done"]}/{ch["total"]}</span>'
            f'</div>'
            f'<div style="padding:12px 16px;">'
            f'<div style="background:#334155;border-radius:6px;height:8px;overflow:hidden;margin-bottom:8px;">'
            f'<div style="background:{_esc(ch["color"])};height:100%;width:{pct}%;'
            f'border-radius:6px;transition:width 0.3s;"></div>'
            f'</div>'
            f'{rosters_html}'
            f'</div>'
            f'</div>'
        )

    # League table
    league_html = ""
    if not league:
        league_html = '<p style="color:#94a3b8;">No league data.</p>'
    for i, entry in enumerate(league):
        rank = i + 1
        league_html += (
            f'<div style="display:flex;justify-content:space-between;align-items:center;'
            f'padding:8px 0;border-bottom:1px solid #334155;">'
            f'<span style="color:#94a3b8;width:24px;">{rank}</span>'
            f'<span style="color:#e2e8f0;flex:1;">{_esc(entry["name"])}</span>'
            f'<span style="color:#fbbf24;font-weight:700;">{entry["total_points"]} pts</span>'
            f'</div>'
        )

    # Upcoming events
    events_html = ""
    if not events:
        events_html = '<p style="color:#94a3b8;">No upcoming events.</p>'
    for ev in events:
        ev_time = ""
        if ev.start_time:
            try:
                dt = datetime.fromisoformat(ev.start_time)
                ev_time = dt.strftime("%H:%M")
            except (ValueError, TypeError):
                ev_time = _esc(ev.start_time)
        loc = f' &middot; {_esc(ev.location)}' if ev.location else ""
        events_html += (
            f'<div style="padding:8px 0;border-bottom:1px solid #334155;">'
            f'<div style="color:#e2e8f0;">{_esc(ev.summary)}</div>'
            f'<div style="color:#94a3b8;font-size:13px;">{ev_time}{loc}</div>'
            f'</div>'
        )

    # Alert bar
    alert_html = ""
    if alerts:
        alert_items = ""
        for al in alerts:
            alert_items += f'<div style="padding:4px 0;">{_esc(al.message)}</div>'
        alert_html = (
            f'<div style="background:#78350f;color:#fde68a;padding:12px 24px;'
            f'text-align:center;font-size:14px;">'
            f'{alert_items}'
            f'</div>'
        )

    page = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="60">
<title>The Scanlon Plan</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box;}}
body{{background:#0f172a;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;}}
h1,h2,h3{{color:#f8fafc;}}
</style>
</head>
<body>
<div style="padding:24px 32px;">
 <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
  <h1 style="font-size:28px;">The Scanlon Plan</h1>
  <div style="color:#94a3b8;font-size:16px;">{_esc(today_display)}</div>
 </div>

 <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">
  <div style="background:#1e293b;border-radius:12px;padding:16px;text-align:center;">
   <div style="color:#94a3b8;font-size:13px;margin-bottom:4px;">Chores Done</div>
   <div style="font-size:24px;font-weight:700;color:#f8fafc;">{total_done}/{total_chores}</div>
  </div>
  <div style="background:#1e293b;border-radius:12px;padding:16px;text-align:center;">
   <div style="color:#94a3b8;font-size:13px;margin-bottom:4px;">Events Today</div>
   <div style="font-size:24px;font-weight:700;color:#f8fafc;">{events_today_count}</div>
  </div>
  <div style="background:#1e293b;border-radius:12px;padding:16px;text-align:center;">
   <div style="color:#94a3b8;font-size:13px;margin-bottom:4px;">Family Balance</div>
   <div style="font-size:24px;font-weight:700;color:#f8fafc;">&pound;{family_balance:.2f}</div>
  </div>
 </div>

 <div style="display:grid;grid-template-columns:2fr 1fr;gap:24px;">
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;align-content:start;">
   {children_html}
  </div>

  <div>
   <div style="background:#1e293b;border-radius:12px;padding:16px;margin-bottom:16px;">
    <h2 style="font-size:18px;margin-bottom:12px;">League Table</h2>
    {league_html}
   </div>

   <div style="background:#1e293b;border-radius:12px;padding:16px;">
    <h2 style="font-size:18px;margin-bottom:12px;">Upcoming Events</h2>
    {events_html}
   </div>
  </div>
 </div>
</div>

{alert_html}
</body>
</html>"""

    return HTMLResponse(content=page)


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            await connection.send_text(json.dumps(message))

import asyncio
import aio_pika
from ..config import settings

manager = ConnectionManager()

async def consume_broadcasts():
    """Background task to consume refresh signals from RabbitMQ and broadcast via WS."""
    connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
    channel = await connection.channel()
    queue = await channel.declare_queue("broadcast_queue")

    async with queue.iterator() as queue_iter:
        async for message in queue_iter:
            async with message.process():
                body = json.loads(message.body.decode())
                if body.get("type") == "dashboard_refresh":
                    await manager.broadcast({"type": "DASHBOARD_REFRESH", "user_id": body["data"]["user_id"]})

# Start the consumer in the background
@router.on_event("startup")
async def startup_event():
    asyncio.create_task(consume_broadcasts())

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
