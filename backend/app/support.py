"""
Customer support endpoints.

Handles:
- Contact form submissions
- Support ticket creation (future)
"""
import os
import logging
from datetime import datetime, UTC, UTC
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from .database import get_db
from .auth import get_current_user_optional
from .models import User

logger = logging.getLogger(__name__)

router = APIRouter()

SUPPORT_EMAIL = os.getenv("EMAIL_SUPPORT", "support@made4founders.com")


class ContactRequest(BaseModel):
    """Contact form request."""
    subject: str
    message: str
    email: Optional[str] = None
    name: Optional[str] = None


class ContactResponse(BaseModel):
    """Contact form response."""
    success: bool
    message: str
    ticket_id: Optional[str] = None


@router.post("/contact", response_model=ContactResponse)
async def submit_contact_form(
    request: ContactRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Submit a contact/support form.
    Sends an email to the support team.
    """
    # Get user info if authenticated
    user_email = request.email or (current_user.email if current_user else "anonymous")
    user_name = request.name or (current_user.name if current_user else "Anonymous User")

    # Generate ticket ID
    ticket_id = f"TKT-{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}"

    # Try to send email
    try:
        from .email_service import send_email

        # Send to support team
        support_html = f"""
        <h2>New Support Request</h2>
        <p><strong>Ticket ID:</strong> {ticket_id}</p>
        <p><strong>From:</strong> {user_name} ({user_email})</p>
        <p><strong>Subject:</strong> {request.subject}</p>
        <hr>
        <h3>Message:</h3>
        <p>{request.message.replace(chr(10), '<br>')}</p>
        <hr>
        <p><small>Submitted at {datetime.now(UTC).isoformat()} UTC</small></p>
        """

        await send_email(
            to_email=SUPPORT_EMAIL,
            subject=f"[{ticket_id}] {request.subject}",
            html_content=support_html
        )

        # Send confirmation to user
        if user_email and user_email != "anonymous":
            confirm_html = f"""
            <h2>We received your message!</h2>
            <p>Hi {user_name},</p>
            <p>Thank you for contacting Made4Founders support. We've received your message and will get back to you within 24 hours.</p>
            <p><strong>Your Ticket ID:</strong> {ticket_id}</p>
            <p><strong>Subject:</strong> {request.subject}</p>
            <hr>
            <p><strong>Your Message:</strong></p>
            <p>{request.message.replace(chr(10), '<br>')}</p>
            <hr>
            <p>Best regards,<br>Made4Founders Support Team</p>
            """

            await send_email(
                to_email=user_email,
                subject=f"[{ticket_id}] We received your support request",
                html_content=confirm_html
            )

        logger.info(f"Support ticket {ticket_id} created by {user_email}")

        return ContactResponse(
            success=True,
            message="Your message has been sent. We'll get back to you within 24 hours.",
            ticket_id=ticket_id
        )

    except Exception as e:
        logger.error(f"Failed to process support request: {e}")
        # Even if email fails, acknowledge the request
        return ContactResponse(
            success=True,
            message="Your message has been received. If you don't hear from us, please email support@made4founders.com directly.",
            ticket_id=ticket_id
        )


@router.get("/health")
async def support_health():
    """Health check for support service."""
    return {
        "status": "healthy",
        "support_email": SUPPORT_EMAIL,
    }
