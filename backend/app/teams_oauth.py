"""
Microsoft Teams OAuth integration for importing meeting transcripts.

Uses Microsoft Graph API to:
- List Teams meeting recordings from OneDrive/SharePoint
- Download transcript files
- Import transcripts into Made4Founders

Requires Azure AD app registration with appropriate permissions.
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
from .models import User, TeamsConnection, MeetingTranscript
from .auth import get_current_user
from .transcript_parser import parse_transcript
from .summarizer import summarize_transcript

logger = logging.getLogger(__name__)

router = APIRouter()

# ============ CONFIGURATION ============

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8001")

# Microsoft OAuth 2.0
TEAMS_CLIENT_ID = os.getenv("TEAMS_CLIENT_ID", "")
TEAMS_CLIENT_SECRET = os.getenv("TEAMS_CLIENT_SECRET", "")
TEAMS_TENANT_ID = os.getenv("TEAMS_TENANT_ID", "common")  # 'common' for multi-tenant
TEAMS_REDIRECT_URI = os.getenv("TEAMS_REDIRECT_URI", f"{BACKEND_URL}/api/teams/callback")

# Microsoft endpoints
MICROSOFT_AUTH_URL = f"https://login.microsoftonline.com/{TEAMS_TENANT_ID}/oauth2/v2.0/authorize"
MICROSOFT_TOKEN_URL = f"https://login.microsoftonline.com/{TEAMS_TENANT_ID}/oauth2/v2.0/token"
GRAPH_API_BASE = "https://graph.microsoft.com/v1.0"
GRAPH_API_BETA = "https://graph.microsoft.com/beta"

# Scopes for Teams transcript import
TEAMS_SCOPES = [
    "openid",
    "profile",
    "email",
    "offline_access",  # Required for refresh token
    "User.Read",
    "OnlineMeetings.Read",
    "OnlineMeetingTranscript.Read.All",
    "Files.Read.All",  # For recordings stored in OneDrive
]

# In-memory state storage (use Redis in production)
_oauth_states: dict = {}


# ============ SCHEMAS ============

class TeamsRecording(BaseModel):
    id: str
    meeting_id: str
    subject: str
    start_time: Optional[str]
    end_time: Optional[str]
    organizer: Optional[str]
    has_transcript: bool
    transcript_id: Optional[str]


class TeamsConnectionStatus(BaseModel):
    connected: bool
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    connected_at: Optional[datetime] = None


# ============ HELPERS ============

async def refresh_teams_token(connection: TeamsConnection, db: Session) -> bool:
    """Refresh Microsoft access token using refresh token."""
    if not connection.refresh_token:
        return False

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Use the tenant from the connection or default
            token_url = f"https://login.microsoftonline.com/{connection.tenant_id or 'common'}/oauth2/v2.0/token"

            response = await client.post(
                token_url,
                data={
                    "client_id": TEAMS_CLIENT_ID,
                    "client_secret": TEAMS_CLIENT_SECRET,
                    "refresh_token": connection.refresh_token,
                    "grant_type": "refresh_token",
                    "scope": " ".join(TEAMS_SCOPES),
                },
            )

            if response.status_code != 200:
                logger.error(f"Teams token refresh failed: {response.status_code} - {response.text}")
                return False

            tokens = response.json()

            connection.access_token = tokens["access_token"]
            if "refresh_token" in tokens:
                connection.refresh_token = tokens["refresh_token"]
            connection.token_expires_at = datetime.now(UTC) + timedelta(seconds=tokens.get("expires_in", 3600))
            connection.updated_at = datetime.now(UTC)
            db.commit()

            logger.info(f"Teams token refreshed for connection {connection.id}")
            return True

    except Exception as e:
        logger.error(f"Teams token refresh error: {e}")
        return False


async def get_valid_teams_token(connection: TeamsConnection, db: Session) -> Optional[str]:
    """Get a valid access token, refreshing if necessary."""
    if connection.token_expires_at:
        if connection.token_expires_at < datetime.now(UTC) + timedelta(minutes=5):
            if not await refresh_teams_token(connection, db):
                return None

    return connection.access_token


async def graph_api_request(
    connection: TeamsConnection,
    db: Session,
    method: str,
    endpoint: str,
    params: dict = None,
    use_beta: bool = False,
) -> Optional[dict]:
    """Make an authenticated request to Microsoft Graph API."""
    token = await get_valid_teams_token(connection, db)
    if not token:
        raise HTTPException(status_code=401, detail="Microsoft authentication expired. Please reconnect.")

    base_url = GRAPH_API_BETA if use_beta else GRAPH_API_BASE
    url = f"{base_url}{endpoint}"

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
                if await refresh_teams_token(connection, db):
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

            if response.status_code not in [200, 201]:
                logger.error(f"Graph API error: {response.status_code} - {response.text}")
                return None

            return response.json()

    except Exception as e:
        logger.error(f"Graph API request error: {e}")
        return None


# ============ OAUTH ROUTES ============

@router.get("/login")
async def teams_login(
    current_user: User = Depends(get_current_user),
):
    """Get Microsoft OAuth authorization URL for Teams integration."""
    if not TEAMS_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Microsoft Teams integration not configured")

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
        "client_id": TEAMS_CLIENT_ID,
        "redirect_uri": TEAMS_REDIRECT_URI,
        "scope": " ".join(TEAMS_SCOPES),
        "state": state,
        "response_mode": "query",
    }

    auth_url = f"{MICROSOFT_AUTH_URL}?{urlencode(params)}"
    return {"auth_url": auth_url}


@router.get("/callback")
async def teams_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
):
    """Handle Microsoft OAuth callback."""
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
                MICROSOFT_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": TEAMS_CLIENT_ID,
                    "client_secret": TEAMS_CLIENT_SECRET,
                    "redirect_uri": TEAMS_REDIRECT_URI,
                    "grant_type": "authorization_code",
                    "scope": " ".join(TEAMS_SCOPES),
                },
            )

            if response.status_code != 200:
                logger.error(f"Teams token exchange failed: {response.status_code} - {response.text}")
                return RedirectResponse(f"{FRONTEND_URL}/app/integrations?error=token_exchange_failed")

            tokens = response.json()

        access_token = tokens["access_token"]
        refresh_token = tokens.get("refresh_token")
        expires_in = tokens.get("expires_in", 3600)

        # Get user info from Graph API
        async with httpx.AsyncClient(timeout=30.0) as client:
            user_response = await client.get(
                f"{GRAPH_API_BASE}/me",
                headers={"Authorization": f"Bearer {access_token}"},
            )

            if user_response.status_code != 200:
                logger.error(f"Teams user info failed: {user_response.status_code}")
                return RedirectResponse(f"{FRONTEND_URL}/app/integrations?error=user_info_failed")

            ms_user = user_response.json()

        # Extract tenant ID from token (it's in the 'tid' claim)
        import base64
        try:
            # Decode JWT payload (middle part)
            payload = access_token.split('.')[1]
            # Add padding if needed
            padding = 4 - len(payload) % 4
            if padding != 4:
                payload += '=' * padding
            decoded = json.loads(base64.urlsafe_b64decode(payload))
            tenant_id = decoded.get('tid', TEAMS_TENANT_ID)
        except:
            tenant_id = TEAMS_TENANT_ID

        # Check for existing connection
        existing = db.query(TeamsConnection).filter(
            TeamsConnection.organization_id == organization_id,
            TeamsConnection.microsoft_user_id == ms_user["id"],
        ).first()

        if existing:
            # Update existing connection
            existing.access_token = access_token
            if refresh_token:
                existing.refresh_token = refresh_token
            existing.token_expires_at = datetime.now(UTC) + timedelta(seconds=expires_in)
            existing.microsoft_email = ms_user.get("mail") or ms_user.get("userPrincipalName")
            existing.microsoft_name = ms_user.get("displayName")
            existing.tenant_id = tenant_id
            existing.is_active = True
            existing.updated_at = datetime.now(UTC)
        else:
            # Create new connection
            connection = TeamsConnection(
                organization_id=organization_id,
                user_id=user_id,
                microsoft_user_id=ms_user["id"],
                microsoft_email=ms_user.get("mail") or ms_user.get("userPrincipalName"),
                microsoft_name=ms_user.get("displayName"),
                tenant_id=tenant_id,
                access_token=access_token,
                refresh_token=refresh_token,
                token_expires_at=datetime.now(UTC) + timedelta(seconds=expires_in),
                scopes=",".join(TEAMS_SCOPES),
                is_active=True,
            )
            db.add(connection)

        db.commit()

        return RedirectResponse(f"{FRONTEND_URL}/app/integrations?teams=connected")

    except Exception as e:
        logger.error(f"Teams callback error: {e}")
        return RedirectResponse(f"{FRONTEND_URL}/app/integrations?error=callback_failed")


@router.get("/status")
async def teams_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TeamsConnectionStatus:
    """Get Microsoft Teams connection status."""
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="User not in an organization")

    connection = db.query(TeamsConnection).filter(
        TeamsConnection.organization_id == current_user.organization_id,
        TeamsConnection.is_active == True,
    ).first()

    if not connection:
        return TeamsConnectionStatus(connected=False)

    return TeamsConnectionStatus(
        connected=True,
        user_email=connection.microsoft_email,
        user_name=connection.microsoft_name,
        connected_at=connection.created_at,
    )


@router.delete("/disconnect")
async def teams_disconnect(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Disconnect Microsoft Teams account."""
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="User not in an organization")

    connection = db.query(TeamsConnection).filter(
        TeamsConnection.organization_id == current_user.organization_id,
        TeamsConnection.is_active == True,
    ).first()

    if connection:
        connection.is_active = False
        connection.updated_at = datetime.now(UTC)
        db.commit()

    return {"ok": True, "message": "Microsoft Teams disconnected"}


# ============ RECORDINGS ROUTES ============

@router.get("/recordings")
async def list_recordings(
    days_back: int = Query(30, description="Number of days to look back"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List Teams meeting recordings with transcript availability."""
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="User not in an organization")

    connection = db.query(TeamsConnection).filter(
        TeamsConnection.organization_id == current_user.organization_id,
        TeamsConnection.is_active == True,
    ).first()

    if not connection:
        raise HTTPException(status_code=400, detail="Microsoft Teams not connected. Please connect your Teams account first.")

    # Get online meetings from the user (uses beta API for transcripts)
    from_date = (datetime.now(UTC) - timedelta(days=days_back)).strftime("%Y-%m-%dT%H:%M:%SZ")

    # List user's online meetings
    params = {
        "$filter": f"startDateTime ge {from_date}",
        "$orderby": "startDateTime desc",
        "$top": 50,
    }

    # Use beta API for meeting transcripts
    data = await graph_api_request(connection, db, "GET", "/me/onlineMeetings", params, use_beta=True)

    if not data:
        # Fallback: try to get meetings from calendar
        calendar_params = {
            "$filter": f"start/dateTime ge '{from_date}' and isOnlineMeeting eq true",
            "$orderby": "start/dateTime desc",
            "$top": 50,
            "$select": "id,subject,start,end,organizer,onlineMeeting",
        }
        data = await graph_api_request(connection, db, "GET", "/me/calendar/events", calendar_params)

        if not data:
            raise HTTPException(status_code=500, detail="Failed to fetch meetings from Teams")

        # Transform calendar events to meetings format
        meetings = []
        for event in data.get("value", []):
            meetings.append({
                "id": event.get("id"),
                "meeting_id": event.get("onlineMeeting", {}).get("joinUrl", ""),
                "subject": event.get("subject", "Teams Meeting"),
                "start_time": event.get("start", {}).get("dateTime"),
                "end_time": event.get("end", {}).get("dateTime"),
                "organizer": event.get("organizer", {}).get("emailAddress", {}).get("name"),
                "has_transcript": False,  # Would need separate API call to check
                "transcript_id": None,
            })

        return {
            "recordings": meetings,
            "total_records": len(meetings),
        }

    recordings = []
    for meeting in data.get("value", []):
        meeting_id = meeting.get("id")

        # Check for transcripts (beta API)
        has_transcript = False
        transcript_id = None

        try:
            transcripts_data = await graph_api_request(
                connection, db, "GET",
                f"/me/onlineMeetings/{meeting_id}/transcripts",
                use_beta=True
            )
            if transcripts_data and transcripts_data.get("value"):
                has_transcript = True
                transcript_id = transcripts_data["value"][0].get("id")
        except:
            pass

        recordings.append({
            "id": meeting_id,
            "meeting_id": meeting_id,
            "subject": meeting.get("subject", "Teams Meeting"),
            "start_time": meeting.get("startDateTime"),
            "end_time": meeting.get("endDateTime"),
            "organizer": meeting.get("participants", {}).get("organizer", {}).get("identity", {}).get("user", {}).get("displayName"),
            "has_transcript": has_transcript,
            "transcript_id": transcript_id,
        })

    return {
        "recordings": recordings,
        "total_records": len(recordings),
    }


@router.post("/recordings/{meeting_id}/import")
async def import_transcript(
    meeting_id: str,
    transcript_id: str = Query(None, description="Transcript ID if known"),
    generate_summary: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Import transcript from Teams meeting."""
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="User not in an organization")

    if current_user.role not in ["admin", "editor"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    connection = db.query(TeamsConnection).filter(
        TeamsConnection.organization_id == current_user.organization_id,
        TeamsConnection.is_active == True,
    ).first()

    if not connection:
        raise HTTPException(status_code=400, detail="Microsoft Teams not connected")

    # Get meeting info
    meeting_data = await graph_api_request(
        connection, db, "GET",
        f"/me/onlineMeetings/{meeting_id}",
        use_beta=True
    )

    if not meeting_data:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Get or find transcript
    if not transcript_id:
        transcripts_data = await graph_api_request(
            connection, db, "GET",
            f"/me/onlineMeetings/{meeting_id}/transcripts",
            use_beta=True
        )

        if not transcripts_data or not transcripts_data.get("value"):
            raise HTTPException(status_code=400, detail="No transcript available for this meeting")

        transcript_id = transcripts_data["value"][0].get("id")

    # Download transcript content
    token = await get_valid_teams_token(connection, db)
    if not token:
        raise HTTPException(status_code=401, detail="Microsoft authentication expired")

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Get transcript content (VTT format)
            download_response = await client.get(
                f"{GRAPH_API_BETA}/me/onlineMeetings/{meeting_id}/transcripts/{transcript_id}/content",
                headers={"Authorization": f"Bearer {token}"},
                params={"$format": "text/vtt"},
            )

            if download_response.status_code != 200:
                logger.error(f"Transcript download failed: {download_response.status_code}")
                raise HTTPException(status_code=500, detail="Failed to download transcript")

            transcript_content = download_response.text

    except Exception as e:
        logger.error(f"Transcript download error: {e}")
        raise HTTPException(status_code=500, detail="Failed to download transcript")

    # Parse transcript
    parsed = parse_transcript(transcript_content, "vtt")

    # Check if already imported
    existing = db.query(MeetingTranscript).filter(
        MeetingTranscript.organization_id == current_user.organization_id,
        MeetingTranscript.platform == "teams",
        MeetingTranscript.file_name == f"teams_{meeting_id}.vtt",
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="This transcript has already been imported")

    # Save transcript file
    import uuid as uuid_module
    unique_filename = f"{uuid_module.uuid4()}.vtt"

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
    if meeting_data.get("startDateTime"):
        try:
            meeting_date = datetime.fromisoformat(meeting_data["startDateTime"].replace("Z", "+00:00"))
        except:
            pass

    # Create transcript record
    transcript = MeetingTranscript(
        organization_id=current_user.organization_id,
        title=meeting_data.get("subject", "Teams Meeting"),
        meeting_date=meeting_date,
        meeting_type="general",
        platform="teams",
        file_path=unique_filename,
        file_name=f"teams_{meeting_id}.vtt",
        file_size=len(transcript_content.encode()),
        file_format="vtt",
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
