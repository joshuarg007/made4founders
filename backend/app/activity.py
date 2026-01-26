"""
Activity Feed API - Organization-wide activity stream.

Records and displays all significant actions in the organization.
Provides transparency and tracking of what's happening.
"""

from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .database import get_db
from .models import User, Activity, ActivityType
from .schemas import ActivityResponse, ActivityListResponse, UserBrief
from .auth import get_current_user

router = APIRouter(prefix="/api/activity", tags=["Activity"])


# ============ Helper Functions ============

def record_activity(
    db: Session,
    organization_id: int,
    user_id: int,
    activity_type: str,
    description: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    entity_title: Optional[str] = None,
    extra_data: Optional[dict] = None
) -> Activity:
    """
    Record an activity in the organization feed.

    Call this helper from anywhere in the app to record activities.

    Args:
        db: Database session
        organization_id: Organization this activity belongs to
        user_id: User who performed the action
        activity_type: Type of activity (from ActivityType enum)
        description: Human-readable description of what happened
        entity_type: Optional type of entity involved (task, document, etc.)
        entity_id: Optional ID of the entity involved
        entity_title: Optional title of the entity (for display without joins)
        extra_data: Optional additional data (JSON)

    Returns:
        The created Activity record
    """
    activity = Activity(
        organization_id=organization_id,
        user_id=user_id,
        activity_type=activity_type,
        description=description,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_title=entity_title,
        extra_data=extra_data
    )
    db.add(activity)
    return activity


def activity_to_response(activity: Activity) -> ActivityResponse:
    """Convert Activity model to ActivityResponse."""
    user_brief = None
    if activity.user:
        user_brief = UserBrief(
            id=activity.user.id,
            email=activity.user.email,
            name=activity.user.name
        )

    return ActivityResponse(
        id=activity.id,
        user_id=activity.user_id,
        user=user_brief,
        activity_type=activity.activity_type,
        description=activity.description,
        entity_type=activity.entity_type,
        entity_id=activity.entity_id,
        entity_title=activity.entity_title,
        extra_data=activity.extra_data,
        created_at=activity.created_at
    )


# ============ API Endpoints ============

@router.get("", response_model=ActivityListResponse)
async def list_activity(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    activity_type: Optional[str] = Query(None, description="Filter by activity type"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List organization-wide activity feed.

    Returns paginated list of activities, newest first.
    Can filter by entity type, user, or activity type.
    """
    org_id = current_user.organization_id

    query = db.query(Activity).filter(
        Activity.organization_id == org_id
    )

    if entity_type:
        query = query.filter(Activity.entity_type == entity_type)

    if user_id:
        query = query.filter(Activity.user_id == user_id)

    if activity_type:
        query = query.filter(Activity.activity_type == activity_type)

    # Get total count
    total_count = query.count()

    # Get paginated results
    activities = query.order_by(
        Activity.created_at.desc()
    ).offset(offset).limit(limit).all()

    return ActivityListResponse(
        items=[activity_to_response(a) for a in activities],
        total_count=total_count
    )


@router.get("/entity/{entity_type}/{entity_id}", response_model=List[ActivityResponse])
async def get_entity_activity(
    entity_type: str,
    entity_id: int,
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get activity feed for a specific entity.

    Returns the most recent activities related to the specified entity.
    """
    org_id = current_user.organization_id

    activities = db.query(Activity).filter(
        Activity.organization_id == org_id,
        Activity.entity_type == entity_type,
        Activity.entity_id == entity_id
    ).order_by(
        Activity.created_at.desc()
    ).limit(limit).all()

    return [activity_to_response(a) for a in activities]


@router.get("/types")
async def get_activity_types(
    current_user: User = Depends(get_current_user)
):
    """
    Get list of available activity types.

    Useful for building filter dropdowns in the UI.
    """
    return {
        "types": [t.value for t in ActivityType]
    }
