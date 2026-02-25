from datetime import datetime
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
    roster_id: Optional[int] = None
    source: str = "manual"
    source_id: Optional[str] = None
    due_date: Optional[datetime] = None
    personal: bool = False

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

class RosterCreate(BaseModel):
    name: str

class RosterChoreCreate(BaseModel):
    title: str
    description: Optional[str] = None
    points: int = 0
    frequency: str = "daily"

class RosterAssign(BaseModel):
    user_ids: list[int]

class RosterChoreOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    points: int
    frequency: str

    model_config = {"from_attributes": True}

class RosterAssignmentOut(BaseModel):
    id: int
    user_id: int
    user_name: str

class RosterOut(BaseModel):
    id: int
    name: str
    created_by: int
    chores: list[RosterChoreOut] = []
    assignments: list[RosterAssignmentOut] = []

    model_config = {"from_attributes": True}

class ChoreCompletionOut(BaseModel):
    id: int
    chore_id: int
    user_id: int
    completed_at: datetime

    model_config = {"from_attributes": True}

class MyChoreOut(BaseModel):
    id: int
    title: str
    points: int
    frequency: str
    is_completed: bool
    roster_name: Optional[str] = None

class MyRosterOut(BaseModel):
    roster_id: int
    roster_name: str
    chores: list[MyChoreOut]
    completed: int
    total: int

class MyChoresResponse(BaseModel):
    rosters: list[MyRosterOut]
    unassigned: list[MyChoreOut]
    bonus_unlocked: bool
    bonus_chores: list[MyChoreOut]
