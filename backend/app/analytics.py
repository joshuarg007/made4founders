"""
Simple privacy-friendly analytics.

Tracks:
- Page views (anonymized)
- Feature usage
- User engagement metrics

Endpoints:
- POST /api/analytics/track - Track an event
- GET /api/analytics/stats - Get analytics stats (admin only)
"""
import os
import logging
from datetime import datetime, UTC, timedelta
from typing import Optional, List
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, DateTime, Text, func, desc
from hashlib import sha256

from .database import get_db, Base
from .auth import get_current_user, get_current_user_optional
from .models import User

logger = logging.getLogger(__name__)

router = APIRouter()


class AnalyticsEvent(Base):
    """Analytics event storage."""
    __tablename__ = "analytics_events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(50), nullable=False, index=True)  # page_view, feature_use, etc.
    event_name = Column(String(100), nullable=False, index=True)  # /app/dashboard, vault_unlock, etc.

    # Anonymized user tracking (hashed user_id, not stored directly)
    user_hash = Column(String(64), nullable=True, index=True)
    session_id = Column(String(64), nullable=True, index=True)

    # Context
    organization_id = Column(Integer, nullable=True, index=True)
    referrer = Column(String(500), nullable=True)
    user_agent = Column(String(500), nullable=True)

    # Metadata
    properties = Column(Text, nullable=True)  # JSON

    created_at = Column(DateTime, default=lambda: datetime.now(UTC), index=True)


class TrackEventRequest(BaseModel):
    """Track event request."""
    event_type: str  # page_view, feature_use, click, etc.
    event_name: str  # The page path or feature name
    properties: Optional[dict] = None
    session_id: Optional[str] = None


class AnalyticsStats(BaseModel):
    """Analytics statistics."""
    total_events: int
    unique_users_today: int
    unique_users_week: int
    page_views_today: int
    page_views_week: int
    top_pages: List[dict]
    top_features: List[dict]
    daily_active_users: List[dict]


def hash_user_id(user_id: int, salt: str = "") -> str:
    """Create a privacy-preserving hash of user ID."""
    secret = os.getenv("ANALYTICS_SALT", "m4f-analytics-2024")
    return sha256(f"{secret}{user_id}{salt}".encode()).hexdigest()[:16]


def require_admin(current_user: User = Depends(get_current_user)):
    """Require admin role."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.post("/track")
async def track_event(
    request_data: TrackEventRequest,
    request: Request,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Track an analytics event.
    Privacy-friendly: user IDs are hashed, no PII stored.
    """
    import json

    # Create anonymized user hash if logged in
    user_hash = None
    org_id = None
    if current_user:
        user_hash = hash_user_id(current_user.id)
        org_id = current_user.organization_id

    # Get request context
    user_agent = request.headers.get("user-agent", "")[:500]
    referrer = request.headers.get("referer", "")[:500]

    # Create event
    event = AnalyticsEvent(
        event_type=request_data.event_type[:50],
        event_name=request_data.event_name[:100],
        user_hash=user_hash,
        session_id=request_data.session_id[:64] if request_data.session_id else None,
        organization_id=org_id,
        referrer=referrer,
        user_agent=user_agent,
        properties=json.dumps(request_data.properties) if request_data.properties else None,
    )

    db.add(event)
    db.commit()

    return {"ok": True}


@router.get("/stats", response_model=AnalyticsStats)
async def get_analytics_stats(
    days: int = 30,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Get analytics statistics (admin only).
    """
    now = datetime.now(UTC)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    period_start = today_start - timedelta(days=days)

    org_id = current_user.organization_id

    # Base filter for org
    base_filter = AnalyticsEvent.organization_id == org_id

    # Total events
    total_events = db.query(func.count(AnalyticsEvent.id)).filter(
        base_filter,
        AnalyticsEvent.created_at >= period_start
    ).scalar() or 0

    # Unique users today
    unique_users_today = db.query(func.count(func.distinct(AnalyticsEvent.user_hash))).filter(
        base_filter,
        AnalyticsEvent.created_at >= today_start,
        AnalyticsEvent.user_hash.isnot(None)
    ).scalar() or 0

    # Unique users this week
    unique_users_week = db.query(func.count(func.distinct(AnalyticsEvent.user_hash))).filter(
        base_filter,
        AnalyticsEvent.created_at >= week_start,
        AnalyticsEvent.user_hash.isnot(None)
    ).scalar() or 0

    # Page views today
    page_views_today = db.query(func.count(AnalyticsEvent.id)).filter(
        base_filter,
        AnalyticsEvent.event_type == "page_view",
        AnalyticsEvent.created_at >= today_start
    ).scalar() or 0

    # Page views this week
    page_views_week = db.query(func.count(AnalyticsEvent.id)).filter(
        base_filter,
        AnalyticsEvent.event_type == "page_view",
        AnalyticsEvent.created_at >= week_start
    ).scalar() or 0

    # Top pages
    top_pages_query = db.query(
        AnalyticsEvent.event_name,
        func.count(AnalyticsEvent.id).label('views')
    ).filter(
        base_filter,
        AnalyticsEvent.event_type == "page_view",
        AnalyticsEvent.created_at >= period_start
    ).group_by(AnalyticsEvent.event_name).order_by(desc('views')).limit(10).all()

    top_pages = [{"page": name, "views": views} for name, views in top_pages_query]

    # Top features
    top_features_query = db.query(
        AnalyticsEvent.event_name,
        func.count(AnalyticsEvent.id).label('uses')
    ).filter(
        base_filter,
        AnalyticsEvent.event_type == "feature_use",
        AnalyticsEvent.created_at >= period_start
    ).group_by(AnalyticsEvent.event_name).order_by(desc('uses')).limit(10).all()

    top_features = [{"feature": name, "uses": uses} for name, uses in top_features_query]

    # Daily active users (last 14 days)
    dau_data = []
    for i in range(14):
        day_start = today_start - timedelta(days=i)
        day_end = day_start + timedelta(days=1)

        dau = db.query(func.count(func.distinct(AnalyticsEvent.user_hash))).filter(
            base_filter,
            AnalyticsEvent.created_at >= day_start,
            AnalyticsEvent.created_at < day_end,
            AnalyticsEvent.user_hash.isnot(None)
        ).scalar() or 0

        dau_data.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "users": dau
        })

    dau_data.reverse()  # Oldest first

    return AnalyticsStats(
        total_events=total_events,
        unique_users_today=unique_users_today,
        unique_users_week=unique_users_week,
        page_views_today=page_views_today,
        page_views_week=page_views_week,
        top_pages=top_pages,
        top_features=top_features,
        daily_active_users=dau_data
    )


@router.get("/health")
async def analytics_health():
    """Health check for analytics service."""
    return {"status": "healthy"}
