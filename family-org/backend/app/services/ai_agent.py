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

    def generate_event_tasks(self, user_id: int):
        """Scan upcoming events and create personal preparation tasks."""
        import hashlib

        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return []

        now = datetime.now()
        window_start = now + timedelta(days=7)
        window_end = now + timedelta(days=14)

        events = self.db.query(Event).filter(
            Event.user_id == user_id,
            Event.start_time >= window_start.isoformat(),
            Event.start_time <= window_end.isoformat()
        ).all()

        created = []
        for event in events:
            tasks = self._suggest_tasks_for_event(event.summary)
            if not tasks:
                continue

            # Parse event date for due_date (1 day before event)
            event_date = None
            try:
                event_date = datetime.fromisoformat(event.start_time.replace('Z', '+00:00'))
                due_date = event_date - timedelta(days=1)
            except (ValueError, AttributeError):
                due_date = None

            for task_title in tasks:
                # Dedup key
                raw = f"{event.google_event_id}|{task_title}"
                source_id = hashlib.sha256(raw.encode()).hexdigest()[:16]

                existing = self.db.query(Chore).filter(Chore.source_id == source_id).first()
                if existing:
                    continue

                chore = Chore(
                    title=task_title[:200],
                    source="ai",
                    source_id=source_id,
                    due_date=due_date,
                    frequency="once",
                    is_bonus=False,
                    points=3,
                    personal=True,
                    assignee_id=user_id,
                )
                self.db.add(chore)
                created.append(chore)

        if created:
            self.db.commit()
        return created

    def _suggest_tasks_for_event(self, event_summary: str) -> list[str]:
        """Ask LLM to suggest preparation tasks, with keyword fallback."""
        prompt = f"""You are a family organization assistant. Given this calendar event, suggest 0-3 short preparation tasks that someone might need to do beforehand.

Event: "{event_summary}"

Rules:
- Only suggest tasks if preparation is actually needed
- Each task should be a short action (3-8 words)
- Reply with ONLY a JSON array of strings, nothing else
- If no preparation needed, reply with []

Examples:
- "Sarah's Birthday Party" → ["Buy birthday card for Sarah", "Buy present for Sarah"]
- "Team standup" → []
- "Dentist appointment" → ["Prepare list of dental concerns"]"""

        response = self._call_llm(prompt)

        if response:
            try:
                # Try to parse JSON from the response
                # Handle cases where LLM wraps in markdown code blocks
                cleaned = response.strip()
                if cleaned.startswith("```"):
                    cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
                tasks = json.loads(cleaned)
                if isinstance(tasks, list):
                    return [str(t).strip() for t in tasks if t and str(t).strip()][:3]
            except (json.JSONDecodeError, ValueError):
                pass

        # Fallback: keyword matching
        return self._keyword_fallback(event_summary)

    def _keyword_fallback(self, summary: str) -> list[str]:
        """Simple keyword-based task suggestions when LLM is unavailable."""
        lower = summary.lower()

        if "birthday" in lower:
            # Try to extract the name
            name = summary.split("'s")[0].strip() if "'s" in summary else ""
            if name:
                return [f"Buy birthday card for {name}", f"Buy present for {name}"]
            return ["Buy birthday card", "Buy present"]

        if any(word in lower for word in ["dentist", "doctor", "gp", "hospital"]):
            return ["Prepare any paperwork or questions"]

        if any(word in lower for word in ["interview", "presentation"]):
            return ["Prepare notes and materials"]

        return []
