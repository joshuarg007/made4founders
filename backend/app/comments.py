"""
Comments API - Polymorphic comments on any entity.

Supports comments on tasks, deadlines, documents, contacts, metrics, etc.
Includes @mention detection and notification creation.
"""

import re
from typing import List, Optional
from datetime import datetime, UTC, UTC
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from .database import get_db
from .models import User, Comment, Notification, Activity, EntityType, NotificationType, ActivityType
from .schemas import (
    CommentCreate, CommentUpdate, CommentResponse, UserBrief,
    CommentCountsRequest, CommentCountsResponse
)
from .auth import get_current_user

router = APIRouter(prefix="/api/comments", tags=["Comments"])


# ============ Helper Functions ============

def get_comment_with_org_check(comment_id: int, org_id: int, db: Session) -> Comment:
    """Get a comment and verify it belongs to the user's organization."""
    comment = db.query(Comment).filter(
        Comment.id == comment_id,
        Comment.organization_id == org_id
    ).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    return comment


def extract_mentions(content: str, org_id: int, db: Session) -> List[int]:
    """
    Extract @mentioned user IDs from comment content.

    Looks for patterns like @username or @"Full Name" and resolves
    them to user IDs within the organization.
    """
    # Pattern matches @username or @"Full Name" or @FirstName
    mention_pattern = r'@(?:"([^"]+)"|(\w+))'
    matches = re.findall(mention_pattern, content)

    mentioned_user_ids = []
    for quoted_name, username in matches:
        name_to_find = quoted_name if quoted_name else username

        # Search for user by name or email in the organization
        user = db.query(User).filter(
            User.organization_id == org_id,
            User.is_active == True,
            (User.name.ilike(f"%{name_to_find}%") | User.email.ilike(f"{name_to_find}%"))
        ).first()

        if user and user.id not in mentioned_user_ids:
            mentioned_user_ids.append(user.id)

    return mentioned_user_ids


def create_mention_notifications(
    comment: Comment,
    mentioned_user_ids: List[int],
    actor: User,
    db: Session
):
    """Create notifications for mentioned users."""
    for user_id in mentioned_user_ids:
        # Don't notify yourself
        if user_id == actor.id:
            continue

        notification = Notification(
            organization_id=comment.organization_id,
            user_id=user_id,
            notification_type=NotificationType.MENTION.value,
            title=f"{actor.name or actor.email} mentioned you",
            message=comment.content[:200] + ("..." if len(comment.content) > 200 else ""),
            entity_type=comment.entity_type,
            entity_id=comment.entity_id,
            actor_user_id=actor.id
        )
        db.add(notification)


def record_comment_activity(
    comment: Comment,
    actor: User,
    entity_title: str,
    db: Session
):
    """Record comment creation in activity feed."""
    activity = Activity(
        organization_id=comment.organization_id,
        user_id=actor.id,
        activity_type=ActivityType.COMMENT_CREATED.value,
        description=f"{actor.name or actor.email} commented on {comment.entity_type}",
        entity_type=comment.entity_type,
        entity_id=comment.entity_id,
        entity_title=entity_title,
        extra_data={"comment_id": comment.id, "preview": comment.content[:100]}
    )
    db.add(activity)


def get_entity_title(entity_type: str, entity_id: int, org_id: int, db: Session) -> str:
    """Get a display title for an entity (for activity feed)."""
    # Import models here to avoid circular imports
    from .models import Task, Deadline, Document, Contact, Metric, MeetingTranscript

    entity_models = {
        "task": (Task, "title"),
        "deadline": (Deadline, "title"),
        "document": (Document, "filename"),
        "contact": (Contact, "name"),
        "metric": (Metric, "name"),
        "meeting": (MeetingTranscript, "title"),
    }

    if entity_type in entity_models:
        model, title_field = entity_models[entity_type]
        entity = db.query(model).filter(
            model.id == entity_id
        ).first()
        if entity:
            return getattr(entity, title_field, f"{entity_type} #{entity_id}")

    return f"{entity_type} #{entity_id}"


def comment_to_response(comment: Comment, db: Session) -> CommentResponse:
    """Convert Comment model to CommentResponse with user info."""
    # Get user info
    user_brief = None
    if comment.user:
        user_brief = UserBrief(
            id=comment.user.id,
            email=comment.user.email,
            name=comment.user.name
        )

    # Get mentioned users
    mentioned_users = None
    if comment.mentioned_user_ids:
        users = db.query(User).filter(
            User.id.in_(comment.mentioned_user_ids)
        ).all()
        mentioned_users = [
            UserBrief(id=u.id, email=u.email, name=u.name)
            for u in users
        ]

    # Count replies
    reply_count = db.query(func.count(Comment.id)).filter(
        Comment.parent_id == comment.id
    ).scalar() or 0

    return CommentResponse(
        id=comment.id,
        organization_id=comment.organization_id,
        entity_type=comment.entity_type,
        entity_id=comment.entity_id,
        user_id=comment.user_id,
        user=user_brief,
        content=comment.content,
        is_edited=comment.is_edited,
        mentioned_user_ids=comment.mentioned_user_ids,
        mentioned_users=mentioned_users,
        parent_id=comment.parent_id,
        reply_count=reply_count,
        created_at=comment.created_at,
        updated_at=comment.updated_at
    )


# ============ API Endpoints ============

@router.get("", response_model=List[CommentResponse])
async def list_comments(
    entity_type: str = Query(..., description="Entity type (task, deadline, document, etc.)"),
    entity_id: int = Query(..., description="Entity ID"),
    include_replies: bool = Query(True, description="Include threaded replies"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all comments for an entity.

    Returns top-level comments (and optionally replies) for the specified entity.
    Comments are ordered by creation date (oldest first for natural reading order).
    """
    org_id = current_user.organization_id

    # Build query
    query = db.query(Comment).filter(
        Comment.organization_id == org_id,
        Comment.entity_type == entity_type,
        Comment.entity_id == entity_id
    )

    if not include_replies:
        query = query.filter(Comment.parent_id == None)

    comments = query.order_by(Comment.created_at.asc()).all()

    return [comment_to_response(c, db) for c in comments]


@router.post("", response_model=CommentResponse)
async def create_comment(
    data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new comment on an entity.

    Automatically detects @mentions in the content and creates notifications
    for mentioned users. Also records the comment in the activity feed.
    """
    org_id = current_user.organization_id

    # Validate entity type
    valid_types = [e.value for e in EntityType]
    if data.entity_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid entity_type. Must be one of: {', '.join(valid_types)}"
        )

    # Validate parent comment if provided
    if data.parent_id:
        parent = get_comment_with_org_check(data.parent_id, org_id, db)
        # Ensure parent is for the same entity
        if parent.entity_type != data.entity_type or parent.entity_id != data.entity_id:
            raise HTTPException(
                status_code=400,
                detail="Parent comment must be on the same entity"
            )

    # Extract @mentions from content
    mentioned_user_ids = extract_mentions(data.content, org_id, db)

    # Create comment
    comment = Comment(
        organization_id=org_id,
        entity_type=data.entity_type,
        entity_id=data.entity_id,
        user_id=current_user.id,
        content=data.content,
        mentioned_user_ids=mentioned_user_ids if mentioned_user_ids else None,
        parent_id=data.parent_id
    )
    db.add(comment)
    db.flush()  # Get the ID

    # Create notifications for mentioned users
    if mentioned_user_ids:
        create_mention_notifications(comment, mentioned_user_ids, current_user, db)

    # Create reply notification if this is a reply
    if data.parent_id:
        parent = db.query(Comment).filter(Comment.id == data.parent_id).first()
        if parent and parent.user_id != current_user.id:
            notification = Notification(
                organization_id=org_id,
                user_id=parent.user_id,
                notification_type=NotificationType.COMMENT_REPLY.value,
                title=f"{current_user.name or current_user.email} replied to your comment",
                message=data.content[:200] + ("..." if len(data.content) > 200 else ""),
                entity_type=data.entity_type,
                entity_id=data.entity_id,
                actor_user_id=current_user.id
            )
            db.add(notification)

    # Record in activity feed
    entity_title = get_entity_title(data.entity_type, data.entity_id, org_id, db)
    record_comment_activity(comment, current_user, entity_title, db)

    db.commit()
    db.refresh(comment)

    return comment_to_response(comment, db)


@router.patch("/{comment_id}", response_model=CommentResponse)
async def update_comment(
    comment_id: int,
    data: CommentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update a comment.

    Only the comment author can edit their comment.
    Sets is_edited flag to True.
    """
    org_id = current_user.organization_id
    comment = get_comment_with_org_check(comment_id, org_id, db)

    # Only author can edit
    if comment.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only edit your own comments"
        )

    # Update content
    comment.content = data.content
    comment.is_edited = True
    comment.updated_at = datetime.now(UTC)

    # Re-extract mentions (in case they changed)
    mentioned_user_ids = extract_mentions(data.content, org_id, db)

    # Find new mentions (not in original list)
    old_mentions = set(comment.mentioned_user_ids or [])
    new_mentions = set(mentioned_user_ids) - old_mentions

    comment.mentioned_user_ids = mentioned_user_ids if mentioned_user_ids else None

    # Create notifications for newly mentioned users
    if new_mentions:
        create_mention_notifications(comment, list(new_mentions), current_user, db)

    db.commit()
    db.refresh(comment)

    return comment_to_response(comment, db)


@router.delete("/{comment_id}")
async def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a comment.

    Only the comment author or an admin can delete a comment.
    Replies to this comment will also be deleted (cascade).
    """
    org_id = current_user.organization_id
    comment = get_comment_with_org_check(comment_id, org_id, db)

    # Only author or admin can delete
    if comment.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="You can only delete your own comments"
        )

    db.delete(comment)
    db.commit()

    return {"ok": True}


@router.post("/counts", response_model=CommentCountsResponse)
async def get_comment_counts(
    data: CommentCountsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get comment counts for multiple entities in batch.

    Useful for displaying comment count badges on list views.
    """
    org_id = current_user.organization_id
    counts = {}

    for entity in data.entities:
        entity_type = entity.get("entity_type")
        entity_id = entity.get("entity_id")

        if entity_type and entity_id:
            count = db.query(func.count(Comment.id)).filter(
                Comment.organization_id == org_id,
                Comment.entity_type == entity_type,
                Comment.entity_id == entity_id
            ).scalar() or 0

            counts[f"{entity_type}:{entity_id}"] = count

    return CommentCountsResponse(counts=counts)


@router.get("/users/search", response_model=List[UserBrief])
async def search_users_for_mention(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Search for users to @mention in comments.

    Returns matching users from the same organization for autocomplete.
    """
    org_id = current_user.organization_id

    users = db.query(User).filter(
        User.organization_id == org_id,
        User.is_active == True,
        (User.name.ilike(f"%{q}%") | User.email.ilike(f"%{q}%"))
    ).limit(limit).all()

    return [
        UserBrief(id=u.id, email=u.email, name=u.name)
        for u in users
    ]
