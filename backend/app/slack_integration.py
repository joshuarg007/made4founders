"""
Slack Integration for Made4Founders
Notifications, alerts, and daily digest via Slack.
"""

import os
import logging
import secrets
from datetime import datetime, timedelta, date
from typing import Optional, List, Dict, Any
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
import httpx

from .database import get_db
from .models import (
    User, SlackConnection, Deadline, Task, TaskBoard,
    Metric, TellerAccount, TellerEnrollment, StripeSubscriptionSync
)
from .auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/slack", tags=["slack"])

# ============================================================================
# CONFIGURATION
# ============================================================================

SLACK_CLIENT_ID = os.getenv("SLACK_CLIENT_ID", "")
SLACK_CLIENT_SECRET = os.getenv("SLACK_CLIENT_SECRET", "")
SLACK_SIGNING_SECRET = os.getenv("SLACK_SIGNING_SECRET", "")
SLACK_REDIRECT_URI = os.getenv(
    "SLACK_REDIRECT_URI",
    "http://localhost:8001/api/slack/callback"
)
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
SCHEDULER_API_KEY = os.getenv("SCHEDULER_API_KEY", "")

# Slack OAuth scopes
SLACK_SCOPES = [
    "chat:write",
    "channels:read",
    "users:read",
    "incoming-webhook",
]

# OAuth state storage
oauth_states: Dict[str, Dict] = {}


# ============================================================================
# SCHEMAS
# ============================================================================

class SlackConnectionResponse(BaseModel):
    id: int
    team_id: str
    team_name: Optional[str]
    channel_id: Optional[str]
    channel_name: Optional[str]
    is_active: bool
    notify_deadlines: bool
    notify_tasks: bool
    notify_metrics: bool
    daily_digest: bool
    daily_digest_time: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class SlackChannel(BaseModel):
    id: str
    name: str
    is_private: bool


class NotificationSettings(BaseModel):
    channel_id: str
    notify_deadlines: bool = True
    notify_tasks: bool = True
    notify_metrics: bool = True
    daily_digest: bool = True
    daily_digest_time: str = "09:00"


class TestMessageRequest(BaseModel):
    message: Optional[str] = None


# ============================================================================
# OAUTH FLOW
# ============================================================================

@router.get("/connect")
async def get_connect_url(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get Slack OAuth URL for connecting workspace."""
    if not SLACK_CLIENT_ID or not SLACK_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Slack not configured")

    # Check if already connected
    existing = db.query(SlackConnection).filter(
        SlackConnection.organization_id == current_user.organization_id,
        SlackConnection.is_active == True
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Slack already connected")

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
        "client_id": SLACK_CLIENT_ID,
        "redirect_uri": SLACK_REDIRECT_URI,
        "scope": ",".join(SLACK_SCOPES),
        "state": state,
    }

    oauth_url = f"https://slack.com/oauth/v2/authorize?{urlencode(params)}"

    return {"url": oauth_url}


@router.get("/callback")
async def oauth_callback(
    code: str,
    state: str,
    db: Session = Depends(get_db)
):
    """Handle Slack OAuth callback."""
    # Validate state
    state_data = oauth_states.pop(state, None)
    if not state_data:
        raise HTTPException(status_code=400, detail="Invalid or expired state")

    org_id = state_data["org_id"]
    user_id = state_data["user_id"]

    try:
        # Exchange code for access token
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://slack.com/api/oauth.v2.access",
                data={
                    "client_id": SLACK_CLIENT_ID,
                    "client_secret": SLACK_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": SLACK_REDIRECT_URI,
                }
            )

            data = token_response.json()

            if not data.get("ok"):
                logger.error(f"Slack OAuth error: {data.get('error')}")
                raise HTTPException(status_code=400, detail=f"Slack error: {data.get('error')}")

            access_token = data.get("access_token")
            team_id = data.get("team", {}).get("id")
            team_name = data.get("team", {}).get("name")
            bot_user_id = data.get("bot_user_id")

            # Get incoming webhook if available
            webhook_url = data.get("incoming_webhook", {}).get("url")
            webhook_channel = data.get("incoming_webhook", {}).get("channel")
            webhook_channel_id = data.get("incoming_webhook", {}).get("channel_id")

        # Check if this workspace is already connected
        existing = db.query(SlackConnection).filter(
            SlackConnection.team_id == team_id
        ).first()

        if existing:
            if existing.organization_id != org_id:
                raise HTTPException(
                    status_code=400,
                    detail="This Slack workspace is connected to another organization"
                )
            # Reactivate existing connection
            existing.access_token = access_token
            existing.bot_user_id = bot_user_id
            existing.webhook_url = webhook_url
            existing.channel_id = webhook_channel_id
            existing.channel_name = webhook_channel
            existing.is_active = True
            existing.updated_at = datetime.utcnow()
            db.commit()
            connection = existing
        else:
            # Create new connection
            connection = SlackConnection(
                organization_id=org_id,
                user_id=user_id,
                access_token=access_token,
                team_id=team_id,
                team_name=team_name,
                bot_user_id=bot_user_id,
                webhook_url=webhook_url,
                channel_id=webhook_channel_id,
                channel_name=webhook_channel,
            )
            db.add(connection)
            db.commit()
            db.refresh(connection)

        # Send welcome message
        await send_slack_message(
            connection,
            "Made4Founders connected successfully! You'll receive notifications here.",
            db
        )

        return {"status": "success", "team_name": team_name}

    except httpx.RequestError as e:
        logger.error(f"Slack OAuth error: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect to Slack")


@router.delete("/disconnect")
async def disconnect_slack(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disconnect Slack workspace."""
    connection = db.query(SlackConnection).filter(
        SlackConnection.organization_id == current_user.organization_id,
        SlackConnection.is_active == True
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="No Slack workspace connected")

    connection.is_active = False
    connection.updated_at = datetime.utcnow()
    db.commit()

    return {"status": "success"}


# ============================================================================
# CONNECTION STATUS & SETTINGS
# ============================================================================

@router.get("/connection", response_model=Optional[SlackConnectionResponse])
async def get_connection(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current Slack connection status."""
    connection = db.query(SlackConnection).filter(
        SlackConnection.organization_id == current_user.organization_id,
        SlackConnection.is_active == True
    ).first()

    if not connection:
        return None

    return SlackConnectionResponse(
        id=connection.id,
        team_id=connection.team_id,
        team_name=connection.team_name,
        channel_id=connection.channel_id,
        channel_name=connection.channel_name,
        is_active=connection.is_active,
        notify_deadlines=connection.notify_deadlines,
        notify_tasks=connection.notify_tasks,
        notify_metrics=connection.notify_metrics,
        daily_digest=connection.daily_digest,
        daily_digest_time=connection.daily_digest_time,
        created_at=connection.created_at
    )


@router.patch("/settings")
async def update_settings(
    settings: NotificationSettings,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update Slack notification settings."""
    connection = db.query(SlackConnection).filter(
        SlackConnection.organization_id == current_user.organization_id,
        SlackConnection.is_active == True
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="No Slack workspace connected")

    connection.channel_id = settings.channel_id
    connection.notify_deadlines = settings.notify_deadlines
    connection.notify_tasks = settings.notify_tasks
    connection.notify_metrics = settings.notify_metrics
    connection.daily_digest = settings.daily_digest
    connection.daily_digest_time = settings.daily_digest_time
    connection.updated_at = datetime.utcnow()
    db.commit()

    return {"status": "success"}


@router.get("/channels", response_model=List[SlackChannel])
async def list_channels(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List available Slack channels."""
    connection = db.query(SlackConnection).filter(
        SlackConnection.organization_id == current_user.organization_id,
        SlackConnection.is_active == True
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="No Slack workspace connected")

    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://slack.com/api/conversations.list",
            headers={"Authorization": f"Bearer {connection.access_token}"},
            params={"types": "public_channel,private_channel", "limit": 100}
        )

        data = response.json()

        if not data.get("ok"):
            raise HTTPException(status_code=400, detail="Failed to list channels")

        channels = []
        for channel in data.get("channels", []):
            channels.append(SlackChannel(
                id=channel.get("id"),
                name=channel.get("name"),
                is_private=channel.get("is_private", False)
            ))

        return channels


@router.post("/test")
async def send_test_message(
    request: TestMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a test message to the connected channel."""
    connection = db.query(SlackConnection).filter(
        SlackConnection.organization_id == current_user.organization_id,
        SlackConnection.is_active == True
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="No Slack workspace connected")

    message = request.message or "This is a test message from Made4Founders!"

    success = await send_slack_message(connection, message, db)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to send message")

    return {"status": "success"}


# ============================================================================
# NOTIFICATION ENDPOINTS (Called by scheduler)
# ============================================================================

def verify_scheduler_key(x_api_key: str = Header(None)):
    """Verify the scheduler API key."""
    import secrets as sec
    if not SCHEDULER_API_KEY:
        raise HTTPException(status_code=500, detail="Scheduler API key not configured")
    if not x_api_key or not sec.compare_digest(x_api_key, SCHEDULER_API_KEY):
        raise HTTPException(status_code=401, detail="Invalid API key")
    return True


@router.post("/send-deadline-alerts")
async def send_deadline_alerts(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_scheduler_key),
):
    """Send Slack alerts for upcoming deadlines."""
    today = date.today()
    tomorrow = today + timedelta(days=1)

    # Get all active Slack connections with deadline notifications enabled
    connections = db.query(SlackConnection).filter(
        SlackConnection.is_active == True,
        SlackConnection.notify_deadlines == True
    ).all()

    sent_count = 0

    for connection in connections:
        # Get upcoming deadlines
        deadlines = db.query(Deadline).filter(
            Deadline.organization_id == connection.organization_id,
            Deadline.is_completed == False,
            Deadline.due_date >= today,
            Deadline.due_date <= tomorrow
        ).order_by(Deadline.due_date).all()

        if not deadlines:
            continue

        # Build message
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "Upcoming Deadlines",
                    "emoji": True
                }
            }
        ]

        for deadline in deadlines:
            due_date = deadline.due_date.strftime("%b %d, %Y")
            is_today = deadline.due_date.date() == today
            emoji = "" if is_today else ""

            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"{emoji} *{deadline.title}*\nDue: {due_date}"
                }
            })

        blocks.append({
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": f"<{FRONTEND_URL}/app/deadlines|View all deadlines in Made4Founders>"
                }
            ]
        })

        success = await send_slack_blocks(connection, blocks, db)
        if success:
            sent_count += 1

    return {"sent_count": sent_count}


@router.post("/send-daily-digest")
async def send_daily_digest(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_scheduler_key),
):
    """Send daily digest to all connected Slack workspaces."""
    today = date.today()
    week_from_now = today + timedelta(days=7)

    # Get all active Slack connections with daily digest enabled
    connections = db.query(SlackConnection).filter(
        SlackConnection.is_active == True,
        SlackConnection.daily_digest == True
    ).all()

    sent_count = 0

    for connection in connections:
        org_id = connection.organization_id

        # Get upcoming deadlines
        deadlines = db.query(Deadline).filter(
            Deadline.organization_id == org_id,
            Deadline.is_completed == False,
            Deadline.due_date >= today,
            Deadline.due_date <= week_from_now
        ).order_by(Deadline.due_date).limit(5).all()

        # Get pending tasks
        tasks = db.query(Task).join(TaskBoard).filter(
            TaskBoard.organization_id == org_id,
            Task.status.in_(["todo", "in_progress"])
        ).limit(5).all()

        # Get cash position if Teller is connected
        cash_total = 0.0
        teller_accounts = db.query(TellerAccount).join(TellerEnrollment).filter(
            TellerAccount.organization_id == org_id,
            TellerAccount.is_active == True,
            TellerEnrollment.is_active == True,
            TellerAccount.account_type.in_(["depository", "investment"])
        ).all()

        if teller_accounts:
            cash_total = sum(acc.balance_current or 0 for acc in teller_accounts)

        # Get MRR if Stripe is connected
        mrr = 0.0
        active_subs = db.query(StripeSubscriptionSync).filter(
            StripeSubscriptionSync.organization_id == org_id,
            StripeSubscriptionSync.status == "active"
        ).all()

        if active_subs:
            mrr = sum(sub.mrr or 0 for sub in active_subs)

        # Build digest message
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"Daily Digest - {today.strftime('%B %d, %Y')}",
                    "emoji": True
                }
            }
        ]

        # Financial summary
        if cash_total > 0 or mrr > 0:
            financial_text = ""
            if cash_total > 0:
                financial_text += f"*Cash:* ${cash_total:,.0f}"
            if mrr > 0:
                if financial_text:
                    financial_text += "  |  "
                financial_text += f"*MRR:* ${mrr:,.0f}"

            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": financial_text}
            })
            blocks.append({"type": "divider"})

        # Deadlines section
        if deadlines:
            deadline_text = "*Upcoming Deadlines:*\n"
            for d in deadlines:
                due = d.due_date.strftime("%b %d")
                deadline_text += f"• {d.title} (due {due})\n"
            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": deadline_text}
            })
        else:
            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": " No upcoming deadlines this week"}
            })

        # Tasks section
        if tasks:
            task_text = "*Active Tasks:*\n"
            for t in tasks[:5]:
                status_emoji = "" if t.status == "in_progress" else ""
                task_text += f"• {status_emoji} {t.title}\n"
            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": task_text}
            })

        blocks.append({
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": f"<{FRONTEND_URL}/app/daily-brief|Open Made4Founders>"
                }
            ]
        })

        success = await send_slack_blocks(connection, blocks, db)
        if success:
            sent_count += 1

    return {"sent_count": sent_count}


@router.post("/send-alert")
async def send_custom_alert(
    title: str,
    message: str,
    org_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_scheduler_key),
):
    """Send a custom alert to a specific organization's Slack."""
    connection = db.query(SlackConnection).filter(
        SlackConnection.organization_id == org_id,
        SlackConnection.is_active == True
    ).first()

    if not connection:
        return {"status": "no_connection"}

    blocks = [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": title, "emoji": True}
        },
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": message}
        }
    ]

    success = await send_slack_blocks(connection, blocks, db)

    return {"status": "success" if success else "failed"}


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


async def send_slack_message(
    connection: SlackConnection,
    message: str,
    db: Session
) -> bool:
    """Send a simple text message to Slack."""
    try:
        # Try webhook first (faster)
        if connection.webhook_url:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    connection.webhook_url,
                    json={"text": message}
                )
                return response.status_code == 200

        # Fall back to API
        if connection.access_token and connection.channel_id:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://slack.com/api/chat.postMessage",
                    headers={"Authorization": f"Bearer {connection.access_token}"},
                    json={
                        "channel": connection.channel_id,
                        "text": message
                    }
                )
                data = response.json()
                return data.get("ok", False)

        return False

    except Exception as e:
        logger.error(f"Failed to send Slack message: {e}")
        return False


async def send_slack_blocks(
    connection: SlackConnection,
    blocks: List[Dict],
    db: Session
) -> bool:
    """Send a block-formatted message to Slack."""
    try:
        if not connection.access_token or not connection.channel_id:
            # Try webhook with text fallback
            if connection.webhook_url:
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        connection.webhook_url,
                        json={"blocks": blocks}
                    )
                    return response.status_code == 200
            return False

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://slack.com/api/chat.postMessage",
                headers={"Authorization": f"Bearer {connection.access_token}"},
                json={
                    "channel": connection.channel_id,
                    "blocks": blocks
                }
            )
            data = response.json()
            return data.get("ok", False)

    except Exception as e:
        logger.error(f"Failed to send Slack blocks: {e}")
        return False


# Utility function for other modules to send notifications
async def notify_slack(org_id: int, title: str, message: str, db: Session) -> bool:
    """Send a notification to an organization's Slack if connected."""
    connection = db.query(SlackConnection).filter(
        SlackConnection.organization_id == org_id,
        SlackConnection.is_active == True
    ).first()

    if not connection:
        return False

    blocks = [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": title, "emoji": True}
        },
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": message}
        }
    ]

    return await send_slack_blocks(connection, blocks, db)
