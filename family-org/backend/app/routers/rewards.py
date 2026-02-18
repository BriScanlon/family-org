from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import User, Reward
from ..schemas import RewardCreate, Reward as RewardSchema

from .dashboard import manager

router = APIRouter(prefix="/rewards", tags=["rewards"])

@router.get("/", response_model=List[RewardSchema])
def read_rewards(db: Session = Depends(get_db)):
    return db.query(Reward).all()

@router.post("/", response_model=RewardSchema)
def create_reward(reward: RewardCreate, db: Session = Depends(get_db)):
    db_reward = Reward(**reward.model_dump())
    db.add(db_reward)
    db.commit()
    db.refresh(db_reward)
    return db_reward

@router.post("/{reward_id}/redeem")
async def redeem_reward(reward_id: int, user_id: int, db: Session = Depends(get_db)):
    reward = db.query(Reward).filter(Reward.id == reward_id).first()
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    if reward.is_redeemed:
        raise HTTPException(status_code=400, detail="Reward already redeemed")

    user = db.query(User).filter(User.id == user_id).first()
    # Rewards now cost money (balance)
    if not user or user.balance < reward.cost:
        raise HTTPException(status_code=400, detail="Not enough money")

    user.balance -= reward.cost
    reward.is_redeemed = True
    reward.redeemer_id = user_id
    
    db.commit()

    # Notify all clients
    await manager.broadcast({
        "type": "REWARD_REDEEMED", 
        "reward_id": reward_id, 
        "user_id": user_id,
        "cost": reward.cost
    })

    return {"status": "success", "remaining_balance": user.balance}
