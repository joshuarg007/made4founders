"""
Google Calendar Integration for Made4Founders
Two-way sync between M4F deadlines/meetings and Google Calendar.
"""

import os
import logging
import secrets
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
import httpx

from .database import get_db
from .models import User, GoogleCalendarConnection, Deadline, Meeting
from .auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/google-calendar", tags=["google-calendar"])

# ============================================================================
# CONFIGURATION
# ============================================================================

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_CALENDAR_REDIRECT_URI = os.getenv(
    "GOOGLE_CALENDAR_REDIRECT_URI",
    "http://localhost:8001/api/google-calendar/callback"
)
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Calendar scopes
GOOGLE_CALENDAR_SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
]

# OAuth state storage (in production, use Redis)
oauth_states: Dict[str, Dict] = {}


# ============================================================================
# SCHEMAS
# ============================================================================

class CalendarConnectionResponse(BaseModel):
    id: int
    calendar_id: str
    calendar_name: Optional[str]
    is_active: bool
    sync_deadlines: bool
    sync_meetings: bool
    last_sync_at: Optional[datetime]
    sync_status: str
    created_at: datetime

    class Config:
        from_attributes = True


class CalendarEvent(BaseModel):
    id: str
    title: str
    start: datetime
    end: datetime
    description: Optional[str]
    location: Optional[str]
    source: str  # 'google' or 'm4f'
    m4f_type: Optional[str]  # 'deadline' or 'meeting'
    m4f_id: Optional[int]


class SyncSettings(BaseModel):
    sync_deadlines: bool = True
    sync_meetings: bool = True
    calendar_id: str = "primary"


class CalendarListItem(BaseModel):
    id: str
    summary: str
    primary: bool
    access_role: str


# ============================================================================
# OAUTH FLOW
# ============================================================================

@router.get("/connect")
async def get_connect_url(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get Google Calendar OAuth URL."""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google Calendar not configured")

    # Check if already connected
    existing = db.query(GoogleCalendarConnection).filter(
        GoogleCalendarConnection.organization_id == current_user.organization_id,
        GoogleCalendarConnection.is_active == True
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Google Calendar already connected")

    # Generate state token
    state = secrets.token_urlsafe(32)
    oauth_states[state] = {
        "org_id": current_user.organization_id,
        "user_id": current_user.id,
        "created_at": datetime.utcnow()
    }

    # Cleanup old states
    cleanup_expired_states()

    # Build OAuth URL
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_CALENDAR_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(GOOGLE_CALENDAR_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }

    oauth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"

    return {"url": oauth_url}


@router.get("/callback")
async def oauth_callback(
    code: str,
    state: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Handle Google Calendar OAuth callback."""
    # Validate state
    state_data = oauth_states.pop(state, None)
    if not state_data:
        raise HTTPException(status_code=400, detail="Invalid or expired state")

    org_id = state_data["org_id"]
    user_id = state_data["user_id"]

    try:
        # Exchange code for tokens
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": GOOGLE_CALENDAR_REDIRECT_URI,
                }
            )

            if token_response.status_code != 200:
                logger.error(f"Token exchange failed: {token_response.text}")
                raise HTTPException(status_code=400, detail="Failed to exchange token")

            tokens = token_response.json()
            access_token = tokens.get("access_token")
            refresh_token = tokens.get("refresh_token")
            expires_in = tokens.get("expires_in", 3600)

            # Get user's primary calendar
            calendar_response = await client.get(
                "https://www.googleapis.com/calendar/v3/calendars/primary",
                headers={"Authorization": f"Bearer {access_token}"}
            )

            if calendar_response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to access calendar")

            calendar_data = calendar_response.json()
            calendar_id = calendar_data.get("id", "primary")
            calendar_name = calendar_data.get("summary", "Primary Calendar")

        # Check for existing connection
        existing = db.query(GoogleCalendarConnection).filter(
            GoogleCalendarConnection.organization_id == org_id
        ).first()

        if existing:
            # Update existing connection
            existing.access_token = access_token
            existing.refresh_token = refresh_token or existing.refresh_token
            existing.token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            existing.calendar_id = calendar_id
            existing.calendar_name = calendar_name
            existing.is_active = True
            existing.sync_status = "pending"
            existing.updated_at = datetime.utcnow()
            connection = existing
        else:
            # Create new connection
            connection = GoogleCalendarConnection(
                organization_id=org_id,
                user_id=user_id,
                access_token=access_token,
                refresh_token=refresh_token,
                token_expires_at=datetime.utcnow() + timedelta(seconds=expires_in),
                calendar_id=calendar_id,
                calendar_name=calendar_name,
                sync_status="pending"
            )
            db.add(connection)

        db.commit()
        db.refresh(connection)

        # Trigger initial sync
        background_tasks.add_task(sync_calendar_data, connection.id)

        # Redirect to frontend
        return {"status": "success", "calendar_name": calendar_name}

    except httpx.RequestError as e:
        logger.error(f"Google Calendar OAuth error: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect to Google")


@router.delete("/disconnect")
async def disconnect_calendar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disconnect Google Calendar."""
    connection = db.query(GoogleCalendarConnection).filter(
        GoogleCalendarConnection.organization_id == current_user.organization_id,
        GoogleCalendarConnection.is_active == True
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="No Google Calendar connected")

    # Revoke token (best effort)
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"https://oauth2.googleapis.com/revoke?token={connection.access_token}"
            )
    except Exception as e:
        logger.warning(f"Failed to revoke token: {e}")

    connection.is_active = False
    connection.updated_at = datetime.utcnow()
    db.commit()

    return {"status": "success"}


# ============================================================================
# CONNECTION STATUS
# ============================================================================

@router.get("/connection", response_model=Optional[CalendarConnectionResponse])
async def get_connection(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current Google Calendar connection status."""
    connection = db.query(GoogleCalendarConnection).filter(
        GoogleCalendarConnection.organization_id == current_user.organization_id,
        GoogleCalendarConnection.is_active == True
    ).first()

    if not connection:
        return None

    return CalendarConnectionResponse(
        id=connection.id,
        calendar_id=connection.calendar_id,
        calendar_name=connection.calendar_name,
        is_active=connection.is_active,
        sync_deadlines=connection.sync_deadlines,
        sync_meetings=connection.sync_meetings,
        last_sync_at=connection.last_sync_at,
        sync_status=connection.sync_status,
        created_at=connection.created_at
    )


@router.patch("/settings")
async def update_settings(
    settings: SyncSettings,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update calendar sync settings."""
    connection = db.query(GoogleCalendarConnection).filter(
        GoogleCalendarConnection.organization_id == current_user.organization_id,
        GoogleCalendarConnection.is_active == True
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="No Google Calendar connected")

    connection.sync_deadlines = settings.sync_deadlines
    connection.sync_meetings = settings.sync_meetings
    connection.calendar_id = settings.calendar_id
    connection.updated_at = datetime.utcnow()
    db.commit()

    return {"status": "success"}


@router.get("/calendars", response_model=List[CalendarListItem])
async def list_calendars(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List available Google Calendars."""
    connection = db.query(GoogleCalendarConnection).filter(
        GoogleCalendarConnection.organization_id == current_user.organization_id,
        GoogleCalendarConnection.is_active == True
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="No Google Calendar connected")

    # Refresh token if needed
    access_token = await refresh_token_if_needed(connection, db)

    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://www.googleapis.com/calendar/v3/users/me/calendarList",
            headers={"Authorization": f"Bearer {access_token}"}
        )

        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to list calendars")

        data = response.json()
        calendars = []
        for cal in data.get("items", []):
            calendars.append(CalendarListItem(
                id=cal.get("id"),
                summary=cal.get("summary", "Unnamed Calendar"),
                primary=cal.get("primary", False),
                access_role=cal.get("accessRole", "reader")
            ))

        return calendars


# ============================================================================
# SYNC OPERATIONS
# ============================================================================

@router.post("/sync")
async def trigger_sync(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Trigger a manual calendar sync."""
    connection = db.query(GoogleCalendarConnection).filter(
        GoogleCalendarConnection.organization_id == current_user.organization_id,
        GoogleCalendarConnection.is_active == True
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="No Google Calendar connected")

    connection.sync_status = "syncing"
    db.commit()

    background_tasks.add_task(sync_calendar_data, connection.id)

    return {"status": "syncing"}


@router.get("/events", response_model=List[CalendarEvent])
async def get_upcoming_events(
    days: int = Query(default=30, ge=1, le=90),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get upcoming events from Google Calendar."""
    connection = db.query(GoogleCalendarConnection).filter(
        GoogleCalendarConnection.organization_id == current_user.organization_id,
        GoogleCalendarConnection.is_active == True
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="No Google Calendar connected")

    access_token = await refresh_token_if_needed(connection, db)

    now = datetime.utcnow()
    time_max = now + timedelta(days=days)

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://www.googleapis.com/calendar/v3/calendars/{connection.calendar_id}/events",
            headers={"Authorization": f"Bearer {access_token}"},
            params={
                "timeMin": now.isoformat() + "Z",
                "timeMax": time_max.isoformat() + "Z",
                "singleEvents": "true",
                "orderBy": "startTime",
                "maxResults": 100,
            }
        )

        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch events")

        data = response.json()
        events = []

        for item in data.get("items", []):
            start = item.get("start", {})
            end = item.get("end", {})

            # Handle all-day events vs timed events
            start_dt = start.get("dateTime") or start.get("date")
            end_dt = end.get("dateTime") or end.get("date")

            if start_dt and end_dt:
                try:
                    # Parse datetime
                    if "T" in start_dt:
                        start_parsed = datetime.fromisoformat(start_dt.replace("Z", "+00:00"))
                        end_parsed = datetime.fromisoformat(end_dt.replace("Z", "+00:00"))
                    else:
                        start_parsed = datetime.fromisoformat(start_dt)
                        end_parsed = datetime.fromisoformat(end_dt)

                    # Check if this is from M4F
                    extended_props = item.get("extendedProperties", {}).get("private", {})
                    m4f_type = extended_props.get("m4f_type")
                    m4f_id = extended_props.get("m4f_id")

                    events.append(CalendarEvent(
                        id=item.get("id"),
                        title=item.get("summary", "Untitled"),
                        start=start_parsed,
                        end=end_parsed,
                        description=item.get("description"),
                        location=item.get("location"),
                        source="m4f" if m4f_type else "google",
                        m4f_type=m4f_type,
                        m4f_id=int(m4f_id) if m4f_id else None
                    ))
                except (ValueError, TypeError) as e:
                    logger.warning(f"Failed to parse event: {e}")
                    continue

        return events


@router.post("/push-deadline/{deadline_id}")
async def push_deadline_to_calendar(
    deadline_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Push a specific deadline to Google Calendar."""
    org_id = current_user.organization_id

    connection = db.query(GoogleCalendarConnection).filter(
        GoogleCalendarConnection.organization_id == org_id,
        GoogleCalendarConnection.is_active == True
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="No Google Calendar connected")

    deadline = db.query(Deadline).filter(
        Deadline.id == deadline_id,
        Deadline.organization_id == org_id
    ).first()

    if not deadline:
        raise HTTPException(status_code=404, detail="Deadline not found")

    access_token = await refresh_token_if_needed(connection, db)
    event_id = await create_or_update_calendar_event(
        connection, access_token, deadline, "deadline", db
    )

    return {"status": "success", "event_id": event_id}


@router.post("/push-meeting/{meeting_id}")
async def push_meeting_to_calendar(
    meeting_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Push a specific meeting to Google Calendar."""
    org_id = current_user.organization_id

    connection = db.query(GoogleCalendarConnection).filter(
        GoogleCalendarConnection.organization_id == org_id,
        GoogleCalendarConnection.is_active == True
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="No Google Calendar connected")

    meeting = db.query(Meeting).filter(
        Meeting.id == meeting_id,
        Meeting.organization_id == org_id
    ).first()

    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    access_token = await refresh_token_if_needed(connection, db)
    event_id = await create_or_update_calendar_event(
        connection, access_token, meeting, "meeting", db
    )

    return {"status": "success", "event_id": event_id}


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def cleanup_expired_states():
    """Remove expired OAuth states."""
    now = datetime.utcnow()
    expired = [
        key for key, data in oauth_states.items()
        if now - data.get("created_at", now) > timedelta(minutes=10)
    ]
    for key in expired:
        del oauth_states[key]


async def refresh_token_if_needed(connection: GoogleCalendarConnection, db: Session) -> str:
    """Refresh access token if expired."""
    if connection.token_expires_at and connection.token_expires_at > datetime.utcnow():
        return connection.access_token

    if not connection.refresh_token:
        raise HTTPException(status_code=401, detail="Calendar connection expired, please reconnect")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "refresh_token": connection.refresh_token,
                "grant_type": "refresh_token",
            }
        )

        if response.status_code != 200:
            connection.is_active = False
            db.commit()
            raise HTTPException(status_code=401, detail="Failed to refresh token, please reconnect")

        tokens = response.json()
        connection.access_token = tokens.get("access_token")
        connection.token_expires_at = datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 3600))
        db.commit()

        return connection.access_token


async def create_or_update_calendar_event(
    connection: GoogleCalendarConnection,
    access_token: str,
    item: Any,
    item_type: str,
    db: Session
) -> str:
    """Create or update a calendar event for a deadline or meeting."""

    if item_type == "deadline":
        # All-day event for deadline
        event_body = {
            "summary": f"[Deadline] {item.title}",
            "description": item.description or "",
            "start": {"date": item.due_date.strftime("%Y-%m-%d")},
            "end": {"date": item.due_date.strftime("%Y-%m-%d")},
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "email", "minutes": item.reminder_days * 24 * 60},
                    {"method": "popup", "minutes": 24 * 60},  # 1 day before
                ]
            },
            "extendedProperties": {
                "private": {
                    "m4f_type": "deadline",
                    "m4f_id": str(item.id)
                }
            }
        }
    else:  # meeting
        duration = item.duration_minutes or 60
        start_time = item.meeting_date
        end_time = start_time + timedelta(minutes=duration)

        event_body = {
            "summary": item.title,
            "description": item.agenda or "",
            "location": item.location or "",
            "start": {"dateTime": start_time.isoformat(), "timeZone": "UTC"},
            "end": {"dateTime": end_time.isoformat(), "timeZone": "UTC"},
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "popup", "minutes": 15},
                    {"method": "popup", "minutes": 60},
                ]
            },
            "extendedProperties": {
                "private": {
                    "m4f_type": "meeting",
                    "m4f_id": str(item.id)
                }
            }
        }

    async with httpx.AsyncClient() as client:
        # Check if event already exists
        existing_event_id = getattr(item, 'google_event_id', None)

        if existing_event_id:
            # Update existing event
            response = await client.put(
                f"https://www.googleapis.com/calendar/v3/calendars/{connection.calendar_id}/events/{existing_event_id}",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                },
                json=event_body
            )
        else:
            # Create new event
            response = await client.post(
                f"https://www.googleapis.com/calendar/v3/calendars/{connection.calendar_id}/events",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                },
                json=event_body
            )

        if response.status_code not in (200, 201):
            logger.error(f"Failed to create/update calendar event: {response.text}")
            raise HTTPException(status_code=400, detail="Failed to create calendar event")

        event_data = response.json()
        return event_data.get("id")


def sync_calendar_data(connection_id: int):
    """Sync calendar data (runs in background)."""
    from .database import SessionLocal
    import asyncio

    db = SessionLocal()

    try:
        connection = db.query(GoogleCalendarConnection).filter(
            GoogleCalendarConnection.id == connection_id
        ).first()

        if not connection:
            return

        # Run async sync in event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            loop.run_until_complete(sync_calendar_async(connection, db))
        finally:
            loop.close()

        connection.last_sync_at = datetime.utcnow()
        connection.sync_status = "synced"
        connection.sync_error = None
        db.commit()

        logger.info(f"Synced Google Calendar for connection {connection_id}")

    except Exception as e:
        logger.error(f"Calendar sync error for connection {connection_id}: {e}")
        connection = db.query(GoogleCalendarConnection).filter(
            GoogleCalendarConnection.id == connection_id
        ).first()
        if connection:
            connection.sync_status = "error"
            connection.sync_error = str(e)
            db.commit()
    finally:
        db.close()


async def sync_calendar_async(connection: GoogleCalendarConnection, db: Session):
    """Async calendar sync logic."""
    access_token = await refresh_token_if_needed(connection, db)
    org_id = connection.organization_id

    # Sync deadlines to Google Calendar
    if connection.sync_deadlines:
        deadlines = db.query(Deadline).filter(
            Deadline.organization_id == org_id,
            Deadline.is_completed == False,
            Deadline.due_date >= datetime.utcnow()
        ).all()

        for deadline in deadlines:
            try:
                await create_or_update_calendar_event(
                    connection, access_token, deadline, "deadline", db
                )
            except Exception as e:
                logger.warning(f"Failed to sync deadline {deadline.id}: {e}")

    # Sync meetings to Google Calendar
    if connection.sync_meetings:
        meetings = db.query(Meeting).filter(
            Meeting.organization_id == org_id,
            Meeting.meeting_date >= datetime.utcnow()
        ).all()

        for meeting in meetings:
            try:
                await create_or_update_calendar_event(
                    connection, access_token, meeting, "meeting", db
                )
            except Exception as e:
                logger.warning(f"Failed to sync meeting {meeting.id}: {e}")
