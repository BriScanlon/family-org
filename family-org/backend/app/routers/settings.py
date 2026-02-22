from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from ..database import get_db
from ..models import User
from ..config import settings
from .auth import get_me

router = APIRouter(prefix="/settings", tags=["settings"])

@router.get("/preferences")
def get_preferences(current_user: User = Depends(get_me)):
    return current_user.preferences or {}

@router.patch("/preferences")
def update_preferences(prefs: dict, db: Session = Depends(get_db), current_user: User = Depends(get_me)):
    current = current_user.preferences or {}
    current.update(prefs)
    current_user.preferences = current
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user.preferences

@router.get("/calendars")
async def list_google_calendars(current_user: User = Depends(get_me)):
    if not current_user.google_access_token:
        raise HTTPException(status_code=401, detail="Google account not linked")

    creds = Credentials(
        token=current_user.google_access_token,
        refresh_token=current_user.google_refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET
    )

    try:
        service = build('calendar', 'v3', credentials=creds)
        calendar_list = service.calendarList().list().execute()
        return calendar_list.get('items', [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/calendars/sync")
async def update_synced_calendars(calendar_ids: list[str], db: Session = Depends(get_db), current_user: User = Depends(get_me)):
    # In this dev version, we check if the user is a parent (or just allow for now)
    # current_user.role = "parent" # Manual override for testing if needed
    
    current_user.synced_calendars = calendar_ids
    db.add(current_user)
    db.commit()
    
    # Trigger an immediate sync for the new calendars
    from ..services.rabbitmq import send_sync_message
    await send_sync_message("calendar_sync", {"user_id": current_user.id})
    
    return {"status": "success", "synced_calendars": current_user.synced_calendars}

@router.post("/role/parent")
async def become_parent(db: Session = Depends(get_db), current_user: User = Depends(get_me)):
    """Development endpoint to set role to parent."""
    current_user.role = "parent"
    db.add(current_user)
    db.commit()
    return {"status": "success", "role": current_user.role}
