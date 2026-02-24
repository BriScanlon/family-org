from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from ..database import get_db
from ..models import User, Chore
from ..schemas import ChoreCreate, Chore as ChoreSchema

from .auth import get_me
from .dashboard import manager

router = APIRouter(prefix="/chores", tags=["chores"])

@router.get("/", response_model=List[ChoreSchema])
def read_chores(db: Session = Depends(get_db), request: Request = None):
    from ..services.auth_service import verify_token
    # Try to get current user from cookie for personal chore filtering
    user_id = None
    if request:
        token = request.cookies.get("access_token")
        if token:
            payload = verify_token(token)
            if payload:
                from ..models import User as UserModel
                user = db.query(UserModel).filter(UserModel.email == payload.get("sub")).first()
                if user:
                    user_id = user.id

    if user_id:
        # Show all non-personal chores + personal chores assigned to this user
        return db.query(Chore).filter(
            (Chore.personal == False) | (Chore.assignee_id == user_id)
        ).all()
    else:
        # No auth — show only non-personal chores
        return db.query(Chore).filter(Chore.personal == False).all()

@router.post("/", response_model=ChoreSchema)
def create_chore(chore: ChoreCreate, db: Session = Depends(get_db)):
    db_chore = Chore(**chore.model_dump())
    db.add(db_chore)
    db.commit()
    db.refresh(db_chore)
    return db_chore

@router.put("/{chore_id}/complete")
async def complete_chore(chore_id: int, user_id: int, db: Session = Depends(get_db)):
    chore = db.query(Chore).filter(Chore.id == chore_id).first()
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")
    
    if chore.is_completed:
        raise HTTPException(status_code=400, detail="Chore already completed")

    # Check if bonus chore can be unlocked
    if chore.is_bonus:
        # Check if all standard chores (not bonus) assigned to this user are completed
        incomplete_standard = db.query(Chore).filter(
            Chore.assignee_id == user_id,
            Chore.is_bonus == False, 
            Chore.is_completed == False
        ).first()
        
        if incomplete_standard:
            raise HTTPException(status_code=400, detail="Complete all your standard chores first!")

    chore.is_completed = True
    chore.last_completed_at = func.now()
    chore.assignee_id = user_id
    
    # Update user stats
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        # If user doesn't exist (e.g. in tests), we can't add points/money but we complete the chore
        db.commit()
        return {"status": "success", "points_added": 0, "money_added": 0}
    
    if chore.is_bonus:
        user.balance += chore.reward_money
    else:
        user.points += chore.points
    
    db.commit()
    
    # Notify all clients
    await manager.broadcast({
        "type": "CHORE_COMPLETED", 
        "chore_id": chore_id, 
        "user_id": user_id,
        "is_bonus": chore.is_bonus,
        "reward": chore.reward_money if chore.is_bonus else chore.points
    })
    
    return {
        "status": "success",
        "points_added": chore.points if not chore.is_bonus else 0,
        "money_added": chore.reward_money if chore.is_bonus else 0
    }

@router.put("/{chore_id}/uncomplete")
async def uncomplete_chore(chore_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_me)):
    if current_user.role != "parent":
        raise HTTPException(status_code=403, detail="Only parents can undo chore completion")

    chore = db.query(Chore).filter(Chore.id == chore_id).first()
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")

    if not chore.is_completed:
        raise HTTPException(status_code=400, detail="Chore is not completed")

    # Reverse the points/balance awarded
    if chore.assignee_id:
        user = db.query(User).filter(User.id == chore.assignee_id).first()
        if user:
            if chore.is_bonus:
                user.balance = max(0, user.balance - chore.reward_money)
            else:
                user.points = max(0, user.points - chore.points)

    chore.is_completed = False
    chore.last_completed_at = None
    db.commit()

    await manager.broadcast({
        "type": "CHORE_UNCOMPLETED",
        "chore_id": chore_id,
    })

    return {"status": "success"}

@router.put("/{chore_id}")
def update_chore(chore_id: int, chore_update: ChoreCreate, db: Session = Depends(get_db), current_user: User = Depends(get_me)):
    if current_user.role != "parent":
        raise HTTPException(status_code=403, detail="Only parents can edit chores")

    chore = db.query(Chore).filter(Chore.id == chore_id).first()
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")
    if chore.source != "manual":
        raise HTTPException(status_code=400, detail="Cannot edit synced chores")

    chore.title = chore_update.title
    chore.description = chore_update.description
    chore.points = chore_update.points
    chore.reward_money = chore_update.reward_money
    chore.is_bonus = chore_update.is_bonus
    chore.frequency = chore_update.frequency
    db.commit()
    db.refresh(chore)
    return chore

@router.delete("/{chore_id}")
def delete_chore(chore_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_me)):
    if current_user.role != "parent":
        raise HTTPException(status_code=403, detail="Only parents can delete chores")

    chore = db.query(Chore).filter(Chore.id == chore_id).first()
    if not chore:
        raise HTTPException(status_code=404, detail="Chore not found")

    db.delete(chore)
    db.commit()
    return {"status": "deleted"}

@router.get("/user/{user_id}", response_model=List[ChoreSchema])
def read_user_chores(user_id: int, db: Session = Depends(get_db)):
    return db.query(Chore).filter(Chore.assignee_id == user_id).all()
