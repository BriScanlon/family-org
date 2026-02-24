from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Float, DateTime, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    google_id = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    role = Column(String, default="member") # parent, member
    points = Column(Integer, default=0)
    balance = Column(Float, default=0.0) # Earned money for bonus chores
    synced_calendars = Column(JSON, default=list) # List of calendar IDs to sync
    threshold_preference = Column(Float, default=5.0) # Number of tasks/events before warning
    google_access_token = Column(String, nullable=True)
    google_refresh_token = Column(String, nullable=True)
    preferences = Column(JSON, default=dict, nullable=False, server_default="{}")
    go4schools_email = Column(String, nullable=True)
    go4schools_password = Column(String, nullable=True)  # Fernet-encrypted

    chores = relationship("Chore", back_populates="assignee")
    rewards = relationship("Reward", back_populates="redeemer")
    events = relationship("Event", back_populates="user")
    alerts = relationship("Alert", back_populates="user")

class Chore(Base):
    __tablename__ = "chores"

    id = Column(Integer, primary_key=True, index=True)
    google_task_id = Column(String, unique=True, index=True, nullable=True)
    title = Column(String, index=True)
    description = Column(String, nullable=True)
    points = Column(Integer, default=0)
    reward_money = Column(Float, default=0.0) # Money value for bonus chores
    is_bonus = Column(Boolean, default=False)
    is_completed = Column(Boolean, default=False)
    last_completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    frequency = Column(String, default="daily") # daily, weekly, monthly, once
    source = Column(String, default="manual")  # "manual" or "go4schools"
    source_id = Column(String, nullable=True, unique=True, index=True)  # dedup key
    due_date = Column(DateTime, nullable=True)
    assignee_id = Column(Integer, ForeignKey("users.id"))

    assignee = relationship("User", back_populates="chores")

class Reward(Base):
    __tablename__ = "rewards"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String, nullable=True)
    cost = Column(Float, default=0.0) # Cost in money
    is_redeemed = Column(Boolean, default=False)
    redeemer_id = Column(Integer, ForeignKey("users.id"))

    redeemer = relationship("User", back_populates="rewards")

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    google_event_id = Column(String, unique=True, index=True)
    summary = Column(String)
    start_time = Column(String) # ISO format
    end_time = Column(String)
    location = Column(String, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    user = relationship("User", back_populates="events")

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    message = Column(String)
    type = Column(String, default="warning") # warning, suggestion
    is_dismissed = Column(Boolean, default=False)
    feedback = Column(Integer, nullable=True) # 1 for helpful, -1 for not helpful
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="alerts")
