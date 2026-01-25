"""
Notification scheduler for deadline reminders and weekly digests.

Can be triggered by:
- Cron job calling the endpoints
- AWS CloudWatch Events
- External scheduler

Endpoints:
- POST /api/notifications/send-deadline-reminders (requires API key)
- POST /api/notifications/send-weekly-digest (requires API key)
"""
import os
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from .database import get_db
from .models import User, Deadline, Organization, Task, TaskBoard, TaskColumn
from .email_service import send_deadline_reminder_email, send_weekly_digest_email

logger = logging.getLogger(__name__)

router = APIRouter()

# API key for scheduler authentication (set in environment)
SCHEDULER_API_KEY = os.getenv("SCHEDULER_API_KEY", "")


def verify_scheduler_key(x_api_key: str = Header(None)):
    """Verify the scheduler API key."""
    if not SCHEDULER_API_KEY:
        raise HTTPException(status_code=500, detail="Scheduler API key not configured")
    if x_api_key != SCHEDULER_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return True


@router.post("/send-deadline-reminders")
async def send_deadline_reminders(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_scheduler_key),
):
    """
    Send deadline reminder emails to all users with upcoming deadlines.

    Should be called daily by a scheduler (e.g., cron, CloudWatch).
    Sends reminders for:
    - Deadlines due today
    - Deadlines due tomorrow
    - Deadlines due in the next 7 days (once per deadline)
    """
    today = datetime.utcnow().date()
    tomorrow = today + timedelta(days=1)
    week_from_now = today + timedelta(days=7)

    # Get all active users with their organization
    users = db.query(User).filter(
        User.is_active == True,
        User.email_verified == True,
        User.organization_id.isnot(None)
    ).all()

    sent_count = 0
    error_count = 0

    for user in users:
        try:
            # Get user's deadlines
            deadlines = db.query(Deadline).filter(
                Deadline.organization_id == user.organization_id,
                Deadline.is_completed == False,
                Deadline.due_date >= today,
                Deadline.due_date <= week_from_now
            ).order_by(Deadline.due_date).all()

            if not deadlines:
                continue

            # Group by urgency
            today_deadlines = []
            tomorrow_deadlines = []
            week_deadlines = []

            for d in deadlines:
                deadline_data = {
                    'title': d.title,
                    'due_date': d.due_date.strftime('%B %d, %Y') if d.due_date else 'Unknown',
                    'category': d.category or ''
                }

                if d.due_date == today:
                    today_deadlines.append(deadline_data)
                elif d.due_date == tomorrow:
                    tomorrow_deadlines.append(deadline_data)
                else:
                    week_deadlines.append(deadline_data)

            # Send appropriate reminders
            if today_deadlines:
                await send_deadline_reminder_email(
                    email=user.email,
                    name=user.name,
                    deadlines=today_deadlines,
                    reminder_type="today"
                )
                sent_count += 1

            if tomorrow_deadlines:
                await send_deadline_reminder_email(
                    email=user.email,
                    name=user.name,
                    deadlines=tomorrow_deadlines,
                    reminder_type="tomorrow"
                )
                sent_count += 1

            # Only send weekly reminder on Mondays to avoid spam
            if datetime.utcnow().weekday() == 0 and week_deadlines:
                await send_deadline_reminder_email(
                    email=user.email,
                    name=user.name,
                    deadlines=week_deadlines,
                    reminder_type="week"
                )
                sent_count += 1

        except Exception as e:
            logger.error(f"Failed to send deadline reminders to {user.email}: {e}")
            error_count += 1

    return {
        "message": "Deadline reminders sent",
        "sent": sent_count,
        "errors": error_count,
    }


@router.post("/send-weekly-digest")
async def send_weekly_digest(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_scheduler_key),
):
    """
    Send weekly digest emails to all users.

    Should be called once per week (e.g., Monday morning) by a scheduler.
    """
    today = datetime.utcnow().date()
    week_ago = today - timedelta(days=7)
    week_from_now = today + timedelta(days=7)

    # Get all active users
    users = db.query(User).filter(
        User.is_active == True,
        User.email_verified == True,
        User.organization_id.isnot(None)
    ).all()

    sent_count = 0
    error_count = 0

    for user in users:
        try:
            org_id = user.organization_id

            # Get boards for this org
            boards = db.query(TaskBoard).filter(TaskBoard.organization_id == org_id).all()
            board_ids = [b.id for b in boards]

            # Count tasks completed this week
            tasks_completed = 0
            if board_ids:
                # Get all column IDs for these boards
                columns = db.query(TaskColumn).filter(TaskColumn.board_id.in_(board_ids)).all()
                column_ids = [c.id for c in columns]

                if column_ids:
                    tasks_completed = db.query(Task).filter(
                        Task.column_id.in_(column_ids),
                        Task.status == "done",
                        Task.updated_at >= week_ago
                    ).count()

            # Count deadlines completed this week
            deadlines_met = db.query(Deadline).filter(
                Deadline.organization_id == org_id,
                Deadline.is_completed == True,
                Deadline.completed_at >= week_ago
            ).count()

            # Count upcoming deadlines
            upcoming_deadlines = db.query(Deadline).filter(
                Deadline.organization_id == org_id,
                Deadline.is_completed == False,
                Deadline.due_date >= today,
                Deadline.due_date <= week_from_now
            ).count()

            # Get XP earned (from organization)
            org = db.query(Organization).filter(Organization.id == org_id).first()
            # Note: Would need to track XP history to get weekly XP
            # For now, just show total XP
            xp_earned = 0  # TODO: Track weekly XP

            stats = {
                'tasks_completed': tasks_completed,
                'deadlines_met': deadlines_met,
                'upcoming_deadlines': upcoming_deadlines,
                'xp_earned': xp_earned,
            }

            await send_weekly_digest_email(
                email=user.email,
                name=user.name,
                stats=stats
            )
            sent_count += 1

        except Exception as e:
            logger.error(f"Failed to send weekly digest to {user.email}: {e}")
            error_count += 1

    return {
        "message": "Weekly digests sent",
        "sent": sent_count,
        "errors": error_count,
    }


@router.get("/health")
async def notifications_health():
    """Health check for notification service."""
    return {
        "status": "healthy",
        "scheduler_key_configured": bool(SCHEDULER_API_KEY),
    }
