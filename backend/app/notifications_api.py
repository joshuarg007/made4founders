"""
Notifications API - In-app notifications for users.

Provides endpoints for listing, reading, and managing notifications.
Notifications are created by other parts of the system (comments, assignments, etc.).
"""

from typing import Optional
from datetime import datetime, UTC, UTC
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from .database import get_db
from .models import User, Notification
from .schemas import (
    NotificationResponse, NotificationListResponse,
    MarkNotificationsReadRequest, UserBrief
)
from .auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


# ============ Helper Functions ============

def notification_to_response(notification: Notification, db: Session) -> NotificationResponse:
    """Convert Notification model to NotificationResponse."""
    actor_brief = None
    if notification.actor:
        actor_brief = UserBrief(
            id=notification.actor.id,
            email=notification.actor.email,
            name=notification.actor.name
        )

    return NotificationResponse(
        id=notification.id,
        notification_type=notification.notification_type,
        title=notification.title,
        message=notification.message,
        entity_type=notification.entity_type,
        entity_id=notification.entity_id,
        actor=actor_brief,
        is_read=notification.is_read,
        created_at=notification.created_at
    )


def create_notification(
    db: Session,
    organization_id: int,
    user_id: int,
    notification_type: str,
    title: str,
    message: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    actor_user_id: Optional[int] = None
) -> Notification:
    """
    Helper function to create a notification.

    Use this from other modules to create notifications for users.
    """
    notification = Notification(
        organization_id=organization_id,
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        entity_type=entity_type,
        entity_id=entity_id,
        actor_user_id=actor_user_id
    )
    db.add(notification)
    return notification


# ============ API Endpoints ============

@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    unread_only: bool = Query(False, description="Only return unread notifications"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List notifications for the current user.

    Returns paginated list of notifications, newest first.
    Includes unread count for badge display.
    """
    user_id = current_user.id
    org_id = current_user.organization_id

    # Base query
    query = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.organization_id == org_id
    )

    if unread_only:
        query = query.filter(Notification.is_read == False)

    # Get total count
    total_count = query.count()

    # Get unread count (always)
    unread_count = db.query(func.count(Notification.id)).filter(
        Notification.user_id == user_id,
        Notification.organization_id == org_id,
        Notification.is_read == False
    ).scalar() or 0

    # Get paginated results
    notifications = query.order_by(
        Notification.created_at.desc()
    ).offset(offset).limit(limit).all()

    return NotificationListResponse(
        items=[notification_to_response(n, db) for n in notifications],
        unread_count=unread_count,
        total_count=total_count
    )


@router.get("/unread-count")
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the count of unread notifications.

    Use this for displaying a badge on the notification bell.
    Lightweight endpoint for polling.
    """
    count = db.query(func.count(Notification.id)).filter(
        Notification.user_id == current_user.id,
        Notification.organization_id == current_user.organization_id,
        Notification.is_read == False
    ).scalar() or 0

    return {"count": count}


@router.post("/mark-read")
async def mark_notifications_read(
    data: MarkNotificationsReadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mark notifications as read.

    Can mark specific notification IDs or all notifications at once.
    """
    user_id = current_user.id
    org_id = current_user.organization_id
    now = datetime.now(UTC)

    query = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.organization_id == org_id,
        Notification.is_read == False
    )

    if data.all:
        # Mark all as read
        count = query.update({
            Notification.is_read: True,
            Notification.read_at: now
        }, synchronize_session=False)
    elif data.notification_ids:
        # Mark specific notifications as read
        count = query.filter(
            Notification.id.in_(data.notification_ids)
        ).update({
            Notification.is_read: True,
            Notification.read_at: now
        }, synchronize_session=False)
    else:
        return {"marked_count": 0}

    db.commit()
    return {"marked_count": count}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a notification.

    Users can only delete their own notifications.
    """
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
        Notification.organization_id == current_user.organization_id
    ).first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    db.delete(notification)
    db.commit()

    return {"ok": True}


@router.delete("")
async def clear_all_notifications(
    read_only: bool = Query(True, description="Only clear read notifications"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Clear notifications.

    By default, only clears read notifications.
    Set read_only=False to clear all notifications.
    """
    query = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.organization_id == current_user.organization_id
    )

    if read_only:
        query = query.filter(Notification.is_read == True)

    count = query.delete(synchronize_session=False)
    db.commit()

    return {"deleted_count": count}
