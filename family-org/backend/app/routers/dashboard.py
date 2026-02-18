from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import json
from ..database import get_db
from ..services.ai_agent import FamilyAIAgent
from ..models import User, Event, Alert
from .auth import get_me

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/events")
def get_family_events(db: Session = Depends(get_db)):
    events = db.query(Event).all()
    # Join with user to get names
    results = []
    for event in events:
        user = db.query(User).filter(User.id == event.user_id).first()
        results.append({
            "id": event.id,
            "summary": event.summary,
            "start_time": event.start_time,
            "end_time": event.end_time,
            "location": event.location,
            "user_name": user.name if user else "Unknown"
        })
    return results

@router.get("/alerts")
def get_active_alerts(db: Session = Depends(get_db), current_user: User = Depends(get_me)):
    return db.query(Alert).filter(
        Alert.user_id == current_user.id,
        Alert.is_dismissed == False
    ).order_by(Alert.created_at.desc()).all()

@router.post("/alerts/{alert_id}/feedback")
def submit_alert_feedback(alert_id: int, feedback: int, db: Session = Depends(get_db)):
    agent = FamilyAIAgent(db)
    agent.learn_from_feedback(alert_id, feedback)
    
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if alert:
        alert.is_dismissed = True
        db.commit()
    return {"status": "success"}

@router.post("/alerts/{alert_id}/dismiss")
def dismiss_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if alert:
        alert.is_dismissed = True
        db.commit()
    return {"status": "success"}

@router.get("/ai-analysis/{user_id}")
def get_ai_analysis(user_id: int, db: Session = Depends(get_db)):
    agent = FamilyAIAgent(db)
    analysis = agent.analyze_user_schedule(user_id)
    return analysis

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            await connection.send_text(json.dumps(message))

import asyncio
import aio_pika
from ..config import settings

manager = ConnectionManager()

async def consume_broadcasts():
    """Background task to consume refresh signals from RabbitMQ and broadcast via WS."""
    connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
    channel = await connection.channel()
    queue = await channel.declare_queue("broadcast_queue")

    async with queue.iterator() as queue_iter:
        async for message in queue_iter:
            async with message.process():
                body = json.loads(message.body.decode())
                if body.get("type") == "dashboard_refresh":
                    await manager.broadcast({"type": "DASHBOARD_REFRESH", "user_id": body["data"]["user_id"]})

# Start the consumer in the background
@router.on_event("startup")
async def startup_event():
    asyncio.create_task(consume_broadcasts())

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
