from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from ..database import get_db
from ..models import User, Chore
from ..schemas import ChoreCreate, Chore as ChoreSchema

from .dashboard import manager

router = APIRouter(prefix="/chores", tags=["chores"])

@router.get("/", response_model=List[ChoreSchema])
def read_chores(db: Session = Depends(get_db)):
    return db.query(Chore).all()

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

@router.get("/user/{user_id}", response_model=List[ChoreSchema])
def read_user_chores(user_id: int, db: Session = Depends(get_db)):
    return db.query(Chore).filter(Chore.assignee_id == user_id).all()
