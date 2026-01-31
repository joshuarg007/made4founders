"""
Investor Updates API

Allows founders to send professional update emails to their investors
with key metrics and business highlights.
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, UTC, UTC
import json
import os
import logging

from .database import get_db
from .auth import get_current_user
from .models import (
    User, InvestorUpdate, InvestorUpdateRecipient, Shareholder,
    Metric, Organization
)
from .schemas import (
    InvestorUpdateCreate, InvestorUpdateUpdate, InvestorUpdateResponse,
    InvestorUpdateWithRecipients, InvestorUpdatePreview, InvestorUpdateMetrics
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/investor-updates", tags=["investor-updates"])

# Email configuration
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@made4founders.com")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


def get_ses_client():
    """Get AWS SES client (lazy load)."""
    try:
        import boto3
        return boto3.client('ses', region_name=os.getenv("AWS_REGION", "us-east-1"))
    except ImportError:
        logger.warning("boto3 not installed, email sending disabled")
        return None
    except Exception as e:
        logger.error(f"Failed to create SES client: {e}")
        return None


def send_email(to: str, subject: str, html: str) -> bool:
    """Send an email via AWS SES."""
    ses = get_ses_client()
    if not ses:
        logger.warning(f"SES not available, would send to {to}: {subject}")
        return True  # Return True for testing without SES

    try:
        ses.send_email(
            Source=FROM_EMAIL,
            Destination={'ToAddresses': [to]},
            Message={
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {
                    'Html': {'Data': html, 'Charset': 'UTF-8'}
                }
            }
        )
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")
        return False


def get_latest_metrics(db: Session, org_id: int) -> dict:
    """Get the latest value for each metric type."""
    metric_types = ['mrr', 'arr', 'runway', 'cash', 'burn_rate', 'customers', 'revenue']
    result = {}

    for metric_type in metric_types:
        metric = db.query(Metric).filter(
            Metric.organization_id == org_id,
            Metric.metric_type == metric_type
        ).order_by(Metric.date.desc()).first()

        if metric:
            try:
                result[metric_type] = float(metric.value)
            except (ValueError, TypeError):
                result[metric_type] = metric.value

    return result


def format_currency(value: float) -> str:
    """Format a number as currency."""
    if value >= 1_000_000:
        return f"${value / 1_000_000:.1f}M"
    elif value >= 1_000:
        return f"${value / 1_000:.0f}K"
    else:
        return f"${value:,.0f}"


def format_metric_value(metric_type: str, value: float) -> str:
    """Format a metric value for display."""
    if metric_type in ['mrr', 'arr', 'cash', 'burn_rate', 'revenue']:
        return format_currency(value)
    elif metric_type == 'runway':
        return f"{value:.1f} months"
    elif metric_type == 'customers':
        return f"{int(value):,}"
    else:
        return str(value)


def get_metric_label(metric_type: str) -> str:
    """Get display label for metric type."""
    labels = {
        'mrr': 'Monthly Recurring Revenue',
        'arr': 'Annual Recurring Revenue',
        'runway': 'Runway',
        'cash': 'Cash on Hand',
        'burn_rate': 'Monthly Burn Rate',
        'customers': 'Customers',
        'revenue': 'Total Revenue',
    }
    return labels.get(metric_type, metric_type.replace('_', ' ').title())


def generate_email_html(
    update: InvestorUpdate,
    metrics: dict,
    org_name: str
) -> str:
    """Generate professional HTML email for investor update."""

    # Parse JSON fields
    highlights = json.loads(update.highlights) if update.highlights else []
    included_metrics = json.loads(update.included_metrics) if update.included_metrics else []

    # Build metrics section
    metrics_html = ""
    if included_metrics:
        metrics_rows = []
        for metric_type in included_metrics:
            if metric_type in metrics:
                value = metrics[metric_type]
                label = get_metric_label(metric_type)
                formatted = format_metric_value(metric_type, value)
                metrics_rows.append(f"""
                    <tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
                            {label}
                        </td>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">
                            {formatted}
                        </td>
                    </tr>
                """)

        if metrics_rows:
            metrics_html = f"""
                <div style="margin: 24px 0;">
                    <h3 style="color: #374151; font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">
                        Key Metrics
                    </h3>
                    <table style="width: 100%; border-collapse: collapse; background: #f9fafb; border-radius: 8px; overflow: hidden;">
                        {''.join(metrics_rows)}
                    </table>
                </div>
            """

    # Build highlights section
    highlights_html = ""
    if highlights:
        items = ''.join([f'<li style="margin-bottom: 8px; color: #374151;">{h}</li>' for h in highlights])
        highlights_html = f"""
            <div style="margin: 24px 0;">
                <h3 style="color: #374151; font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">
                    Highlights
                </h3>
                <ul style="margin: 0; padding-left: 20px;">
                    {items}
                </ul>
            </div>
        """

    # Build signature
    signature_html = ""
    if update.signature_name:
        signature_html = f"""
            <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; color: #374151;">Best regards,</p>
                <p style="margin: 8px 0 0 0; color: #111827; font-weight: 600;">{update.signature_name}</p>
                {f'<p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">{update.signature_title}</p>' if update.signature_title else ''}
            </div>
        """

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{update.title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; background-color: #f3f4f6;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 32px 24px; text-align: center;">
                <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0;">
                    {update.title}
                </h1>
                <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 8px 0 0 0;">
                    {org_name}
                </p>
            </div>

            <!-- Content -->
            <div style="padding: 32px 24px;">
                {f'<p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">{update.greeting}</p>' if update.greeting else ''}

                {metrics_html}

                {highlights_html}

                {f'<div style="margin: 24px 0; color: #374151;">{update.body_content}</div>' if update.body_content else ''}

                {f'<p style="color: #374151; margin: 24px 0 0 0;">{update.closing}</p>' if update.closing else ''}

                {signature_html}
            </div>

            <!-- Footer -->
            <div style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="color: #6b7280; font-size: 12px; margin: 0;">
                    This update was sent via <a href="{FRONTEND_URL}" style="color: #3b82f6; text-decoration: none;">Made4Founders</a>
                </p>
                <p style="color: #9ca3af; font-size: 11px; margin: 8px 0 0 0;">
                    {datetime.now().strftime('%B %d, %Y')}
                </p>
            </div>
        </div>
    </div>
</body>
</html>
"""
    return html


def get_recipients_for_update(
    db: Session,
    org_id: int,
    recipient_types: List[str] = None,
    recipient_ids: List[int] = None
) -> List[Shareholder]:
    """Get shareholders matching the recipient criteria."""
    query = db.query(Shareholder).filter(
        Shareholder.organization_id == org_id,
        Shareholder.is_active == True,
        Shareholder.email.isnot(None),
        Shareholder.email != ""
    )

    if recipient_ids:
        query = query.filter(Shareholder.id.in_(recipient_ids))
    elif recipient_types:
        query = query.filter(Shareholder.shareholder_type.in_(recipient_types))
    else:
        # Default to investors and board members
        query = query.filter(Shareholder.shareholder_type.in_(['investor', 'board_member']))

    return query.all()


def serialize_update(update: InvestorUpdate) -> dict:
    """Serialize an investor update for API response."""
    return {
        "id": update.id,
        "title": update.title,
        "subject_line": update.subject_line,
        "greeting": update.greeting,
        "highlights": json.loads(update.highlights) if update.highlights else None,
        "body_content": update.body_content,
        "closing": update.closing,
        "signature_name": update.signature_name,
        "signature_title": update.signature_title,
        "included_metrics": json.loads(update.included_metrics) if update.included_metrics else None,
        "recipient_types": json.loads(update.recipient_types) if update.recipient_types else None,
        "recipient_ids": json.loads(update.recipient_ids) if update.recipient_ids else None,
        "status": update.status,
        "scheduled_at": update.scheduled_at,
        "sent_at": update.sent_at,
        "recipient_count": update.recipient_count,
        "sent_count": update.sent_count,
        "failed_count": update.failed_count,
        "opened_count": update.opened_count,
        "created_by_id": update.created_by_id,
        "created_at": update.created_at,
        "updated_at": update.updated_at,
    }


# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.get("", response_model=List[InvestorUpdateResponse])
def list_investor_updates(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all investor updates for the organization."""
    query = db.query(InvestorUpdate).filter(
        InvestorUpdate.organization_id == current_user.organization_id
    )

    if status:
        query = query.filter(InvestorUpdate.status == status)

    updates = query.order_by(InvestorUpdate.created_at.desc()).all()
    return [serialize_update(u) for u in updates]


@router.post("", response_model=InvestorUpdateResponse, status_code=status.HTTP_201_CREATED)
def create_investor_update(
    data: InvestorUpdateCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new investor update draft."""
    update = InvestorUpdate(
        organization_id=current_user.organization_id,
        created_by_id=current_user.id,
        title=data.title,
        subject_line=data.subject_line or f"{data.title} - Investor Update",
        greeting=data.greeting,
        highlights=json.dumps(data.highlights) if data.highlights else None,
        body_content=data.body_content,
        closing=data.closing,
        signature_name=data.signature_name or current_user.name,
        signature_title=data.signature_title,
        included_metrics=json.dumps(data.included_metrics) if data.included_metrics else None,
        recipient_types=json.dumps(data.recipient_types) if data.recipient_types else None,
        recipient_ids=json.dumps(data.recipient_ids) if data.recipient_ids else None,
        status="draft"
    )

    db.add(update)
    db.commit()
    db.refresh(update)

    return serialize_update(update)


@router.get("/metrics", response_model=InvestorUpdateMetrics)
def get_available_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get latest metrics available for investor updates."""
    metrics = get_latest_metrics(db, current_user.organization_id)

    # Calculate growth rate if we have historical MRR
    growth_rate = None
    mrr_history = db.query(Metric).filter(
        Metric.organization_id == current_user.organization_id,
        Metric.metric_type == 'mrr'
    ).order_by(Metric.date.desc()).limit(2).all()

    if len(mrr_history) >= 2:
        try:
            current = float(mrr_history[0].value)
            previous = float(mrr_history[1].value)
            if previous > 0:
                growth_rate = ((current - previous) / previous) * 100
        except (ValueError, TypeError):
            pass

    return InvestorUpdateMetrics(
        mrr=metrics.get('mrr'),
        arr=metrics.get('arr'),
        runway_months=metrics.get('runway'),
        cash_on_hand=metrics.get('cash'),
        burn_rate=metrics.get('burn_rate'),
        customers=int(metrics['customers']) if 'customers' in metrics else None,
        revenue=metrics.get('revenue'),
        growth_rate=growth_rate
    )


@router.get("/recipients")
def get_available_recipients(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get shareholders who can receive updates."""
    shareholders = db.query(Shareholder).filter(
        Shareholder.organization_id == current_user.organization_id,
        Shareholder.is_active == True,
        Shareholder.email.isnot(None),
        Shareholder.email != ""
    ).order_by(Shareholder.shareholder_type, Shareholder.name).all()

    return [{
        "id": s.id,
        "name": s.name,
        "email": s.email,
        "type": s.shareholder_type,
        "company": s.company,
        "title": s.title,
    } for s in shareholders]


@router.get("/{update_id}", response_model=InvestorUpdateWithRecipients)
def get_investor_update(
    update_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific investor update with recipients."""
    update = db.query(InvestorUpdate).filter(
        InvestorUpdate.id == update_id,
        InvestorUpdate.organization_id == current_user.organization_id
    ).first()

    if not update:
        raise HTTPException(status_code=404, detail="Investor update not found")

    result = serialize_update(update)
    result["recipients"] = [{
        "id": r.id,
        "shareholder_id": r.shareholder_id,
        "email": r.email,
        "name": r.name,
        "status": r.status,
        "sent_at": r.sent_at,
        "opened_at": r.opened_at,
        "error_message": r.error_message,
    } for r in update.recipients]

    return result


@router.patch("/{update_id}", response_model=InvestorUpdateResponse)
def update_investor_update(
    update_id: int,
    data: InvestorUpdateUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an investor update draft."""
    update = db.query(InvestorUpdate).filter(
        InvestorUpdate.id == update_id,
        InvestorUpdate.organization_id == current_user.organization_id
    ).first()

    if not update:
        raise HTTPException(status_code=404, detail="Investor update not found")

    if update.status not in ['draft', 'scheduled']:
        raise HTTPException(
            status_code=400,
            detail="Cannot edit an update that has been sent"
        )

    update_data = data.model_dump(exclude_unset=True)

    # Handle JSON fields
    if 'highlights' in update_data:
        update_data['highlights'] = json.dumps(update_data['highlights']) if update_data['highlights'] else None
    if 'included_metrics' in update_data:
        update_data['included_metrics'] = json.dumps(update_data['included_metrics']) if update_data['included_metrics'] else None
    if 'recipient_types' in update_data:
        update_data['recipient_types'] = json.dumps(update_data['recipient_types']) if update_data['recipient_types'] else None
    if 'recipient_ids' in update_data:
        update_data['recipient_ids'] = json.dumps(update_data['recipient_ids']) if update_data['recipient_ids'] else None

    for key, value in update_data.items():
        setattr(update, key, value)

    db.commit()
    db.refresh(update)

    return serialize_update(update)


@router.delete("/{update_id}")
def delete_investor_update(
    update_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an investor update draft."""
    update = db.query(InvestorUpdate).filter(
        InvestorUpdate.id == update_id,
        InvestorUpdate.organization_id == current_user.organization_id
    ).first()

    if not update:
        raise HTTPException(status_code=404, detail="Investor update not found")

    if update.status == 'sent':
        raise HTTPException(
            status_code=400,
            detail="Cannot delete a sent update"
        )

    db.delete(update)
    db.commit()
    return {"status": "deleted"}


@router.post("/{update_id}/preview", response_model=InvestorUpdatePreview)
def preview_investor_update(
    update_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a preview of the investor update email."""
    update = db.query(InvestorUpdate).filter(
        InvestorUpdate.id == update_id,
        InvestorUpdate.organization_id == current_user.organization_id
    ).first()

    if not update:
        raise HTTPException(status_code=404, detail="Investor update not found")

    # Get organization name
    org = db.query(Organization).get(current_user.organization_id)
    org_name = org.name if org else "Your Company"

    # Get metrics
    metrics = get_latest_metrics(db, current_user.organization_id)

    # Generate HTML
    html = generate_email_html(update, metrics, org_name)

    # Get recipients
    recipient_types = json.loads(update.recipient_types) if update.recipient_types else None
    recipient_ids = json.loads(update.recipient_ids) if update.recipient_ids else None
    recipients = get_recipients_for_update(
        db, current_user.organization_id,
        recipient_types, recipient_ids
    )

    return InvestorUpdatePreview(
        subject=update.subject_line or f"{update.title} - Investor Update",
        html_content=html,
        recipient_count=len(recipients),
        recipients=[{
            "name": r.name,
            "email": r.email,
            "type": r.shareholder_type
        } for r in recipients]
    )


@router.post("/{update_id}/send")
def send_investor_update(
    update_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send an investor update immediately."""
    update = db.query(InvestorUpdate).filter(
        InvestorUpdate.id == update_id,
        InvestorUpdate.organization_id == current_user.organization_id
    ).first()

    if not update:
        raise HTTPException(status_code=404, detail="Investor update not found")

    if update.status == 'sent':
        raise HTTPException(status_code=400, detail="Update already sent")

    if update.status == 'sending':
        raise HTTPException(status_code=400, detail="Update is currently being sent")

    # Get organization
    org = db.query(Organization).get(current_user.organization_id)
    org_name = org.name if org else "Your Company"

    # Get metrics
    metrics = get_latest_metrics(db, current_user.organization_id)

    # Get recipients
    recipient_types = json.loads(update.recipient_types) if update.recipient_types else None
    recipient_ids = json.loads(update.recipient_ids) if update.recipient_ids else None
    recipients = get_recipients_for_update(
        db, current_user.organization_id,
        recipient_types, recipient_ids
    )

    if not recipients:
        raise HTTPException(
            status_code=400,
            detail="No recipients match the specified criteria"
        )

    # Create recipient records
    for shareholder in recipients:
        recipient = InvestorUpdateRecipient(
            investor_update_id=update.id,
            shareholder_id=shareholder.id,
            email=shareholder.email,
            name=shareholder.name,
            status="pending"
        )
        db.add(recipient)

    # Update status
    update.status = "sending"
    update.recipient_count = len(recipients)
    db.commit()

    # Generate email HTML
    html = generate_email_html(update, metrics, org_name)
    subject = update.subject_line or f"{update.title} - Investor Update"

    # Send emails (in background for better UX)
    def send_emails():
        nonlocal update
        sent = 0
        failed = 0

        # Refresh session for background task
        db_session = next(get_db())
        try:
            update = db_session.query(InvestorUpdate).get(update_id)

            for recipient in update.recipients:
                success = send_email(recipient.email, subject, html)

                if success:
                    recipient.status = "sent"
                    recipient.sent_at = datetime.now(UTC)
                    sent += 1
                else:
                    recipient.status = "failed"
                    recipient.error_message = "Failed to send"
                    failed += 1

            update.status = "sent"
            update.sent_at = datetime.now(UTC)
            update.sent_count = sent
            update.failed_count = failed
            db_session.commit()
        except Exception as e:
            logger.error(f"Error sending investor update: {e}")
            update.status = "failed"
            db_session.commit()
        finally:
            db_session.close()

    background_tasks.add_task(send_emails)

    return {
        "status": "sending",
        "recipient_count": len(recipients),
        "message": f"Sending to {len(recipients)} recipients"
    }


@router.post("/{update_id}/schedule")
def schedule_investor_update(
    update_id: int,
    scheduled_at: datetime,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Schedule an investor update for later."""
    update = db.query(InvestorUpdate).filter(
        InvestorUpdate.id == update_id,
        InvestorUpdate.organization_id == current_user.organization_id
    ).first()

    if not update:
        raise HTTPException(status_code=404, detail="Investor update not found")

    if update.status == 'sent':
        raise HTTPException(status_code=400, detail="Update already sent")

    if scheduled_at <= datetime.now(UTC):
        raise HTTPException(status_code=400, detail="Scheduled time must be in the future")

    update.status = "scheduled"
    update.scheduled_at = scheduled_at
    db.commit()

    return {
        "status": "scheduled",
        "scheduled_at": scheduled_at.isoformat()
    }


@router.get("/{update_id}/stats")
def get_update_stats(
    update_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get delivery statistics for an investor update."""
    update = db.query(InvestorUpdate).filter(
        InvestorUpdate.id == update_id,
        InvestorUpdate.organization_id == current_user.organization_id
    ).first()

    if not update:
        raise HTTPException(status_code=404, detail="Investor update not found")

    # Get recipient breakdown by status
    status_counts = db.query(
        InvestorUpdateRecipient.status,
        func.count(InvestorUpdateRecipient.id)
    ).filter(
        InvestorUpdateRecipient.investor_update_id == update_id
    ).group_by(InvestorUpdateRecipient.status).all()

    status_breakdown = {status: count for status, count in status_counts}

    return {
        "update_id": update.id,
        "title": update.title,
        "status": update.status,
        "sent_at": update.sent_at,
        "recipient_count": update.recipient_count,
        "sent_count": update.sent_count,
        "failed_count": update.failed_count,
        "opened_count": update.opened_count,
        "open_rate": (update.opened_count / update.sent_count * 100) if update.sent_count > 0 else 0,
        "status_breakdown": status_breakdown
    }
