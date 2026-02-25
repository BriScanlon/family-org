from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import User, Chore, Roster, RosterAssignment, ChoreCompletion
from ..schemas import (
    RosterCreate, RosterOut, RosterChoreCreate, RosterAssign,
    RosterAssignmentOut, MyChoresResponse, MyRosterOut, MyChoreOut
)
from .auth import get_me

router = APIRouter(prefix="/rosters", tags=["rosters"])


def _require_parent(user: User):
    if user.role != "parent":
        raise HTTPException(status_code=403, detail="Only parents can manage rosters")


def _roster_to_out(roster: Roster, db: Session) -> dict:
    assignments = []
    for a in roster.assignments:
        u = db.query(User).filter(User.id == a.user_id).first()
        color = (u.preferences or {}).get("color") if u else None
        assignments.append({"id": a.id, "user_id": a.user_id, "user_name": u.name if u else "Unknown", "color": color})
    return {
        "id": roster.id,
        "name": roster.name,
        "created_by": roster.created_by,
        "chores": roster.chores,
        "assignments": assignments,
    }


@router.post("/", response_model=RosterOut)
def create_roster(body: RosterCreate, db: Session = Depends(get_db), current_user: User = Depends(get_me)):
    _require_parent(current_user)
    roster = Roster(name=body.name, created_by=current_user.id)
    db.add(roster)
    db.commit()
    db.refresh(roster)
    return _roster_to_out(roster, db)


@router.get("/", response_model=List[RosterOut])
def list_rosters(db: Session = Depends(get_db), current_user: User = Depends(get_me)):
    _require_parent(current_user)
    rosters = db.query(Roster).all()
    return [_roster_to_out(r, db) for r in rosters]


@router.put("/{roster_id}", response_model=RosterOut)
def update_roster(roster_id: int, body: RosterCreate, db: Session = Depends(get_db), current_user: User = Depends(get_me)):
    _require_parent(current_user)
    roster = db.query(Roster).filter(Roster.id == roster_id).first()
    if not roster:
        raise HTTPException(status_code=404, detail="Roster not found")
    roster.name = body.name
    db.commit()
    db.refresh(roster)
    return _roster_to_out(roster, db)


@router.delete("/{roster_id}")
def delete_roster(roster_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_me)):
    _require_parent(current_user)
    roster = db.query(Roster).filter(Roster.id == roster_id).first()
    if not roster:
        raise HTTPException(status_code=404, detail="Roster not found")
    db.delete(roster)
    db.commit()
    return {"status": "deleted"}


# -- Roster Assignments --

@router.post("/{roster_id}/assign", response_model=List[RosterAssignmentOut])
def assign_roster(roster_id: int, body: RosterAssign, db: Session = Depends(get_db), current_user: User = Depends(get_me)):
    _require_parent(current_user)
    roster = db.query(Roster).filter(Roster.id == roster_id).first()
    if not roster:
        raise HTTPException(status_code=404, detail="Roster not found")

    results = []
    for uid in body.user_ids:
        existing = db.query(RosterAssignment).filter(
            RosterAssignment.roster_id == roster_id,
            RosterAssignment.user_id == uid
        ).first()
        if not existing:
            a = RosterAssignment(roster_id=roster_id, user_id=uid)
            db.add(a)
            db.flush()
            u = db.query(User).filter(User.id == uid).first()
            color = (u.preferences or {}).get("color") if u else None
            results.append({"id": a.id, "user_id": uid, "user_name": u.name if u else "Unknown", "color": color})
    db.commit()
    return results


@router.delete("/{roster_id}/assign/{user_id}")
def unassign_roster(roster_id: int, user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_me)):
    _require_parent(current_user)
    a = db.query(RosterAssignment).filter(
        RosterAssignment.roster_id == roster_id,
        RosterAssignment.user_id == user_id
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(a)
    db.commit()
    return {"status": "removed"}


# -- Roster Chores --

@router.post("/{roster_id}/chores")
def add_roster_chore(roster_id: int, body: RosterChoreCreate, db: Session = Depends(get_db), current_user: User = Depends(get_me)):
    _require_parent(current_user)
    roster = db.query(Roster).filter(Roster.id == roster_id).first()
    if not roster:
        raise HTTPException(status_code=404, detail="Roster not found")

    chore = Chore(
        title=body.title,
        description=body.description,
        points=body.points,
        frequency=body.frequency,
        roster_id=roster_id,
        is_bonus=False,
    )
    db.add(chore)
    db.commit()
    db.refresh(chore)
    return {"id": chore.id, "title": chore.title, "points": chore.points, "frequency": chore.frequency}


# -- Drag-and-drop chore management --

@router.post("/{roster_id}/chores/from/{chore_id}")
def move_chore_to_roster(roster_id: int, chore_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_me)):
    _require_parent(current_user)
    roster = db.query(Roster).filter(Roster.id == roster_id).first()
    if not roster:
        raise HTTPException(status_code=404, detail="Roster not found")
    chore = db.query(Chore).filter(Chore.id == chore_id).first()
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")

    # Always copy — pool chores are templates, cross-roster drags duplicate
    if chore.roster_id != roster_id:
        new_chore = Chore(
            title=chore.title,
            description=chore.description,
            points=chore.points,
            frequency=chore.frequency,
            roster_id=roster_id,
            is_bonus=False,
        )
        db.add(new_chore)
        db.commit()
        db.refresh(new_chore)
        return {"id": new_chore.id, "title": new_chore.title, "points": new_chore.points, "frequency": new_chore.frequency}

    # Already on this roster — no-op
    return {"id": chore.id, "title": chore.title, "points": chore.points, "frequency": chore.frequency}


@router.delete("/{roster_id}/chores/{chore_id}")
def remove_chore_from_roster(roster_id: int, chore_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_me)):
    _require_parent(current_user)
    chore = db.query(Chore).filter(Chore.id == chore_id, Chore.roster_id == roster_id).first()
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found in this roster")
    chore.roster_id = None
    db.commit()
    return {"status": "removed"}


# -- Family members (for assignment picker) --

@router.get("/family-members")
def list_family_members(db: Session = Depends(get_db), current_user: User = Depends(get_me)):
    _require_parent(current_user)
    members = db.query(User).filter(User.role != "parent").all()
    return [{"id": m.id, "name": m.name, "email": m.email, "color": (m.preferences or {}).get("color")} for m in members]


# -- Parent View: Family Overview --

@router.get("/family-overview")
def get_family_overview(db: Session = Depends(get_db), current_user: User = Depends(get_me)):
    _require_parent(current_user)
    from datetime import datetime

    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    children = db.query(User).filter(User.role != "parent").all()
    result = []

    for child in children:
        assignments = db.query(RosterAssignment).filter(RosterAssignment.user_id == child.id).all()
        child_rosters = []
        for a in assignments:
            roster = db.query(Roster).filter(Roster.id == a.roster_id).first()
            if not roster:
                continue
            chores = db.query(Chore).filter(Chore.roster_id == roster.id).all()
            completed_count = 0
            chore_items = []
            for c in chores:
                comp = db.query(ChoreCompletion).filter(
                    ChoreCompletion.chore_id == c.id,
                    ChoreCompletion.user_id == child.id,
                    ChoreCompletion.completed_at >= today_start
                ).first()
                is_done = comp is not None
                if is_done:
                    completed_count += 1
                chore_items.append({
                    "id": c.id, "title": c.title, "points": c.points,
                    "frequency": c.frequency, "is_completed": is_done,
                })
            child_rosters.append({
                "roster_id": roster.id,
                "roster_name": roster.name,
                "chores": chore_items,
                "completed": completed_count,
                "total": len(chores),
            })
        color = (child.preferences or {}).get("color")
        result.append({
            "user_id": child.id,
            "user_name": child.name,
            "color": color,
            "rosters": child_rosters,
        })

    return result


# -- Child View: My Chores --

@router.get("/my-chores", response_model=MyChoresResponse)
def get_my_chores(db: Session = Depends(get_db), current_user: User = Depends(get_me)):
    from datetime import datetime

    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    # Get rosters assigned to this user
    assignments = db.query(RosterAssignment).filter(RosterAssignment.user_id == current_user.id).all()
    roster_ids = [a.roster_id for a in assignments]

    rosters_out = []
    all_roster_chores_done = True

    for rid in roster_ids:
        roster = db.query(Roster).filter(Roster.id == rid).first()
        if not roster:
            continue
        chores = db.query(Chore).filter(Chore.roster_id == rid).all()
        chore_items = []
        completed_count = 0
        for c in chores:
            comp = db.query(ChoreCompletion).filter(
                ChoreCompletion.chore_id == c.id,
                ChoreCompletion.user_id == current_user.id,
                ChoreCompletion.completed_at >= today_start
            ).first()
            is_done = comp is not None
            if is_done:
                completed_count += 1
            else:
                all_roster_chores_done = False
            chore_items.append(MyChoreOut(
                id=c.id, title=c.title, points=c.points,
                frequency=c.frequency, is_completed=is_done, roster_name=roster.name
            ))
        rosters_out.append(MyRosterOut(
            roster_id=rid, roster_name=roster.name,
            chores=chore_items, completed=completed_count, total=len(chores)
        ))

    if not roster_ids:
        all_roster_chores_done = False

    # Unassigned non-bonus, non-roster chores (Go4Schools, AI, legacy)
    unassigned_chores = db.query(Chore).filter(
        Chore.roster_id.is_(None), Chore.is_bonus == False
    ).all()
    unassigned_out = []
    for c in unassigned_chores:
        if c.personal and c.assignee_id != current_user.id:
            continue
        comp = db.query(ChoreCompletion).filter(
            ChoreCompletion.chore_id == c.id,
            ChoreCompletion.user_id == current_user.id,
            ChoreCompletion.completed_at >= today_start
        ).first()
        is_done = comp is not None or c.is_completed
        if not is_done:
            all_roster_chores_done = False
        unassigned_out.append(MyChoreOut(
            id=c.id, title=c.title, points=c.points,
            frequency=c.frequency, is_completed=is_done
        ))

    # Bonus chores (shared pool)
    bonus_chores = db.query(Chore).filter(Chore.is_bonus == True).all()
    bonus_out = []
    for c in bonus_chores:
        comp = db.query(ChoreCompletion).filter(
            ChoreCompletion.chore_id == c.id,
            ChoreCompletion.user_id == current_user.id,
            ChoreCompletion.completed_at >= today_start
        ).first()
        is_done = comp is not None or c.is_completed
        bonus_out.append(MyChoreOut(
            id=c.id, title=c.title, points=c.points,
            frequency=c.frequency, is_completed=is_done
        ))

    return MyChoresResponse(
        rosters=rosters_out,
        unassigned=unassigned_out,
        bonus_unlocked=all_roster_chores_done,
        bonus_chores=bonus_out,
    )
