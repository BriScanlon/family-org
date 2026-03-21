from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google_auth_oauthlib.flow import Flow
from google.auth.transport import requests
import json
import os
import hashlib
import base64
import secrets


def _generate_pkce():
    """Generate PKCE code_verifier and code_challenge (S256)."""
    code_verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return code_verifier, code_challenge

from ..database import get_db
from ..models import User
from ..config import settings
from ..services.auth_service import create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

# In-memory store for PKCE code verifiers keyed by OAuth state
_pending_states: dict[str, str] = {}

# Configure the flow for Google OAuth
CLIENT_CONFIG = {
    "web": {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "project_id": "family-org",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uris": [settings.GOOGLE_REDIRECT_URI]
    }
}

SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/tasks"
]

@router.get("/login")
def login():
    flow = Flow.from_client_config(
        CLIENT_CONFIG,
        scopes=SCOPES,
        redirect_uri=settings.GOOGLE_REDIRECT_URI
    )
    code_verifier, code_challenge = _generate_pkce()
    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        code_challenge=code_challenge,
        code_challenge_method="S256"
    )
    # Store code_verifier keyed by state so callback can retrieve it
    _pending_states[state] = code_verifier
    return RedirectResponse(authorization_url)

@router.get("/callback")
async def callback(code: str, state: str, db: Session = Depends(get_db)):
    code_verifier = _pending_states.pop(state, None)
    if not code_verifier:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")
    flow = Flow.from_client_config(
        CLIENT_CONFIG,
        scopes=SCOPES,
        redirect_uri=settings.GOOGLE_REDIRECT_URI
    )
    flow.fetch_token(code=code, code_verifier=code_verifier)
    credentials = flow.credentials

    # Verify the ID token
    try:
        id_info = id_token.verify_oauth2_token(
            credentials.id_token, requests.Request(), settings.GOOGLE_CLIENT_ID
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid token")

    google_id = id_info.get("sub")
    email = id_info.get("email")
    name = id_info.get("name")

    # Check if user exists by google_id, then by email (for pre-created accounts)
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user:
            # Link pre-created account to their Google identity
            user.google_id = google_id
            user.google_access_token = credentials.token
            if credentials.refresh_token:
                user.google_refresh_token = credentials.refresh_token
        else:
            user = User(
                google_id=google_id,
                email=email,
                name=name,
                google_access_token=credentials.token,
                google_refresh_token=credentials.refresh_token
            )
            db.add(user)
    else:
        user.google_access_token = credentials.token
        if credentials.refresh_token:
            user.google_refresh_token = credentials.refresh_token
    
    db.commit()
    db.refresh(user)

    # Trigger sync in background
    from ..services.rabbitmq import send_sync_message
    import asyncio
    asyncio.create_task(send_sync_message("calendar_sync", {"user_id": user.id}))
    asyncio.create_task(send_sync_message("tasks_sync", {"user_id": user.id}))

    # Create JWT for our application
    access_token = create_access_token(data={"sub": user.email, "id": user.id})
    
    # Redirect to frontend with the token (in a real app, maybe a cookie or a fragment)
    # For now, let's just send it as a query param or redirect back to the home page.
    response = RedirectResponse(url=settings.FRONTEND_URL)
    response.set_cookie(key="access_token", value=access_token, httponly=True)
    return response

@router.get("/me")
async def get_me(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Simple token verification logic
    from ..services.auth_service import verify_token
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
