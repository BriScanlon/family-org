import html as _html_mod
import re
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from typing import List
import json
from ..database import get_db
from ..services.ai_agent import FamilyAIAgent
from ..models import User, Event, Alert, Chore, Roster, RosterAssignment, ChoreCompletion, GarminActivity
from .auth import get_me


def _esc(s: str) -> str:
    """HTML-escape user-provided text."""
    return _html_mod.escape(str(s)) if s else ""


def _safe_color(raw: str, default: str = "#6366f1") -> str:
    """Validate color is a hex code to prevent CSS injection."""
    if raw and re.match(r'^#[0-9a-fA-F]{3,8}$', raw):
        return raw
    return default


FREQ_LABELS = {"daily": "Daily", "weekly": "Weekly", "monthly": "Monthly"}
FREQ_ORDER = ["daily", "weekly", "monthly"]
TICKER_THRESHOLD = 6  # items before ticker activates


def _build_freq_card(card_id: str, name: str, color: str, done: int, total: int, freq_data: dict) -> str:
    """Build a child/family card with frequency tabs and optional ticker."""
    safe_color = _safe_color(color)
    pct = int(done / total * 100) if total > 0 else 0

    # Determine which frequencies have data
    active_freqs = [f for f in FREQ_ORDER if f in freq_data]
    if not active_freqs:
        return ""

    num_tabs = len(active_freqs)

    if num_tabs == 1:
        # Single frequency — no tabs, no animation
        freq = active_freqs[0]
        rosters = freq_data[freq]
        panel_content = ""
        item_count = 0
        if isinstance(rosters, list) and rosters and isinstance(rosters[0], dict) and "name" in rosters[0]:
            for r in rosters:
                chore_rows = ""
                for cr in r["chores"]:
                    icon = "&#10003;" if cr["done"] else "&#9675;"
                    done_class = " chore-done" if cr["done"] else ""
                    chore_rows += (
                        f'<div class="chore-row{done_class}">'
                        f'<span class="chore-icon{" chore-icon-done" if cr["done"] else ""}">{icon}</span>'
                        f'<span class="chore-title">{_esc(cr["title"])}</span>'
                        f'</div>'
                    )
                    item_count += 1
                panel_content += (
                    f'<div class="roster-group">'
                    f'<div class="roster-label">{_esc(r["name"])}</div>'
                    f'{chore_rows}'
                    f'</div>'
                )
        else:
            for cr in rosters:
                icon = "&#10003;" if cr["done"] else "&#9675;"
                done_class = " chore-done" if cr["done"] else ""
                panel_content += (
                    f'<div class="chore-row{done_class}">'
                    f'<span class="chore-icon{" chore-icon-done" if cr["done"] else ""}">{icon}</span>'
                    f'<span class="chore-title">{_esc(cr["title"])}</span>'
                    f'</div>'
                )
                item_count += 1

        if item_count > TICKER_THRESHOLD:
            scroll_duration = item_count * 2
            panel_content = (
                f'<div class="ticker-wrap">'
                f'<div class="ticker-content" style="animation:ticker-scroll {scroll_duration}s linear infinite;">'
                f'{panel_content}'
                f'{panel_content}'
                f'</div>'
                f'</div>'
            )

        label = FREQ_LABELS[freq]
        return (
            f'<div class="card child-card">'
            f'<div class="child-header" style="border-top-color:{safe_color};">'
            f'<span class="child-name">{_esc(name)}</span>'
            f'<span class="child-count">{done}/{total}</span>'
            f'</div>'
            f'<div class="child-body">'
            f'<div class="progress-track">'
            f'<div class="progress-fill" style="background:{safe_color};width:{pct}%;"></div>'
            f'</div>'
            f'<div class="freq-tab-bar"><span class="freq-pill" style="background:#475569;color:#f8fafc;">{label}</span></div>'
            f'{panel_content}'
            f'</div>'
            f'</div>'
        )

    tab_duration = 10  # seconds per tab
    cycle = num_tabs * tab_duration

    # Tab bar pills
    tab_pills = ""
    for i, freq in enumerate(active_freqs):
        tab_pills += (
            f'<span class="freq-pill freq-pill-{card_id}-{i}">'
            f'{FREQ_LABELS[freq]}'
            f'</span>'
        )

    # Tab panels
    panels_html = ""
    for i, freq in enumerate(active_freqs):
        rosters = freq_data[freq]
        # Build roster groups or flat list
        panel_content = ""
        item_count = 0
        if isinstance(rosters, list) and rosters and isinstance(rosters[0], dict) and "name" in rosters[0]:
            # Roster-grouped format
            for r in rosters:
                chore_rows = ""
                for cr in r["chores"]:
                    icon = "&#10003;" if cr["done"] else "&#9675;"
                    done_class = " chore-done" if cr["done"] else ""
                    chore_rows += (
                        f'<div class="chore-row{done_class}">'
                        f'<span class="chore-icon{" chore-icon-done" if cr["done"] else ""}">{icon}</span>'
                        f'<span class="chore-title">{_esc(cr["title"])}</span>'
                        f'</div>'
                    )
                    item_count += 1
                panel_content += (
                    f'<div class="roster-group">'
                    f'<div class="roster-label">{_esc(r["name"])}</div>'
                    f'{chore_rows}'
                    f'</div>'
                )
        else:
            # Flat list format (family tasks)
            for cr in rosters:
                icon = "&#10003;" if cr["done"] else "&#9675;"
                done_class = " chore-done" if cr["done"] else ""
                panel_content += (
                    f'<div class="chore-row{done_class}">'
                    f'<span class="chore-icon{" chore-icon-done" if cr["done"] else ""}">{icon}</span>'
                    f'<span class="chore-title">{_esc(cr["title"])}</span>'
                    f'</div>'
                )
                item_count += 1

        # Wrap in ticker if overflow expected
        if item_count > TICKER_THRESHOLD:
            scroll_duration = item_count * 2
            panel_content = (
                f'<div class="ticker-wrap">'
                f'<div class="ticker-content" style="animation:ticker-scroll {scroll_duration}s linear infinite;">'
                f'{panel_content}'
                f'{panel_content}'
                f'</div>'
                f'</div>'
            )

        panels_html += (
            f'<div class="freq-panel freq-panel-{card_id}-{i}">'
            f'{panel_content}'
            f'</div>'
        )

    # Per-card keyframes for tab rotation
    card_keyframes = ""
    for i in range(num_tabs):
        show_start = (i * tab_duration / cycle) * 100
        show_end = ((i + 1) * tab_duration / cycle) * 100
        card_keyframes += (
            f'@keyframes show-{card_id}-{i}{{'
            f'0%{{opacity:0;height:0;overflow:hidden;}}'
            f'{show_start:.1f}%{{opacity:0;height:0;overflow:hidden;}}'
            f'{show_start + 0.5:.1f}%{{opacity:1;height:auto;overflow:visible;}}'
            f'{show_end - 0.5:.1f}%{{opacity:1;height:auto;overflow:visible;}}'
            f'{show_end:.1f}%{{opacity:0;height:0;overflow:hidden;}}'
            f'100%{{opacity:0;height:0;overflow:hidden;}}'
            f'}}'
        )
        card_keyframes += (
            f'@keyframes pill-{card_id}-{i}{{'
            f'0%{{background:#334155;color:#94a3b8;}}'
            f'{show_start:.1f}%{{background:#334155;color:#94a3b8;}}'
            f'{show_start + 0.5:.1f}%{{background:#475569;color:#f8fafc;}}'
            f'{show_end - 0.5:.1f}%{{background:#475569;color:#f8fafc;}}'
            f'{show_end:.1f}%{{background:#334155;color:#94a3b8;}}'
            f'100%{{background:#334155;color:#94a3b8;}}'
            f'}}'
        )

    # Per-card style block with staggered delays
    style_rules = f'<style>{card_keyframes}'
    delay = int(card_id.replace("child", "").replace("family", "99") or "0") * 3
    for i in range(num_tabs):
        style_rules += f'.freq-panel-{card_id}-{i}{{animation:show-{card_id}-{i} {cycle}s {delay}s infinite;}}'
        style_rules += f'.freq-pill-{card_id}-{i}{{animation:pill-{card_id}-{i} {cycle}s {delay}s infinite;}}'
    style_rules += '</style>'

    return (
        f'{style_rules}'
        f'<div class="card child-card">'
        f'<div class="child-header" style="border-top-color:{safe_color};">'
        f'<span class="child-name">{_esc(name)}</span>'
        f'<span class="child-count">{done}/{total}</span>'
        f'</div>'
        f'<div class="child-body">'
        f'<div class="progress-track">'
        f'<div class="progress-fill" style="background:{safe_color};width:{pct}%;"></div>'
        f'</div>'
        f'<div class="freq-tab-bar">{tab_pills}</div>'
        f'{panels_html}'
        f'</div>'
        f'</div>'
    )


def _build_league_table(db: Session) -> list:
    """Build the league table data. Used by both the API route and kiosk dashboard."""
    # Check if any parent has hidden the league table
    parents = db.query(User).filter(User.role == "parent").all()
    for parent in parents:
        prefs = parent.preferences or {}
        if prefs.get("show_league_table") is False:
            return []

    users = db.query(User).all()
    # Start of current month for monthly jobs count
    now = datetime.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

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

        monthly_completions = db.query(ChoreCompletion).filter(
            ChoreCompletion.user_id == user.id,
            ChoreCompletion.completed_at >= month_start
        ).count()

        league.append({
            "user_id": user.id,
            "name": user.name,
            "standard_completed": standard_completed,
            "bonus_completed": bonus_completed,
            "total_points": user.points,
            "total_balance": user.balance,
            "monthly_completions": monthly_completions,
        })

    # Sort by points, then monthly completions as tiebreaker
    league.sort(key=lambda x: (x["total_points"], x["monthly_completions"]), reverse=True)
    return league


router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/league-table")
def get_league_table(db: Session = Depends(get_db)):
    return _build_league_table(db)

@router.get("/events")
def get_family_events(db: Session = Depends(get_db)):
    now_iso = datetime.now().isoformat()
    events = db.query(Event).filter(
        Event.start_time >= now_iso
    ).order_by(Event.start_time).all()
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


@router.get("/activities")
def get_activities(db: Session = Depends(get_db)):
    """Get last 7 days of Garmin activities grouped by user."""
    from datetime import timedelta
    cutoff = datetime.now() - timedelta(days=7)
    activities = db.query(GarminActivity).filter(
        GarminActivity.start_time >= cutoff
    ).order_by(GarminActivity.start_time.desc()).all()

    grouped = {}
    for act in activities:
        uid = act.user_id
        if uid not in grouped:
            user = act.user
            grouped[uid] = {
                "user_id": uid,
                "user_name": user.name if user else "Unknown",
                "color": (user.preferences or {}).get("color", "#6366f1") if user else "#6366f1",
                "activities": [],
            }
        grouped[uid]["activities"].append({
            "id": act.id,
            "activity_type": act.activity_type,
            "name": act.name,
            "start_time": act.start_time.isoformat() if act.start_time else None,
            "duration_seconds": act.duration_seconds,
            "distance_meters": act.distance_meters,
            "calories": act.calories,
            "average_hr": act.average_hr,
        })

    return list(grouped.values())


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
        child_done = 0
        child_total = 0
        # Group roster chores by frequency
        freq_rosters = {"daily": {}, "weekly": {}, "monthly": {}}
        for a in assignments:
            roster = db.query(Roster).filter(Roster.id == a.roster_id).first()
            if not roster:
                continue
            chores = db.query(Chore).filter(Chore.roster_id == roster.id).all()
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
                freq = c.frequency if c.frequency in freq_rosters else "daily"
                if roster.name not in freq_rosters[freq]:
                    freq_rosters[freq][roster.name] = []
                freq_rosters[freq][roster.name].append({"title": c.title, "done": is_done})
        # Non-roster chores assigned directly to this child
        direct_chores = db.query(Chore).filter(
            Chore.assignee_id == child.id,
            Chore.roster_id == None,
            Chore.is_completed == False,
        ).all()
        for c in direct_chores:
            comp = db.query(ChoreCompletion).filter(
                ChoreCompletion.chore_id == c.id,
                ChoreCompletion.user_id == child.id,
                ChoreCompletion.completed_at >= today_start
            ).first()
            is_done = comp is not None
            if is_done:
                child_done += 1
            child_total += 1
            freq = c.frequency if c.frequency in freq_rosters else "daily"
            if "Tasks" not in freq_rosters[freq]:
                freq_rosters[freq]["Tasks"] = []
            freq_rosters[freq]["Tasks"].append({"title": c.title, "done": is_done})
        # Convert to list format: {freq: [{"name": roster_name, "chores": [...]}]}
        freq_data = {}
        for freq, roster_dict in freq_rosters.items():
            if roster_dict:
                freq_data[freq] = [{"name": rn, "chores": rc} for rn, rc in roster_dict.items()]
        total_chores += child_total
        total_done += child_done
        color = (child.preferences or {}).get("color", "#6366f1")
        children_data.append({
            "name": child.name,
            "color": color,
            "done": child_done,
            "total": child_total,
            "freq_data": freq_data,
        })

    # --- Unassigned family tasks (non-roster, no assignee) ---
    family_tasks = db.query(Chore).filter(
        Chore.assignee_id == None,
        Chore.roster_id == None,
        Chore.is_completed == False,
    ).all()
    family_freq_data = {"daily": [], "weekly": [], "monthly": []}
    family_done_count = 0
    family_total_count = 0
    for c in family_tasks:
        comp = db.query(ChoreCompletion).filter(
            ChoreCompletion.chore_id == c.id,
            ChoreCompletion.completed_at >= today_start
        ).first()
        is_done = comp is not None
        if is_done:
            family_done_count += 1
        family_total_count += 1
        freq = c.frequency if c.frequency in family_freq_data else "daily"
        family_freq_data[freq].append({"title": c.title, "done": is_done})
    # Remove empty frequencies
    family_freq_data = {k: v for k, v in family_freq_data.items() if v}

    # --- Bonus chores ---
    bonus_chores = db.query(Chore).filter(
        Chore.is_bonus == True,
        Chore.is_completed == False,
    ).all()
    bonus_items = []
    for c in bonus_chores:
        bonus_items.append({
            "title": c.title,
            "reward": c.reward_money or 0.0,
        })

    # --- League table ---
    league = _build_league_table(db)

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

    # --- Family balance (check if any parent has hidden budget) ---
    show_budget = True
    parents = db.query(User).filter(User.role == "parent").all()
    for parent in parents:
        prefs = parent.preferences or {}
        if prefs.get("show_budget") is False:
            show_budget = False
            break
    family_balance = sum(c.balance or 0.0 for c in children) if show_budget else 0

    # --- Build HTML ---
    # Children cards
    children_html = ""
    if not children_data:
        children_html = '<p class="empty-state">No children found.</p>'
    for idx, ch in enumerate(children_data):
        children_html += _build_freq_card(
            card_id=f"child{idx}",
            name=ch["name"],
            color=ch["color"],
            done=ch["done"],
            total=ch["total"],
            freq_data=ch["freq_data"],
        )

    # Family tasks cards — one per frequency
    family_tasks_html = ""
    for freq in FREQ_ORDER:
        items = family_freq_data.get(freq)
        if not items:
            continue
        done_count = sum(1 for t in items if t["done"])
        task_rows = ""
        for t in items:
            icon = "&#10003;" if t["done"] else "&#9675;"
            done_class = " chore-done" if t["done"] else ""
            task_rows += (
                f'<div class="chore-row{done_class}">'
                f'<span class="chore-icon{" chore-icon-done" if t["done"] else ""}">{icon}</span>'
                f'<span class="chore-title">{_esc(t["title"])}</span>'
                f'</div>'
            )
        family_tasks_html += (
            f'<div class="card child-card">'
            f'<div class="child-header" style="border-top-color:#f59e0b;">'
            f'<span class="child-name">{FREQ_LABELS[freq]} Family Tasks</span>'
            f'<span class="child-count">{done_count}/{len(items)}</span>'
            f'</div>'
            f'<div class="child-body">'
            f'<div class="progress-track">'
            f'<div class="progress-fill" style="background:#f59e0b;width:{int(done_count / len(items) * 100) if items else 0}%;"></div>'
            f'</div>'
            f'{task_rows}'
            f'</div>'
            f'</div>'
        )

    # Bonus chores card
    bonus_html = ""
    if bonus_items:
        bonus_rows = ""
        for b in bonus_items:
            bonus_rows += (
                f'<div class="chore-row">'
                f'<span class="chore-icon" style="color:#fbbf24;">&#9733;</span>'
                f'<span class="chore-title">{_esc(b["title"])}</span>'
                f'<span class="bonus-reward">&pound;{b["reward"]:.2f}</span>'
                f'</div>'
            )
        bonus_html = (
            f'<div class="card child-card">'
            f'<div class="child-header" style="border-top-color:#a855f7;">'
            f'<span class="child-name">Bonus Chores</span>'
            f'<span class="child-count">{len(bonus_items)}</span>'
            f'</div>'
            f'<div class="child-body">'
            f'{bonus_rows}'
            f'</div>'
            f'</div>'
        )

    # League table
    league_html = ""
    if not league:
        league_html = '<p class="empty-state">No league data.</p>'
    for i, entry in enumerate(league):
        rank = i + 1
        league_html += (
            f'<div class="league-row">'
            f'<span class="league-rank">{rank}</span>'
            f'<span class="league-name">{_esc(entry["name"])}</span>'
            f'<span class="league-jobs">{entry["monthly_completions"]} jobs</span>'
            f'<span class="league-points">{entry["total_points"]} pts</span>'
            f'</div>'
        )

    # Upcoming events
    events_html = ""
    if not events:
        events_html = '<p class="empty-state">No upcoming events.</p>'
    for ev in events:
        ev_date = ""
        ev_time = ""
        if ev.start_time:
            try:
                dt = datetime.fromisoformat(ev.start_time)
                ev_date = dt.strftime("%a %d %b")
                ev_time = dt.strftime("%H:%M") if "T" in ev.start_time else ""
            except (ValueError, TypeError):
                ev_date = _esc(ev.start_time)
        date_time = ev_date
        if ev_time:
            date_time += f' &middot; {ev_time}'
        loc = f' &middot; {_esc(ev.location)}' if ev.location else ""
        # Calendar owner badge
        owner_badge = ""
        if ev.user:
            owner_color = _safe_color((ev.user.preferences or {}).get("color", "#6366f1"))
            first_name = _esc(ev.user.name.split()[0]) if ev.user.name else "?"
            owner_badge = f'<span class="event-owner" style="background:{owner_color};">{first_name}</span>'
        events_html += (
            f'<div class="event-row">'
            f'<div class="event-top">'
            f'<span class="event-summary">{_esc(ev.summary)}</span>'
            f'{owner_badge}'
            f'</div>'
            f'<div class="event-time">{date_time}{loc}</div>'
            f'</div>'
        )

    # Garmin activities (last 7 days)
    from datetime import timedelta
    garmin_cutoff = now - timedelta(days=7)
    garmin_activities = db.query(GarminActivity).filter(
        GarminActivity.start_time >= garmin_cutoff
    ).order_by(GarminActivity.start_time.desc()).limit(5).all()

    activities_html = ""
    if garmin_activities:
        for act in garmin_activities:
            dur_h = act.duration_seconds // 3600
            dur_m = (act.duration_seconds % 3600) // 60
            dur_str = f"{dur_h}h {dur_m}m" if dur_h > 0 else f"{dur_m}m"
            dist_str = f" &middot; {act.distance_meters / 1000:.1f} km" if act.distance_meters else ""
            cal_str = f" &middot; {act.calories} cal" if act.calories else ""
            owner_color = _safe_color((act.user.preferences or {}).get("color", "#6366f1")) if act.user else "#6366f1"
            first_name = _esc(act.user.name.split()[0]) if act.user and act.user.name else "?"
            date_str = act.start_time.strftime("%a %d %b") if act.start_time else ""
            activities_html += (
                f'<div class="event-row">'
                f'<div class="event-top">'
                f'<span class="event-summary">{_esc(act.name)}</span>'
                f'<span class="event-owner" style="background:{owner_color};">{first_name}</span>'
                f'</div>'
                f'<div class="event-time">{date_str} &middot; {dur_str}{dist_str}{cal_str}</div>'
                f'</div>'
            )
    else:
        activities_html = '<p class="empty-state">No recent activities.</p>'

    # Alert bar
    alert_html = ""
    if alerts:
        alert_items = ""
        for al in alerts:
            alert_items += f'<div class="alert-item">{_esc(al.message)}</div>'
        alert_html = (
            f'<div class="alert-bar">'
            f'{alert_items}'
            f'</div>'
        )

    page = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1920">
<meta http-equiv="refresh" content="60">
<title>The Scanlon Plan</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box;}}
body{{background:#0f172a;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;padding:24px;overflow:hidden;animation:pixel-shift 120s ease-in-out infinite;will-change:transform;}}
@keyframes pixel-shift{{
  0%{{transform:translate(0,0);}}
  25%{{transform:translate(2px,1px);}}
  50%{{transform:translate(0,3px);}}
  75%{{transform:translate(-2px,1px);}}
  100%{{transform:translate(0,0);}}
}}
@keyframes breathe{{
  0%,100%{{opacity:1;}}
  50%{{opacity:0.92;}}
}}
.child-card{{max-height:400px;overflow:hidden;will-change:opacity;}}
.child-card:nth-child(1){{animation:breathe 45s ease-in-out infinite;}}
.child-card:nth-child(2){{animation:breathe 55s ease-in-out 15s infinite;}}
.child-card:nth-child(3){{animation:breathe 50s ease-in-out 30s infinite;}}
.child-card:nth-child(4){{animation:breathe 60s ease-in-out 10s infinite;}}
.sidebar-card:first-child{{animation:breathe 65s ease-in-out 5s infinite;will-change:opacity;}}
.sidebar-card:last-child{{animation:breathe 70s ease-in-out 25s infinite;will-change:opacity;}}
.summary-card:nth-child(1){{animation:breathe 50s ease-in-out 8s infinite;will-change:opacity;}}
.summary-card:nth-child(2){{animation:breathe 55s ease-in-out 20s infinite;will-change:opacity;}}
.summary-card:nth-child(3){{animation:breathe 60s ease-in-out 35s infinite;will-change:opacity;}}
h1,h2,h3{{color:#f8fafc;}}
.card{{background:#1e293b;border-radius:12px;padding:16px;}}
.summary-cards{{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px;}}
.summary-card{{text-align:center;}}
.summary-value{{font-size:32px;font-weight:700;color:#f8fafc;}}
.summary-label{{font-size:13px;text-transform:uppercase;color:#94a3b8;}}
.main-grid{{display:grid;grid-template-columns:2fr 1fr;gap:24px;}}
.children-grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;align-content:start;}}
.child-header{{display:flex;justify-content:space-between;align-items:center;border-top:3px solid;padding-top:8px;margin-bottom:8px;}}
.child-name{{font-weight:700;font-size:18px;color:#f8fafc;}}
.child-count{{font-size:14px;color:#94a3b8;}}
.child-body{{max-height:320px;overflow:hidden;padding-top:4px;}}
.progress-track{{background:#334155;border-radius:6px;height:6px;overflow:hidden;margin-bottom:8px;}}
.progress-fill{{height:100%;border-radius:6px;transition:width 0.3s;}}
.roster-group{{margin-top:8px;}}
.roster-label{{font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:4px;}}
.chore-row{{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:14px;color:#cbd5e1;}}
.chore-done{{opacity:0.5;text-decoration:line-through;}}
.chore-icon{{font-size:16px;color:#94a3b8;}}
.chore-icon-done{{color:#22c55e;}}
.chore-title{{flex:1;}}
.bonus-reward{{color:#fbbf24;font-weight:600;font-size:13px;white-space:nowrap;}}
.league-row{{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #334155;}}
.league-rank{{color:#64748b;width:24px;}}
.league-name{{color:#f8fafc;flex:1;}}
.league-jobs{{color:#94a3b8;font-size:13px;margin-right:12px;}}
.league-points{{color:#fbbf24;font-weight:700;}}
.event-row{{padding:8px 0;border-bottom:1px solid #334155;font-size:14px;color:#cbd5e1;}}
.event-top{{display:flex;justify-content:space-between;align-items:center;gap:8px;}}
.event-summary{{flex:1;}}
.event-owner{{font-size:11px;font-weight:600;padding:2px 8px;border-radius:9999px;color:#fff;white-space:nowrap;}}
.event-time{{color:#94a3b8;font-size:13px;}}
.alert-bar{{background:#78350f;border:1px solid #92400e;color:#fde68a;padding:12px 24px;text-align:center;font-size:14px;}}
.alert-item{{padding:4px 0;}}
.section-title{{font-size:14px;font-weight:600;text-transform:uppercase;color:#94a3b8;margin-bottom:12px;}}
.empty-state{{color:#475569;font-style:italic;}}
.freq-tab-bar{{display:flex;gap:6px;margin-bottom:8px;}}
.freq-pill{{font-size:11px;text-transform:uppercase;letter-spacing:0.05em;padding:3px 10px;border-radius:9999px;background:#334155;color:#94a3b8;font-weight:600;}}
.freq-panel{{overflow:hidden;}}
.ticker-wrap{{max-height:200px;overflow:hidden;position:relative;}}
.ticker-content{{display:flex;flex-direction:column;}}
@keyframes ticker-scroll{{0%{{transform:translateY(0);}}100%{{transform:translateY(-50%);}}}}
.sidebar-card{{margin-bottom:16px;}}
.header{{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;}}
.header h1{{font-size:28px;}}
.header-date{{color:#94a3b8;font-size:16px;}}
</style>
</head>
<body>
<div class="header">
 <h1>The Scanlon Plan</h1>
 <div class="header-date">{_esc(today_display)}</div>
</div>

<div class="summary-cards">
 <div class="card summary-card">
  <div class="summary-label">Chores Done</div>
  <div class="summary-value">{total_done}/{total_chores}</div>
 </div>
 <div class="card summary-card">
  <div class="summary-label">Events Today</div>
  <div class="summary-value">{events_today_count}</div>
 </div>
{f''' <div class="card summary-card">
  <div class="summary-label">Family Balance</div>
  <div class="summary-value">&pound;{family_balance:.2f}</div>
 </div>''' if show_budget else ''}
</div>

<div class="main-grid">
 <div class="children-grid">
  {children_html}
  {family_tasks_html}
  {bonus_html}
 </div>

 <div>
  <div class="card sidebar-card">
   <h2 class="section-title">League Table</h2>
   {league_html}
  </div>

  <div class="card sidebar-card">
   <h2 class="section-title">Upcoming Events</h2>
   {events_html}
  </div>

  <div class="card sidebar-card">
   <h2 class="section-title">Recent Activities</h2>
   {activities_html}
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
