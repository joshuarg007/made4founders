"""
Audit logging service for security-sensitive operations.

Features:
- Persistent audit logs in database
- Query endpoints for admins
- Automatic logging middleware integration

Endpoints:
- GET /api/audit-logs - List audit logs (admin only)
- GET /api/audit-logs/stats - Audit log statistics (admin only)
- GET /api/audit-logs/export - Export logs as CSV (admin only)
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, List
from io import StringIO
import csv

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from .database import get_db
from .auth import get_current_user
from .models import User, AuditLog

logger = logging.getLogger(__name__)

router = APIRouter()


class AuditLogResponse(BaseModel):
    """Audit log entry response."""
    id: int
    event_type: str
    action: str
    resource: Optional[str]
    resource_id: Optional[str]
    ip_address: Optional[str]
    user_agent: Optional[str]
    status_code: Optional[int]
    success: bool
    details: Optional[dict]
    created_at: datetime
    user_email: Optional[str]

    class Config:
        from_attributes = True


class AuditLogStats(BaseModel):
    """Audit log statistics."""
    total_events: int
    events_today: int
    events_this_week: int
    failed_logins_today: int
    unique_ips_today: int
    by_event_type: dict
    recent_failed_logins: List[dict]


def require_admin(current_user: User = Depends(get_current_user)):
    """Require admin role."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def create_audit_log(
    db: Session,
    event_type: str,
    action: str,
    user_id: Optional[int] = None,
    organization_id: Optional[int] = None,
    resource: Optional[str] = None,
    resource_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    status_code: Optional[int] = None,
    success: bool = True,
    details: Optional[dict] = None
):
    """
    Create an audit log entry.
    Call this from security-sensitive operations.
    """
    try:
        log_entry = AuditLog(
            event_type=event_type,
            action=action,
            user_id=user_id,
            organization_id=organization_id,
            resource=resource,
            resource_id=resource_id,
            ip_address=ip_address,
            user_agent=user_agent,
            status_code=status_code,
            success=success,
            details=json.dumps(details) if details else None
        )
        db.add(log_entry)
        db.commit()
        return log_entry
    except Exception as e:
        logger.error(f"Failed to create audit log: {e}")
        db.rollback()
        return None


@router.get("/", response_model=List[AuditLogResponse])
async def list_audit_logs(
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    success: Optional[bool] = Query(None, description="Filter by success status"),
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    limit: int = Query(100, le=500, description="Number of records to return"),
    offset: int = Query(0, description="Number of records to skip"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    List audit logs with filtering and pagination (admin only).
    """
    org_id = current_user.organization_id

    query = db.query(AuditLog, User.email.label('user_email')).outerjoin(
        User, AuditLog.user_id == User.id
    ).filter(
        (AuditLog.organization_id == org_id) | (AuditLog.organization_id.is_(None))
    )

    if event_type:
        query = query.filter(AuditLog.event_type == event_type)
    if success is not None:
        query = query.filter(AuditLog.success == success)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if start_date:
        query = query.filter(AuditLog.created_at >= start_date)
    if end_date:
        query = query.filter(AuditLog.created_at <= end_date)

    results = query.order_by(desc(AuditLog.created_at)).offset(offset).limit(limit).all()

    logs = []
    for log, user_email in results:
        log_dict = {
            "id": log.id,
            "event_type": log.event_type,
            "action": log.action,
            "resource": log.resource,
            "resource_id": log.resource_id,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "status_code": log.status_code,
            "success": log.success,
            "details": json.loads(log.details) if log.details else None,
            "created_at": log.created_at,
            "user_email": user_email
        }
        logs.append(AuditLogResponse(**log_dict))

    return logs


@router.get("/stats", response_model=AuditLogStats)
async def audit_log_stats(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Get audit log statistics (admin only).
    """
    org_id = current_user.organization_id
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)

    # Base filter
    base_filter = (AuditLog.organization_id == org_id) | (AuditLog.organization_id.is_(None))

    # Total events
    total_events = db.query(func.count(AuditLog.id)).filter(base_filter).scalar()

    # Events today
    events_today = db.query(func.count(AuditLog.id)).filter(
        base_filter,
        AuditLog.created_at >= today_start
    ).scalar()

    # Events this week
    events_this_week = db.query(func.count(AuditLog.id)).filter(
        base_filter,
        AuditLog.created_at >= week_start
    ).scalar()

    # Failed logins today
    failed_logins_today = db.query(func.count(AuditLog.id)).filter(
        base_filter,
        AuditLog.event_type == "login",
        AuditLog.success == False,
        AuditLog.created_at >= today_start
    ).scalar()

    # Unique IPs today
    unique_ips = db.query(func.count(func.distinct(AuditLog.ip_address))).filter(
        base_filter,
        AuditLog.created_at >= today_start
    ).scalar()

    # By event type (last 30 days)
    thirty_days_ago = now - timedelta(days=30)
    event_counts = db.query(
        AuditLog.event_type,
        func.count(AuditLog.id).label('count')
    ).filter(
        base_filter,
        AuditLog.created_at >= thirty_days_ago
    ).group_by(AuditLog.event_type).all()

    by_event_type = {event_type: count for event_type, count in event_counts}

    # Recent failed logins
    recent_failed = db.query(AuditLog).filter(
        base_filter,
        AuditLog.event_type == "login",
        AuditLog.success == False
    ).order_by(desc(AuditLog.created_at)).limit(10).all()

    recent_failed_logins = [{
        "ip_address": log.ip_address,
        "created_at": log.created_at.isoformat(),
        "details": json.loads(log.details) if log.details else None
    } for log in recent_failed]

    return AuditLogStats(
        total_events=total_events or 0,
        events_today=events_today or 0,
        events_this_week=events_this_week or 0,
        failed_logins_today=failed_logins_today or 0,
        unique_ips_today=unique_ips or 0,
        by_event_type=by_event_type,
        recent_failed_logins=recent_failed_logins
    )


@router.get("/export")
async def export_audit_logs(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Export audit logs as CSV (admin only).
    """
    org_id = current_user.organization_id

    query = db.query(AuditLog, User.email.label('user_email')).outerjoin(
        User, AuditLog.user_id == User.id
    ).filter(
        (AuditLog.organization_id == org_id) | (AuditLog.organization_id.is_(None))
    )

    if start_date:
        query = query.filter(AuditLog.created_at >= start_date)
    if end_date:
        query = query.filter(AuditLog.created_at <= end_date)

    results = query.order_by(desc(AuditLog.created_at)).limit(10000).all()

    # Create CSV
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Timestamp", "Event Type", "Action", "User Email",
        "IP Address", "Status Code", "Success", "Resource", "Details"
    ])

    for log, user_email in results:
        writer.writerow([
            log.id,
            log.created_at.isoformat(),
            log.event_type,
            log.action,
            user_email or "N/A",
            log.ip_address or "N/A",
            log.status_code or "N/A",
            "Yes" if log.success else "No",
            log.resource or "N/A",
            log.details or ""
        ])

    csv_content = output.getvalue()
    output.close()

    filename = f"audit_logs_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# Event type constants for consistency
class EventTypes:
    LOGIN = "login"
    LOGOUT = "logout"
    PASSWORD_CHANGE = "password_change"
    PASSWORD_RESET = "password_reset"
    MFA_SETUP = "mfa_setup"
    MFA_DISABLE = "mfa_disable"
    VAULT_ACCESS = "vault_access"
    CREDENTIAL_VIEW = "credential_view"
    CREDENTIAL_CREATE = "credential_create"
    CREDENTIAL_UPDATE = "credential_update"
    CREDENTIAL_DELETE = "credential_delete"
    USER_CREATE = "user_create"
    USER_UPDATE = "user_update"
    USER_DELETE = "user_delete"
    OAUTH_LINK = "oauth_link"
    BACKUP_CREATE = "backup_create"
    BACKUP_RESTORE = "backup_restore"
