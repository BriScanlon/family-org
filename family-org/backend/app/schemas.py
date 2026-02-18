from pydantic import BaseModel
from typing import List, Optional

class UserBase(BaseModel):
    email: str
    name: str

class UserCreate(UserBase):
    google_id: str

class User(UserBase):
    id: int
    role: str
    points: int
    balance: float
    
    model_config = {
        "from_attributes": True
    }

class ChoreBase(BaseModel):
    title: str
    description: Optional[str] = None
    points: int = 0
    reward_money: float = 0.0
    is_bonus: bool = False
    frequency: str = "daily"

class ChoreCreate(ChoreBase):
    pass

class Chore(ChoreBase):
    id: int
    is_completed: bool
    assignee_id: Optional[int] = None

    model_config = {
        "from_attributes": True
    }

class RewardBase(BaseModel):
    title: str
    description: Optional[str] = None
    cost: float

class RewardCreate(RewardBase):
    pass

class Reward(RewardBase):
    id: int
    is_redeemed: bool
    redeemer_id: Optional[int] = None

    model_config = {
        "from_attributes": True
    }
