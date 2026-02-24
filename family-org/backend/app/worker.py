import asyncio
import aio_pika
import json
import calendar
from datetime import datetime, timezone, timedelta
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from sqlalchemy.orm import Session
from .database import SessionLocal
from .models import User, Chore, Event, Alert
from .config import settings
from .services.ai_agent import FamilyAIAgent

async def reset_chores_task():
    """Background task to reset chores and run AI analysis."""
    while True:
        try:
            db: Session = SessionLocal()
            now = datetime.now()
            
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            
            # Weekly: Reset at start of weekend (Saturday 00:00)
            days_since_saturday = (now.weekday() - 5) % 7
            last_saturday = today_start - timedelta(days=days_since_saturday)
            
            # Monthly: Reset at beginning of month
            first_of_month = today_start.replace(day=1)

            chores_to_reset = db.query(Chore).filter(Chore.is_completed == True).all()
            reset_count = 0
            
            for chore in chores_to_reset:
                if not chore.last_completed_at:
                    continue
                    
                should_reset = False
                if chore.frequency == "daily" and chore.last_completed_at < today_start:
                    should_reset = True
                elif chore.frequency == "weekly" and chore.last_completed_at < last_saturday:
                    should_reset = True
                elif chore.frequency == "monthly" and chore.last_completed_at < first_of_month:
                    should_reset = True
                
                if should_reset:
                    chore.is_completed = False
                    reset_count += 1
            
            if reset_count > 0:
                db.commit()
                print(f"[Worker] Reset {reset_count} recurring chores.")

            # AI Schedule Analysis
            agent = FamilyAIAgent(db)
            users = db.query(User).all()
            for user in users:
                alert = agent.analyze_user_schedule(user.id)
                if alert:
                    print(f"[Worker] AI Alert generated for {user.email}: {alert.message}")
            
            db.close()
        except Exception as e:
            print(f"[Worker] Error in reset_chores_task: {e}")
            
        # Run check every hour
        await asyncio.sleep(3600)

async def process_sync(message_body: dict):
    msg_type = message_body.get("type")
    data = message_body.get("data")
    user_id = data.get("user_id")

    db: Session = SessionLocal()
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        db.close()
        return

    print(f"[Worker] Processing {msg_type} for user {user.email}")

    # Create credentials from saved tokens
    creds = Credentials(
        token=user.google_access_token,
        refresh_token=user.google_refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        scopes=["https://www.googleapis.com/auth/calendar.readonly", "https://www.googleapis.com/auth/tasks"]
    )

    # Refresh token if expired
    if creds.expired or not creds.valid:
        from google.auth.transport.requests import Request
        try:
            creds.refresh(Request())
            user.google_access_token = creds.token
            db.commit()
            print(f"[Worker] Refreshed Google token for {user.email}")
        except Exception as e:
            print(f"[Worker] Could not refresh token for {user.email}: {e}")
            db.close()
            return

    if msg_type == "calendar_sync":
        try:
            service = build('calendar', 'v3', credentials=creds)
            
            # Sync from all selected calendars, or default to primary
            calendar_ids = user.synced_calendars if user.synced_calendars else ['primary']
            print(f"[Worker] Syncing {len(calendar_ids)} calendars: {calendar_ids}")
            
            total_synced = 0
            for cal_id in calendar_ids:
                try:
                    events_result = service.events().list(
                        calendarId=cal_id, 
                        maxResults=50, 
                        singleEvents=True, 
                        orderBy='startTime',
                        timeMin=datetime.now(timezone.utc).isoformat()
                    ).execute()
                    events = events_result.get('items', [])
                    print(f"[Worker] Found {len(events)} events in calendar {cal_id}")
                    
                    for g_event in events:
                        # Visibility: 'private' or 'confidential' should be skipped
                        visibility = g_event.get('visibility', 'default')
                        if visibility in ['private', 'confidential']:
                            continue

                        start = g_event['start'].get('dateTime', g_event['start'].get('date'))
                        end = g_event['end'].get('dateTime', g_event['end'].get('date'))
                        
                        event_id = g_event['id']
                        db_event = db.query(Event).filter(Event.google_event_id == event_id).first()
                        
                        if not db_event:
                            db_event = Event(
                                google_event_id=event_id,
                                summary=g_event.get('summary', '(No Title)'),
                                start_time=start,
                                end_time=end,
                                location=g_event.get('location'),
                                user_id=user_id
                            )
                            db.add(db_event)
                        else:
                            db_event.summary = g_event.get('summary', '(No Title)')
                            db_event.start_time = start
                            db_event.end_time = end
                            db_event.location = g_event.get('location')
                    
                    total_synced += len(events)
                except Exception as e:
                    print(f"[Worker] Error syncing calendar {cal_id}: {e}")
            
            db.commit()
            print(f"[Worker] Successfully synced {total_synced} total events for user {user.email}")
            
            # Broadcast update
            from .services.rabbitmq import send_sync_message
            await send_sync_message("dashboard_refresh", {"user_id": user_id}, routing_key="broadcast_queue")
        except Exception as e:
            print(f"[Worker] Fatal error in calendar_sync: {e}")

    elif msg_type == "tasks_sync":
        try:
            # ...
            db.commit()
            print(f"[Worker] Synced tasks for user {user.email}")
            
            # Broadcast update
            from .services.rabbitmq import send_sync_message
            await send_sync_message("dashboard_refresh", {"user_id": user_id}, routing_key="broadcast_queue")
        except Exception as e:
            print(f"[Worker] Error in tasks_sync: {e}")

    elif msg_type == "go4schools_sync":
        try:
            from .services.go4schools import scrape_homework
            result = await scrape_homework(user, db)
            prefs = dict(user.preferences or {})
            if result["error"]:
                prefs["go4schools_error"] = result["error"]
                print(f"[Worker] Go4Schools error for {user.email}: {result['error']}")
            else:
                prefs.pop("go4schools_error", None)
                print(f"[Worker] Synced {result['synced']} homework items for {user.email}")
            prefs["go4schools_last_sync"] = datetime.now(timezone.utc).isoformat()
            user.preferences = prefs
            db.add(user)
            db.commit()

            from .services.rabbitmq import send_sync_message
            await send_sync_message("dashboard_refresh", {"user_id": user_id}, routing_key="broadcast_queue")
        except Exception as e:
            print(f"[Worker] Go4Schools fatal error: {e}")

    db.close()

async def go4schools_daily_sync():
    """Daily task to sync Go4Schools homework for all connected users."""
    while True:
        # Initial delay of 1 hour (offset from chore reset)
        await asyncio.sleep(3600)
        try:
            db: Session = SessionLocal()
            users = db.query(User).filter(User.go4schools_email.isnot(None)).all()
            for user in users:
                from .services.rabbitmq import send_sync_message
                await send_sync_message("go4schools_sync", {"user_id": user.id})
                print(f"[Worker] Queued Go4Schools sync for {user.email}")
            db.close()
        except Exception as e:
            print(f"[Worker] Error in go4schools_daily_sync: {e}")
        # Wait remaining ~23 hours
        await asyncio.sleep(82800)

async def main():
    for i in range(10):
        try:
            connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
            break
        except Exception as e:
            print(f"RabbitMQ not ready, retrying ({i+1}/10)... {e}")
            await asyncio.sleep(5)
    else:
        print("Could not connect to RabbitMQ after 10 retries.")
        return

    channel = await connection.channel()
    queue = await channel.declare_queue("sync_queue")

    # Start recurring reset task
    asyncio.create_task(reset_chores_task())
    asyncio.create_task(go4schools_daily_sync())

    async with queue.iterator() as queue_iter:
        async for message in queue_iter:
            async with message.process():
                body = json.loads(message.body.decode())
                await process_sync(body)

if __name__ == "__main__":
    asyncio.run(main())
