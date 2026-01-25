"""
Data export service for user data (GDPR compliance).

Supports:
- Export all user data as JSON
- Export specific data types as CSV
- Download as zip archive

Endpoints:
- GET /api/export/all - Export all data as JSON
- GET /api/export/contacts - Export contacts as CSV
- GET /api/export/deadlines - Export deadlines as CSV
- GET /api/export/tasks - Export tasks as CSV
- GET /api/export/credentials - Export credentials (masked) as CSV
"""
import json
import csv
from io import StringIO, BytesIO
import zipfile
from datetime import datetime
from typing import List, Dict, Any

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from .database import get_db
from .auth import get_current_user
from .models import (
    User, Contact, Deadline, Task, TaskBoard, TaskColumn,
    Credential, Document, WebLink, ProductOffered, ProductUsed,
    Service, Metric, BusinessInfo
)

router = APIRouter()


def model_to_dict(obj, exclude_fields: List[str] = None) -> Dict[str, Any]:
    """Convert SQLAlchemy model to dict, excluding sensitive fields."""
    exclude = set(exclude_fields or [])
    exclude.update(['_sa_instance_state', 'password', 'hashed_password', 'encrypted_value'])

    result = {}
    for column in obj.__table__.columns:
        if column.name not in exclude:
            value = getattr(obj, column.name)
            if isinstance(value, datetime):
                value = value.isoformat()
            result[column.name] = value
    return result


def create_csv(data: List[Dict], columns: List[str] = None) -> str:
    """Create CSV string from list of dicts."""
    if not data:
        return ""

    output = StringIO()
    fieldnames = columns or list(data[0].keys())
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
    writer.writeheader()
    for row in data:
        writer.writerow(row)
    return output.getvalue()


@router.get("/all")
async def export_all_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Export all user data as a JSON file (GDPR data portability).
    """
    org_id = current_user.organization_id

    # Gather all user data
    export_data = {
        "export_date": datetime.utcnow().isoformat(),
        "user": {
            "email": current_user.email,
            "name": current_user.name,
            "role": current_user.role,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        },
        "contacts": [],
        "deadlines": [],
        "tasks": [],
        "documents": [],
        "web_links": [],
        "products_offered": [],
        "products_used": [],
        "services": [],
        "metrics": [],
        "credentials": [],  # Masked
        "business_info": [],
    }

    # Contacts
    contacts = db.query(Contact).filter(Contact.organization_id == org_id).all()
    export_data["contacts"] = [model_to_dict(c) for c in contacts]

    # Deadlines
    deadlines = db.query(Deadline).filter(Deadline.organization_id == org_id).all()
    export_data["deadlines"] = [model_to_dict(d) for d in deadlines]

    # Tasks (need to get through boards -> columns -> tasks)
    boards = db.query(TaskBoard).filter(TaskBoard.organization_id == org_id).all()
    for board in boards:
        columns = db.query(TaskColumn).filter(TaskColumn.board_id == board.id).all()
        for column in columns:
            tasks = db.query(Task).filter(Task.column_id == column.id).all()
            for task in tasks:
                task_dict = model_to_dict(task)
                task_dict["board_name"] = board.name
                task_dict["column_name"] = column.name
                export_data["tasks"].append(task_dict)

    # Documents (metadata only, not actual files)
    documents = db.query(Document).filter(Document.organization_id == org_id).all()
    export_data["documents"] = [model_to_dict(d, exclude_fields=['file_path']) for d in documents]

    # Web Links
    web_links = db.query(WebLink).filter(WebLink.organization_id == org_id).all()
    export_data["web_links"] = [model_to_dict(w) for w in web_links]

    # Products Offered
    products_offered = db.query(ProductOffered).filter(ProductOffered.organization_id == org_id).all()
    export_data["products_offered"] = [model_to_dict(p) for p in products_offered]

    # Products Used
    products_used = db.query(ProductUsed).filter(ProductUsed.organization_id == org_id).all()
    export_data["products_used"] = [model_to_dict(p) for p in products_used]

    # Services
    services = db.query(Service).filter(Service.organization_id == org_id).all()
    export_data["services"] = [model_to_dict(s, exclude_fields=['password']) for s in services]

    # Metrics
    metrics = db.query(Metric).filter(Metric.organization_id == org_id).all()
    export_data["metrics"] = [model_to_dict(m) for m in metrics]

    # Credentials (masked values)
    credentials = db.query(Credential).filter(Credential.organization_id == org_id).all()
    for cred in credentials:
        cred_dict = {
            "id": cred.id,
            "name": cred.name,
            "username": cred.username,
            "url": cred.url,
            "category": cred.category,
            "notes": cred.notes,
            "created_at": cred.created_at.isoformat() if cred.created_at else None,
            "password": "********",  # Never export actual passwords
        }
        export_data["credentials"].append(cred_dict)

    # Business Info
    business_info = db.query(BusinessInfo).filter(BusinessInfo.organization_id == org_id).all()
    export_data["business_info"] = [model_to_dict(b) for b in business_info]

    # Return as JSON file download
    json_content = json.dumps(export_data, indent=2, default=str)
    filename = f"made4founders_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"

    return Response(
        content=json_content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/contacts")
async def export_contacts_csv(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export contacts as CSV."""
    org_id = current_user.organization_id
    contacts = db.query(Contact).filter(Contact.organization_id == org_id).all()

    columns = [
        "name", "email", "secondary_email", "phone", "mobile_phone",
        "company", "title", "city", "state", "country",
        "linkedin_url", "twitter_handle", "tags", "notes", "created_at"
    ]

    data = [model_to_dict(c) for c in contacts]
    csv_content = create_csv(data, columns)

    filename = f"contacts_{datetime.utcnow().strftime('%Y%m%d')}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/deadlines")
async def export_deadlines_csv(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export deadlines as CSV."""
    org_id = current_user.organization_id
    deadlines = db.query(Deadline).filter(Deadline.organization_id == org_id).all()

    columns = [
        "title", "description", "due_date", "category",
        "is_completed", "completed_at", "reminder_days", "created_at"
    ]

    data = [model_to_dict(d) for d in deadlines]
    csv_content = create_csv(data, columns)

    filename = f"deadlines_{datetime.utcnow().strftime('%Y%m%d')}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/tasks")
async def export_tasks_csv(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export tasks as CSV."""
    org_id = current_user.organization_id

    # Get tasks through boards -> columns
    boards = db.query(TaskBoard).filter(TaskBoard.organization_id == org_id).all()
    tasks_data = []

    for board in boards:
        columns = db.query(TaskColumn).filter(TaskColumn.board_id == board.id).all()
        for column in columns:
            tasks = db.query(Task).filter(Task.column_id == column.id).all()
            for task in tasks:
                tasks_data.append({
                    "board": board.name,
                    "column": column.name,
                    "title": task.title,
                    "description": task.description,
                    "status": task.status,
                    "priority": task.priority,
                    "due_date": task.due_date.isoformat() if task.due_date else None,
                    "estimated_hours": task.estimated_hours,
                    "actual_hours": task.actual_hours,
                    "created_at": task.created_at.isoformat() if task.created_at else None,
                })

    columns = [
        "board", "column", "title", "description", "status",
        "priority", "due_date", "estimated_hours", "actual_hours", "created_at"
    ]

    csv_content = create_csv(tasks_data, columns)

    filename = f"tasks_{datetime.utcnow().strftime('%Y%m%d')}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/metrics")
async def export_metrics_csv(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export metrics as CSV."""
    org_id = current_user.organization_id
    metrics = db.query(Metric).filter(Metric.organization_id == org_id).all()

    columns = [
        "name", "category", "value", "unit", "target",
        "trend", "frequency", "last_updated", "created_at"
    ]

    data = [model_to_dict(m) for m in metrics]
    csv_content = create_csv(data, columns)

    filename = f"metrics_{datetime.utcnow().strftime('%Y%m%d')}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
