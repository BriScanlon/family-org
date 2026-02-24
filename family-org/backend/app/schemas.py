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
    synced_calendars: list[str] = []
    preferences: dict = {}

    model_config = {
        "from_attributes": True
    }

class PreferencesUpdate(BaseModel):
    theme: Optional[str] = None
    show_league_table: Optional[bool] = None

    model_config = {
        "extra": "forbid"
    }

class Go4SchoolsConnect(BaseModel):
    email: str
    password: str

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
    source: str = "manual"
    source_id: Optional[str] = None
    due_date: Optional[str] = None

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
