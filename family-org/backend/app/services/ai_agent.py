import os
import requests
import json
from ..database import SessionLocal
from ..models import User, Event, Chore, Alert
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from ..config import settings

class FamilyAIAgent:
    def __init__(self, db: Session):
        self.db = db
        self.ollama_url = f"{settings.OLLAMA_HOST}/api/generate"

    def _call_llm(self, prompt: str):
        try:
            response = requests.post(
                self.ollama_url,
                json={
                    "model": settings.OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False
                },
                timeout=30
            )
            if response.status_code == 200:
                return response.json().get("response", "").strip()
        except Exception as e:
            print(f"Ollama error: {e}")
        return None

    def analyze_user_schedule(self, user_id: int):
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return

        now = datetime.now()
        today_end = now.replace(hour=23, minute=59, second=59)
        
        events = self.db.query(Event).filter(
            Event.user_id == user_id,
            Event.start_time >= now.isoformat(),
            Event.start_time <= today_end.isoformat()
        ).all()
        
        chores = self.db.query(Chore).filter(
            Chore.assignee_id == user_id,
            Chore.is_completed == False
        ).all()
        
        count = len(events) + len(chores)
        
        # Only invoke LLM if count is high OR we want smart insights
        if count > user.threshold_preference:
            # Prepare context for LLM
            event_list = ", ".join([e.summary for e in events])
            chore_list = ", ".join([c.title for c in chores])
            
            prompt = f"""
            You are a helpful family organization assistant. 
            User {user.name} has a busy day with {len(events)} events and {len(chores)} tasks.
            Events: {event_list}
            Tasks: {chore_list}
            
            Based on this, provide a VERY SHORT (max 20 words) proactive warning or suggestion. 
            Keep it encouraging but realistic. Don't use markdown.
            """
            
            ai_message = self._call_llm(prompt)
            
            if not ai_message:
                # Fallback to heuristic
                ai_message = f"Busy day! {len(events)} events and {len(chores)} tasks remaining."

            # Avoid duplicate alerts for the same day
            existing = self.db.query(Alert).filter(
                Alert.user_id == user_id,
                Alert.created_at >= now.replace(hour=0, minute=0, second=0)
            ).first()
            
            if not existing:
                alert = Alert(user_id=user_id, message=ai_message, type="warning")
                self.db.add(alert)
                self.db.commit()
                return alert
        return None

    def learn_from_feedback(self, alert_id: int, feedback: int):
        alert = self.db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            return

        user = self.db.query(User).filter(User.id == alert.user_id).first()
        if not user:
            return

        alert.feedback = feedback
        
        if feedback == -1:
            user.threshold_preference += 0.5
        elif feedback == 1:
            user.threshold_preference = max(2.0, user.threshold_preference - 0.2)
            
        self.db.commit()
