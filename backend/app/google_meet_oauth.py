"""
Google Meet OAuth integration for importing meeting transcripts.

Uses Google OAuth 2.0 with Calendar and Drive APIs to:
- List Google Meet recordings from Google Drive
- Download transcript files
- Import transcripts into Made4Founders

Note: Google Meet recordings are stored in Google Drive and accessed via Drive API.
Transcripts are auto-generated and stored alongside recordings.
"""
import os
import secrets
import httpx
from datetime import datetime, UTC, timedelta
from typing import Optional
from urllib.parse import urlencode
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from .database import get_db
from .models import User, GoogleMeetConnection, MeetingTranscript
from .auth import get_current_user
from .transcript_parser import parse_transcript
from .summarizer import summarize_transcript

logger = logging.getLogger(__name__)

router = APIRouter()

# ============ CONFIGURATION ============

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8001")

# Google OAuth 2.0 - reuse existing Google credentials
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_MEET_REDIRECT_URI = os.getenv("GOOGLE_MEET_REDIRECT_URI", f"{BACKEND_URL}/api/google-meet/callback")

# Google API endpoints
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3"
GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"

# Scopes for Meet transcript import
GOOGLE_MEET_SCOPES = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/calendar.readonly",
]

# In-memory state storage (use Redis in production)
_oauth_states: dict = {}


# ============ SCHEMAS ============

class GoogleMeetRecording(BaseModel):
    id: str
    name: str
    meeting_title: str
    created_time: Optional[str]
    modified_time: Optional[str]
    size: Optional[int]
    has_transcript: bool
    transcript_id: Optional[str]
    web_view_link: Optional[str]


class GoogleMeetConnectionStatus(BaseModel):
    connected: bool
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    connected_at: Optional[datetime] = None


# ============ HELPERS ============

async def refresh_google_token(connection: GoogleMeetConnection, db: Session) -> bool:
    """Refresh Google access token using refresh token."""
    if not connection.refresh_token:
        return False

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "refresh_token": connection.refresh_token,
                    "grant_type": "refresh_token",
                },
            )

            if response.status_code != 200:
                logger.error(f"Google token refresh failed: {response.status_code} - {response.text}")
                return False

            tokens = response.json()

            connection.access_token = tokens["access_token"]
            # Google doesn't always return a new refresh token
            if "refresh_token" in tokens:
                connection.refresh_token = tokens["refresh_token"]
            connection.token_expires_at = datetime.now(UTC) + timedelta(seconds=tokens.get("expires_in", 3600))
            connection.updated_at = datetime.now(UTC)
            db.commit()

            logger.info(f"Google token refreshed for connection {connection.id}")
            return True

    except Exception as e:
        logger.error(f"Google token refresh error: {e}")
        return False


async def get_valid_google_token(connection: GoogleMeetConnection, db: Session) -> Optional[str]:
    """Get a valid access token, refreshing if necessary."""
    if connection.token_expires_at:
        if connection.token_expires_at < datetime.now(UTC) + timedelta(minutes=5):
            if not await refresh_google_token(connection, db):
                return None

    return connection.access_token


async def google_api_request(
    connection: GoogleMeetConnection,
    db: Session,
    method: str,
    url: str,
    params: dict = None,
) -> Optional[dict]:
    """Make an authenticated request to Google API."""
    token = await get_valid_google_token(connection, db)
    if not token:
        raise HTTPException(status_code=401, detail="Google authentication expired. Please reconnect.")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method,
                url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json",
                },
                params=params,
            )

            if response.status_code == 401:
                # Try refresh and retry once
                if await refresh_google_token(connection, db):
                    token = connection.access_token
                    response = await client.request(
                        method,
                        url,
                        headers={
                            "Authorization": f"Bearer {token}",
                            "Accept": "application/json",
                        },
                        params=params,
                    )

            if response.status_code != 200:
                logger.error(f"Google API error: {response.status_code} - {response.text}")
                return None

            return response.json()

    except Exception as e:
        logger.error(f"Google API request error: {e}")
        return None


# ============ OAUTH ROUTES ============

@router.get("/login")
async def google_meet_login(
    current_user: User = Depends(get_current_user),
):
    """Get Google OAuth authorization URL for Meet integration."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google Meet integration not configured")

    # Generate state for CSRF protection
    state = secrets.token_urlsafe(32)
    _oauth_states[state] = {
        "user_id": current_user.id,
        "organization_id": current_user.organization_id,
        "created_at": datetime.now(UTC),
    }

    # Clean old states (older than 10 minutes)
    cutoff = datetime.now(UTC) - timedelta(minutes=10)
    expired = [k for k, v in _oauth_states.items() if v["created_at"] < cutoff]
    for k in expired:
        del _oauth_states[k]

    params = {
        "response_type": "code",
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_MEET_REDIRECT_URI,
        "scope": " ".join(GOOGLE_MEET_SCOPES),
        "state": state,
        "access_type": "offline",  # Required for refresh token
        "prompt": "consent",  # Force consent to get refresh token
    }

    auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    return {"auth_url": auth_url}


@router.get("/callback")
async def google_meet_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
):
    """Handle Google OAuth callback."""
    # Verify state
    state_data = _oauth_states.pop(state, None)
    if not state_data:
        return RedirectResponse(f"{FRONTEND_URL}/app/integrations?error=invalid_state")

    user_id = state_data["user_id"]
    organization_id = state_data["organization_id"]

    try:
        # Exchange code for tokens
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": GOOGLE_MEET_REDIRECT_URI,
                    "grant_type": "authorization_code",
                },
            )

            if response.status_code != 200:
                logger.error(f"Google token exchange failed: {response.status_code} - {response.text}")
                return RedirectResponse(f"{FRONTEND_URL}/app/integrations?error=token_exchange_failed")

            tokens = response.json()

        access_token = tokens["access_token"]
        refresh_token = tokens.get("refresh_token")
        expires_in = tokens.get("expires_in", 3600)

        # Get user info
        async with httpx.AsyncClient(timeout=30.0) as client:
            user_response = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )

            if user_response.status_code != 200:
                logger.error(f"Google user info failed: {user_response.status_code}")
                return RedirectResponse(f"{FRONTEND_URL}/app/integrations?error=user_info_failed")

            google_user = user_response.json()

        # Check for existing connection
        existing = db.query(GoogleMeetConnection).filter(
            GoogleMeetConnection.organization_id == organization_id,
            GoogleMeetConnection.google_user_id == google_user["id"],
        ).first()

        if existing:
            # Update existing connection
            existing.access_token = access_token
            if refresh_token:  # Only update if we got a new one
                existing.refresh_token = refresh_token
            existing.token_expires_at = datetime.now(UTC) + timedelta(seconds=expires_in)
            existing.google_email = google_user.get("email")
            existing.google_name = google_user.get("name")
            existing.is_active = True
            existing.updated_at = datetime.now(UTC)
        else:
            # Create new connection
            connection = GoogleMeetConnection(
                organization_id=organization_id,
                user_id=user_id,
                google_user_id=google_user["id"],
                google_email=google_user.get("email"),
                google_name=google_user.get("name"),
                access_token=access_token,
                refresh_token=refresh_token,
                token_expires_at=datetime.now(UTC) + timedelta(seconds=expires_in),
                scopes=",".join(GOOGLE_MEET_SCOPES),
                is_active=True,
            )
            db.add(connection)

        db.commit()

        return RedirectResponse(f"{FRONTEND_URL}/app/integrations?google-meet=connected")

    except Exception as e:
        logger.error(f"Google Meet callback error: {e}")
        return RedirectResponse(f"{FRONTEND_URL}/app/integrations?error=callback_failed")


@router.get("/status")
async def google_meet_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GoogleMeetConnectionStatus:
    """Get Google Meet connection status."""
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="User not in an organization")

    connection = db.query(GoogleMeetConnection).filter(
        GoogleMeetConnection.organization_id == current_user.organization_id,
        GoogleMeetConnection.is_active == True,
    ).first()

    if not connection:
        return GoogleMeetConnectionStatus(connected=False)

    return GoogleMeetConnectionStatus(
        connected=True,
        user_email=connection.google_email,
        user_name=connection.google_name,
        connected_at=connection.created_at,
    )


@router.delete("/disconnect")
async def google_meet_disconnect(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Disconnect Google Meet account."""
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="User not in an organization")

    connection = db.query(GoogleMeetConnection).filter(
        GoogleMeetConnection.organization_id == current_user.organization_id,
        GoogleMeetConnection.is_active == True,
    ).first()

    if connection:
        connection.is_active = False
        connection.updated_at = datetime.now(UTC)
        db.commit()

    return {"ok": True, "message": "Google Meet disconnected"}


# ============ RECORDINGS ROUTES ============

@router.get("/recordings")
async def list_recordings(
    days_back: int = Query(30, description="Number of days to look back"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List Google Meet recordings from Google Drive."""
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="User not in an organization")

    connection = db.query(GoogleMeetConnection).filter(
        GoogleMeetConnection.organization_id == current_user.organization_id,
        GoogleMeetConnection.is_active == True,
    ).first()

    if not connection:
        raise HTTPException(status_code=400, detail="Google Meet not connected. Please connect your Google account first.")

    # Search for Meet recordings in Google Drive
    # Meet recordings are stored with specific naming patterns
    from_date = (datetime.now(UTC) - timedelta(days=days_back)).strftime("%Y-%m-%dT%H:%M:%S")

    # Search query for Meet recordings (video files in Meet Recordings folder)
    query = f"(name contains 'Meet Recording' or fullText contains 'meet.google.com') and mimeType contains 'video' and modifiedTime > '{from_date}'"

    params = {
        "q": query,
        "fields": "files(id,name,createdTime,modifiedTime,size,webViewLink,mimeType)",
        "orderBy": "modifiedTime desc",
        "pageSize": 50,
    }

    data = await google_api_request(connection, db, "GET", f"{GOOGLE_DRIVE_API}/files", params)

    if not data:
        raise HTTPException(status_code=500, detail="Failed to fetch recordings from Google Drive")

    recordings = []
    for file in data.get("files", []):
        # Check for associated transcript (SBV/VTT file with similar name)
        transcript_query = f"name contains '{file['name'].replace('.mp4', '')}' and (mimeType = 'text/vtt' or mimeType = 'text/plain' or name contains '.sbv' or name contains '.vtt' or name contains 'transcript')"
        transcript_params = {
            "q": transcript_query,
            "fields": "files(id,name)",
            "pageSize": 5,
        }

        transcript_data = await google_api_request(connection, db, "GET", f"{GOOGLE_DRIVE_API}/files", transcript_params)
        transcript_files = transcript_data.get("files", []) if transcript_data else []

        has_transcript = len(transcript_files) > 0
        transcript_id = transcript_files[0]["id"] if transcript_files else None

        recordings.append({
            "id": file["id"],
            "name": file["name"],
            "meeting_title": file["name"].replace("Meet Recording - ", "").replace(".mp4", ""),
            "created_time": file.get("createdTime"),
            "modified_time": file.get("modifiedTime"),
            "size": int(file.get("size", 0)) if file.get("size") else None,
            "has_transcript": has_transcript,
            "transcript_id": transcript_id,
            "web_view_link": file.get("webViewLink"),
        })

    return {
        "recordings": recordings,
        "total_records": len(recordings),
    }


@router.post("/recordings/{recording_id}/import")
async def import_transcript(
    recording_id: str,
    transcript_id: str = Query(None, description="Transcript file ID if known"),
    generate_summary: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Import transcript from Google Meet recording."""
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="User not in an organization")

    if current_user.role not in ["admin", "editor"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    connection = db.query(GoogleMeetConnection).filter(
        GoogleMeetConnection.organization_id == current_user.organization_id,
        GoogleMeetConnection.is_active == True,
    ).first()

    if not connection:
        raise HTTPException(status_code=400, detail="Google Meet not connected")

    # Get recording file info
    file_data = await google_api_request(
        connection, db, "GET",
        f"{GOOGLE_DRIVE_API}/files/{recording_id}",
        {"fields": "id,name,createdTime,mimeType"}
    )

    if not file_data:
        raise HTTPException(status_code=404, detail="Recording not found")

    # Find or use provided transcript ID
    if not transcript_id:
        # Search for transcript
        base_name = file_data["name"].replace(".mp4", "")
        transcript_query = f"name contains '{base_name}' and (name contains '.sbv' or name contains '.vtt' or name contains 'transcript')"
        transcript_params = {
            "q": transcript_query,
            "fields": "files(id,name)",
            "pageSize": 5,
        }

        transcript_data = await google_api_request(connection, db, "GET", f"{GOOGLE_DRIVE_API}/files", transcript_params)
        transcript_files = transcript_data.get("files", []) if transcript_data else []

        if not transcript_files:
            raise HTTPException(status_code=400, detail="No transcript found for this recording")

        transcript_id = transcript_files[0]["id"]

    # Download transcript content
    token = await get_valid_google_token(connection, db)
    if not token:
        raise HTTPException(status_code=401, detail="Google authentication expired")

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            download_response = await client.get(
                f"{GOOGLE_DRIVE_API}/files/{transcript_id}?alt=media",
                headers={"Authorization": f"Bearer {token}"},
            )

            if download_response.status_code != 200:
                logger.error(f"Transcript download failed: {download_response.status_code}")
                raise HTTPException(status_code=500, detail="Failed to download transcript")

            transcript_content = download_response.text

    except Exception as e:
        logger.error(f"Transcript download error: {e}")
        raise HTTPException(status_code=500, detail="Failed to download transcript")

    # Determine format and parse
    file_format = "vtt"  # Default
    if transcript_content.startswith("WEBVTT"):
        file_format = "vtt"
    elif transcript_content.strip().split('\n')[0].isdigit():
        file_format = "sbv"

    parsed = parse_transcript(transcript_content, file_format)

    # Check if already imported
    existing = db.query(MeetingTranscript).filter(
        MeetingTranscript.organization_id == current_user.organization_id,
        MeetingTranscript.platform == "google-meet",
        MeetingTranscript.file_name == f"meet_{recording_id}.{file_format}",
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="This transcript has already been imported")

    # Save transcript file
    import uuid as uuid_module
    unique_filename = f"{uuid_module.uuid4()}.{file_format}"

    if os.path.exists("/app"):
        transcripts_dir = "/app/uploads/transcripts"
    else:
        transcripts_dir = "uploads/transcripts"

    os.makedirs(transcripts_dir, exist_ok=True)
    file_path = os.path.join(transcripts_dir, unique_filename)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(transcript_content)

    # Generate AI summary if requested
    summary_data = None
    if generate_summary and parsed.text:
        from .main import check_ai_usage_limit, increment_ai_usage

        can_use, used, limit = check_ai_usage_limit(db, current_user.organization_id)
        if can_use:
            summary_data = summarize_transcript(parsed.text)
            if summary_data:
                increment_ai_usage(db, current_user.organization_id)

    # Parse meeting date
    meeting_date = None
    if file_data.get("createdTime"):
        try:
            meeting_date = datetime.fromisoformat(file_data["createdTime"].replace("Z", "+00:00"))
        except:
            pass

    # Create transcript record
    transcript = MeetingTranscript(
        organization_id=current_user.organization_id,
        title=file_data.get("name", "Google Meet Recording").replace(".mp4", ""),
        meeting_date=meeting_date,
        meeting_type="general",
        platform="google-meet",
        file_path=unique_filename,
        file_name=f"meet_{recording_id}.{file_format}",
        file_size=len(transcript_content.encode()),
        file_format=file_format,
        transcript_text=parsed.text,
        duration_seconds=parsed.duration_seconds,
        word_count=parsed.word_count,
        speaker_count=parsed.speaker_count,
        summary=summary_data.summary if summary_data else None,
        action_items=json.dumps(summary_data.action_items) if summary_data else None,
        key_points=json.dumps(summary_data.key_points) if summary_data else None,
        summary_generated_at=datetime.now(UTC) if summary_data else None,
    )

    db.add(transcript)
    db.commit()
    db.refresh(transcript)

    return {
        "id": transcript.id,
        "title": transcript.title,
        "meeting_date": transcript.meeting_date.isoformat() if transcript.meeting_date else None,
        "duration_seconds": transcript.duration_seconds,
        "word_count": transcript.word_count,
        "speaker_count": transcript.speaker_count,
        "summary": transcript.summary,
        "action_items": json.loads(transcript.action_items) if transcript.action_items else [],
        "key_points": json.loads(transcript.key_points) if transcript.key_points else [],
        "message": "Transcript imported successfully",
    }
