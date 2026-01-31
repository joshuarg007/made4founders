"""
Zoom OAuth integration for importing meeting transcripts.

Supports:
- OAuth 2.0 authorization flow
- List cloud recordings
- Download transcript files (VTT)
- Import transcripts into Made4Founders
"""
import os
import secrets
import httpx
from datetime import datetime, UTC, timedelta
from typing import Optional, List
from urllib.parse import urlencode
import base64
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from .database import get_db
from .models import User, ZoomConnection, MeetingTranscript
from .auth import get_current_user
from .transcript_parser import parse_transcript
from .summarizer import summarize_transcript

logger = logging.getLogger(__name__)

router = APIRouter()

# ============ CONFIGURATION ============

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8001")

# Zoom OAuth 2.0
ZOOM_CLIENT_ID = os.getenv("ZOOM_CLIENT_ID", "")
ZOOM_CLIENT_SECRET = os.getenv("ZOOM_CLIENT_SECRET", "")
ZOOM_REDIRECT_URI = f"{BACKEND_URL}/api/zoom/callback"

# Zoom API endpoints
ZOOM_AUTH_URL = "https://zoom.us/oauth/authorize"
ZOOM_TOKEN_URL = "https://zoom.us/oauth/token"
ZOOM_API_BASE = "https://api.zoom.us/v2"

# Scopes for transcript import
ZOOM_SCOPES = [
    "cloud_recording:read:list_user_recordings",
    "cloud_recording:read:recording",
    "user:read:user",
    "meeting:read:past_meeting",
    "meeting:read:meeting",
]

# In-memory state storage (use Redis in production)
_oauth_states: dict = {}


# ============ SCHEMAS ============

class ZoomRecording(BaseModel):
    id: str
    meeting_id: str
    topic: str
    start_time: Optional[str]
    duration: Optional[int]
    total_size: Optional[int]
    recording_count: Optional[int]
    has_transcript: bool
    transcript_url: Optional[str]


class ZoomConnectionStatus(BaseModel):
    connected: bool
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    connected_at: Optional[datetime] = None


# ============ HELPERS ============

def get_zoom_auth_header() -> str:
    """Generate Basic auth header for Zoom token requests."""
    credentials = f"{ZOOM_CLIENT_ID}:{ZOOM_CLIENT_SECRET}"
    encoded = base64.b64encode(credentials.encode()).decode()
    return f"Basic {encoded}"


async def refresh_zoom_token(connection: ZoomConnection, db: Session) -> bool:
    """Refresh Zoom access token using refresh token."""
    if not connection.refresh_token:
        return False

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                ZOOM_TOKEN_URL,
                headers={
                    "Authorization": get_zoom_auth_header(),
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": connection.refresh_token,
                },
            )

            if response.status_code != 200:
                logger.error(f"Zoom token refresh failed: {response.status_code} - {response.text}")
                return False

            tokens = response.json()

            connection.access_token = tokens["access_token"]
            if "refresh_token" in tokens:
                connection.refresh_token = tokens["refresh_token"]
            connection.token_expires_at = datetime.now(UTC) + timedelta(seconds=tokens.get("expires_in", 3600))
            connection.updated_at = datetime.now(UTC)
            db.commit()

            logger.info(f"Zoom token refreshed for connection {connection.id}")
            return True

    except Exception as e:
        logger.error(f"Zoom token refresh error: {e}")
        return False


async def get_valid_zoom_token(connection: ZoomConnection, db: Session) -> Optional[str]:
    """Get a valid access token, refreshing if necessary."""
    # Check if token is expired or about to expire (5 min buffer)
    if connection.token_expires_at:
        if connection.token_expires_at < datetime.now(UTC) + timedelta(minutes=5):
            if not await refresh_zoom_token(connection, db):
                return None

    return connection.access_token


async def zoom_api_request(
    connection: ZoomConnection,
    db: Session,
    method: str,
    endpoint: str,
    params: dict = None,
) -> Optional[dict]:
    """Make an authenticated request to Zoom API."""
    token = await get_valid_zoom_token(connection, db)
    if not token:
        raise HTTPException(status_code=401, detail="Zoom authentication expired. Please reconnect.")

    url = f"{ZOOM_API_BASE}{endpoint}"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method,
                url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                params=params,
            )

            if response.status_code == 401:
                # Try refresh and retry once
                if await refresh_zoom_token(connection, db):
                    token = connection.access_token
                    response = await client.request(
                        method,
                        url,
                        headers={
                            "Authorization": f"Bearer {token}",
                            "Content-Type": "application/json",
                        },
                        params=params,
                    )

            if response.status_code != 200:
                logger.error(f"Zoom API error: {response.status_code} - {response.text}")
                return None

            return response.json()

    except Exception as e:
        logger.error(f"Zoom API request error: {e}")
        return None


# ============ OAUTH ROUTES ============

@router.get("/login")
async def zoom_login(
    current_user: User = Depends(get_current_user),
):
    """Get Zoom OAuth authorization URL."""
    if not ZOOM_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Zoom integration not configured")

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
        "client_id": ZOOM_CLIENT_ID,
        "redirect_uri": ZOOM_REDIRECT_URI,
        "state": state,
    }

    auth_url = f"{ZOOM_AUTH_URL}?{urlencode(params)}"
    return {"auth_url": auth_url}


@router.get("/callback")
async def zoom_callback(
    code: str = Query(...),
    state: str = Query(None),
    db: Session = Depends(get_db),
):
    """Handle Zoom OAuth callback."""
    # Verify state (if provided)
    if state:
        state_data = _oauth_states.pop(state, None)
        if not state_data:
            return RedirectResponse(f"{FRONTEND_URL}/app/integrations?error=invalid_state")
    else:
        # No state - redirect to login to start proper OAuth flow
        return RedirectResponse(f"{FRONTEND_URL}/app/integrations?error=missing_state&message=Please+connect+via+Integrations+page")

    user_id = state_data["user_id"]
    organization_id = state_data["organization_id"]

    try:
        # Exchange code for tokens
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                ZOOM_TOKEN_URL,
                headers={
                    "Authorization": get_zoom_auth_header(),
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": ZOOM_REDIRECT_URI,
                },
            )

            if response.status_code != 200:
                logger.error(f"Zoom token exchange failed: {response.status_code} - {response.text}")
                return RedirectResponse(f"{FRONTEND_URL}/app/meetings?error=token_exchange_failed")

            tokens = response.json()

        access_token = tokens["access_token"]
        refresh_token = tokens.get("refresh_token")
        expires_in = tokens.get("expires_in", 3600)

        # Get user info
        async with httpx.AsyncClient(timeout=30.0) as client:
            user_response = await client.get(
                f"{ZOOM_API_BASE}/users/me",
                headers={"Authorization": f"Bearer {access_token}"},
            )

            if user_response.status_code != 200:
                logger.error(f"Zoom user info failed: {user_response.status_code}")
                return RedirectResponse(f"{FRONTEND_URL}/app/meetings?error=user_info_failed")

            zoom_user = user_response.json()

        # Check for existing connection
        existing = db.query(ZoomConnection).filter(
            ZoomConnection.organization_id == organization_id,
            ZoomConnection.zoom_user_id == zoom_user["id"],
        ).first()

        if existing:
            # Update existing connection
            existing.access_token = access_token
            existing.refresh_token = refresh_token
            existing.token_expires_at = datetime.now(UTC) + timedelta(seconds=expires_in)
            existing.zoom_email = zoom_user.get("email")
            existing.zoom_name = zoom_user.get("first_name", "") + " " + zoom_user.get("last_name", "")
            existing.is_active = True
            existing.updated_at = datetime.now(UTC)
        else:
            # Create new connection
            connection = ZoomConnection(
                organization_id=organization_id,
                user_id=user_id,
                zoom_user_id=zoom_user["id"],
                zoom_email=zoom_user.get("email"),
                zoom_name=zoom_user.get("first_name", "") + " " + zoom_user.get("last_name", ""),
                access_token=access_token,
                refresh_token=refresh_token,
                token_expires_at=datetime.now(UTC) + timedelta(seconds=expires_in),
                scopes=",".join(ZOOM_SCOPES),
                is_active=True,
            )
            db.add(connection)

        db.commit()

        return RedirectResponse(f"{FRONTEND_URL}/app/meetings?zoom=connected")

    except Exception as e:
        logger.error(f"Zoom callback error: {e}")
        return RedirectResponse(f"{FRONTEND_URL}/app/meetings?error=callback_failed")


@router.get("/status")
async def zoom_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ZoomConnectionStatus:
    """Get Zoom connection status."""
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="User not in an organization")

    connection = db.query(ZoomConnection).filter(
        ZoomConnection.organization_id == current_user.organization_id,
        ZoomConnection.is_active == True,
    ).first()

    if not connection:
        return ZoomConnectionStatus(connected=False)

    return ZoomConnectionStatus(
        connected=True,
        user_email=connection.zoom_email,
        user_name=connection.zoom_name,
        connected_at=connection.created_at,
    )


@router.delete("/disconnect")
async def zoom_disconnect(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Disconnect Zoom account."""
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="User not in an organization")

    connection = db.query(ZoomConnection).filter(
        ZoomConnection.organization_id == current_user.organization_id,
        ZoomConnection.is_active == True,
    ).first()

    if connection:
        connection.is_active = False
        connection.updated_at = datetime.now(UTC)
        db.commit()

    return {"ok": True, "message": "Zoom disconnected"}


# ============ RECORDINGS ROUTES ============

@router.get("/recordings")
async def list_recordings(
    from_date: str = Query(None, description="Start date (YYYY-MM-DD)"),
    to_date: str = Query(None, description="End date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List Zoom cloud recordings with transcript availability."""
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="User not in an organization")

    connection = db.query(ZoomConnection).filter(
        ZoomConnection.organization_id == current_user.organization_id,
        ZoomConnection.is_active == True,
    ).first()

    if not connection:
        raise HTTPException(status_code=400, detail="Zoom not connected. Please connect your Zoom account first.")

    # Default to last 30 days
    if not from_date:
        from_date = (datetime.now(UTC) - timedelta(days=30)).strftime("%Y-%m-%d")
    if not to_date:
        to_date = datetime.now(UTC).strftime("%Y-%m-%d")

    params = {
        "from": from_date,
        "to": to_date,
        "page_size": 100,
    }

    data = await zoom_api_request(connection, db, "GET", "/users/me/recordings", params)

    if not data:
        raise HTTPException(status_code=500, detail="Failed to fetch recordings from Zoom")

    recordings = []
    for meeting in data.get("meetings", []):
        # Check if meeting has transcript
        has_transcript = False
        transcript_url = None

        for file in meeting.get("recording_files", []):
            if file.get("file_type") == "TRANSCRIPT" or file.get("recording_type") == "audio_transcript":
                has_transcript = True
                transcript_url = file.get("download_url")
                break

        recordings.append({
            "id": meeting.get("uuid"),
            "meeting_id": str(meeting.get("id")),
            "topic": meeting.get("topic", "Untitled Meeting"),
            "start_time": meeting.get("start_time"),
            "duration": meeting.get("duration"),
            "total_size": meeting.get("total_size"),
            "recording_count": len(meeting.get("recording_files", [])),
            "has_transcript": has_transcript,
            "transcript_url": transcript_url,
        })

    return {
        "recordings": recordings,
        "total_records": data.get("total_records", len(recordings)),
        "from_date": from_date,
        "to_date": to_date,
    }


@router.get("/recordings/{recording_id}")
async def get_recording(
    recording_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get details of a specific recording."""
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="User not in an organization")

    connection = db.query(ZoomConnection).filter(
        ZoomConnection.organization_id == current_user.organization_id,
        ZoomConnection.is_active == True,
    ).first()

    if not connection:
        raise HTTPException(status_code=400, detail="Zoom not connected")

    # URL encode the recording_id (it may contain special chars)
    from urllib.parse import quote
    encoded_id = quote(recording_id, safe='')

    data = await zoom_api_request(connection, db, "GET", f"/meetings/{encoded_id}/recordings")

    if not data:
        raise HTTPException(status_code=404, detail="Recording not found")

    # Find transcript file
    transcript_file = None
    for file in data.get("recording_files", []):
        if file.get("file_type") == "TRANSCRIPT" or file.get("recording_type") == "audio_transcript":
            transcript_file = file
            break

    return {
        "id": data.get("uuid"),
        "meeting_id": str(data.get("id")),
        "topic": data.get("topic", "Untitled Meeting"),
        "start_time": data.get("start_time"),
        "duration": data.get("duration"),
        "recording_files": data.get("recording_files", []),
        "transcript_file": transcript_file,
    }


@router.post("/recordings/{recording_id}/import")
async def import_transcript(
    recording_id: str,
    generate_summary: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Import transcript from Zoom recording."""
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="User not in an organization")

    if current_user.role not in ["admin", "editor"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    connection = db.query(ZoomConnection).filter(
        ZoomConnection.organization_id == current_user.organization_id,
        ZoomConnection.is_active == True,
    ).first()

    if not connection:
        raise HTTPException(status_code=400, detail="Zoom not connected")

    # Get recording details
    from urllib.parse import quote
    encoded_id = quote(recording_id, safe='')

    data = await zoom_api_request(connection, db, "GET", f"/meetings/{encoded_id}/recordings")

    if not data:
        raise HTTPException(status_code=404, detail="Recording not found")

    # Find transcript file
    transcript_file = None
    for file in data.get("recording_files", []):
        if file.get("file_type") == "TRANSCRIPT" or file.get("recording_type") == "audio_transcript":
            transcript_file = file
            break

    if not transcript_file:
        raise HTTPException(status_code=400, detail="No transcript available for this recording")

    download_url = transcript_file.get("download_url")
    if not download_url:
        raise HTTPException(status_code=400, detail="Transcript download URL not available")

    # Download transcript
    token = await get_valid_zoom_token(connection, db)
    if not token:
        raise HTTPException(status_code=401, detail="Zoom authentication expired")

    try:
        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            # Zoom download URLs need the access token as a query parameter
            download_response = await client.get(
                download_url,
                params={"access_token": token},
            )

            if download_response.status_code != 200:
                logger.error(f"Transcript download failed: {download_response.status_code}")
                raise HTTPException(status_code=500, detail="Failed to download transcript")

            transcript_content = download_response.text

    except Exception as e:
        logger.error(f"Transcript download error: {e}")
        raise HTTPException(status_code=500, detail="Failed to download transcript")

    # Parse transcript
    file_ext = ".vtt"  # Zoom transcripts are typically VTT format
    parsed = parse_transcript(transcript_content, "vtt")

    # Check if already imported
    existing = db.query(MeetingTranscript).filter(
        MeetingTranscript.organization_id == current_user.organization_id,
        MeetingTranscript.platform == "zoom",
        MeetingTranscript.file_name == f"zoom_{recording_id}.vtt",
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="This transcript has already been imported")

    # Save transcript file
    import uuid as uuid_module
    unique_filename = f"{uuid_module.uuid4()}.vtt"

    # Get transcripts directory
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
        # Import AI usage check
        from .main import check_ai_usage_limit, increment_ai_usage

        can_use, used, limit = check_ai_usage_limit(db, current_user.organization_id)
        if can_use:
            summary_data = summarize_transcript(parsed.text)
            if summary_data:
                increment_ai_usage(db, current_user.organization_id)

    # Parse meeting date
    meeting_date = None
    if data.get("start_time"):
        try:
            meeting_date = datetime.fromisoformat(data["start_time"].replace("Z", "+00:00"))
        except:
            pass

    # Create transcript record
    transcript = MeetingTranscript(
        organization_id=current_user.organization_id,
        title=data.get("topic", "Zoom Meeting"),
        meeting_date=meeting_date,
        meeting_type="general",
        platform="zoom",
        file_path=unique_filename,
        file_name=f"zoom_{recording_id}.vtt",
        file_size=len(transcript_content.encode()),
        file_format="vtt",
        transcript_text=parsed.text,
        duration_seconds=parsed.duration_seconds or (data.get("duration", 0) * 60),
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
