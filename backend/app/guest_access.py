"""
Guest Access API - External users with limited access.

Manages guest users (investors, advisors, lawyers, etc.) who need
limited access to specific parts of the platform.

Authentication:
- Guests receive a magic link via email
- Token-based authentication separate from main user JWT
- Tokens expire after 7 days by default

Permissions:
- Stored as JSON: {"data_room": ["view"], "investor_updates": ["view"], "cap_table": ["view"]}
- Each resource can have multiple permission levels: view, download, comment
"""

import secrets
import os
from typing import Optional, List
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .database import get_db
from .models import User, GuestUser, GuestType, Shareholder, Activity, ActivityType
from .schemas import (
    GuestUserCreate, GuestUserUpdate, GuestUserResponse,
    GuestLoginRequest, GuestLoginResponse
)
from .auth import get_current_user
from .activity import record_activity

router = APIRouter(prefix="/api/guests", tags=["Guest Access"])
public_router = APIRouter(prefix="/api/guest-access", tags=["Guest Access (Public)"])

# Configuration
GUEST_TOKEN_EXPIRY_DAYS = int(os.getenv("GUEST_TOKEN_EXPIRY_DAYS", "7"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://made4founders.com")


# ============ Helper Functions ============

def generate_guest_token() -> str:
    """Generate a secure random token for guest access."""
    return secrets.token_urlsafe(48)  # 64 characters


def get_guest_by_token(token: str, db: Session) -> Optional[GuestUser]:
    """Get a guest user by their access token."""
    guest = db.query(GuestUser).filter(
        GuestUser.access_token == token,
        GuestUser.is_active == True
    ).first()

    if guest and guest.token_expires_at:
        if guest.token_expires_at < datetime.utcnow():
            return None  # Token expired

    return guest


def guest_to_response(guest: GuestUser, include_invite_url: bool = False) -> GuestUserResponse:
    """Convert GuestUser model to GuestUserResponse."""
    shareholder_name = None
    if guest.shareholder:
        shareholder_name = guest.shareholder.name

    invite_url = None
    if include_invite_url:
        invite_url = f"{FRONTEND_URL}/guest?token={guest.access_token}"

    return GuestUserResponse(
        id=guest.id,
        email=guest.email,
        name=guest.name,
        guest_type=guest.guest_type,
        shareholder_id=guest.shareholder_id,
        shareholder_name=shareholder_name,
        permissions=guest.permissions,
        is_active=guest.is_active,
        last_accessed_at=guest.last_accessed_at,
        invited_at=guest.invited_at,
        invite_url=invite_url
    )


async def send_guest_invite_email(guest: GuestUser, organization_name: str):
    """Send invitation email to guest user."""
    from .email_service import _send_email

    invite_url = f"{FRONTEND_URL}/guest?token={guest.access_token}"
    guest_type_display = guest.guest_type.replace("_", " ").title()

    subject = f"You've been invited to {organization_name}'s Data Room"

    html_content = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0ea5e9;">You've been invited to access {organization_name}</h2>

        <p style="color: #334155; font-size: 16px;">
            Hello{' ' + guest.name if guest.name else ''},
        </p>

        <p style="color: #334155; font-size: 16px;">
            You've been invited as a <strong>{guest_type_display}</strong> to access
            {organization_name}'s secure portal on Made4Founders.
        </p>

        <div style="text-align: center; margin: 32px 0;">
            <a href="{invite_url}"
               style="display: inline-block; background: linear-gradient(135deg, #0ea5e9, #8b5cf6);
                      color: white; padding: 14px 32px; text-decoration: none;
                      border-radius: 8px; font-weight: 600; font-size: 16px;">
                Access Portal
            </a>
        </div>

        <p style="color: #64748b; font-size: 14px;">
            This link will expire in {GUEST_TOKEN_EXPIRY_DAYS} days.
            If you need a new link, please contact the company.
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">

        <p style="color: #94a3b8; font-size: 12px;">
            This email was sent by Made4Founders on behalf of {organization_name}.
            If you weren't expecting this, you can safely ignore it.
        </p>
    </div>
    """

    try:
        await _send_email(guest.email, subject, html_content)
    except Exception as e:
        # Log error but don't fail the invite
        import logging
        logging.getLogger(__name__).error(f"Failed to send guest invite email: {e}")


# ============ Admin Endpoints (Require Auth) ============

@router.get("", response_model=List[GuestUserResponse])
async def list_guest_users(
    guest_type: Optional[str] = Query(None, description="Filter by guest type"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all guest users for the organization.

    Only admins and editors can view guest users.
    """
    if current_user.role not in ["admin", "editor"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    org_id = current_user.organization_id

    query = db.query(GuestUser).filter(
        GuestUser.organization_id == org_id
    )

    if guest_type:
        query = query.filter(GuestUser.guest_type == guest_type)

    if is_active is not None:
        query = query.filter(GuestUser.is_active == is_active)

    guests = query.order_by(GuestUser.invited_at.desc()).all()

    return [guest_to_response(g, include_invite_url=True) for g in guests]


@router.post("/invite", response_model=GuestUserResponse)
async def invite_guest_user(
    data: GuestUserCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Invite a new guest user.

    Generates a magic link and sends an invitation email.
    Only admins and editors can invite guests.
    """
    if current_user.role not in ["admin", "editor"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    org_id = current_user.organization_id

    # Check if guest already exists
    existing = db.query(GuestUser).filter(
        GuestUser.organization_id == org_id,
        GuestUser.email == data.email.lower()
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="A guest with this email already exists"
        )

    # Validate guest type
    valid_types = [t.value for t in GuestType]
    if data.guest_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid guest_type. Must be one of: {', '.join(valid_types)}"
        )

    # Validate shareholder if provided
    if data.shareholder_id:
        shareholder = db.query(Shareholder).filter(
            Shareholder.id == data.shareholder_id,
            Shareholder.organization_id == org_id
        ).first()
        if not shareholder:
            raise HTTPException(status_code=404, detail="Shareholder not found")

    # Create guest user
    guest = GuestUser(
        organization_id=org_id,
        email=data.email.lower(),
        name=data.name,
        guest_type=data.guest_type,
        shareholder_id=data.shareholder_id,
        access_token=generate_guest_token(),
        token_expires_at=datetime.utcnow() + timedelta(days=GUEST_TOKEN_EXPIRY_DAYS),
        permissions=data.permissions or {"data_room": ["view"]},
        invited_by_id=current_user.id
    )
    db.add(guest)

    # Record activity
    record_activity(
        db=db,
        organization_id=org_id,
        user_id=current_user.id,
        activity_type=ActivityType.GUEST_INVITED.value,
        description=f"{current_user.name or current_user.email} invited {data.email} as a {data.guest_type}",
        extra_data={"guest_email": data.email, "guest_type": data.guest_type}
    )

    db.commit()
    db.refresh(guest)

    # Send invitation email
    org = current_user.organization
    await send_guest_invite_email(guest, org.name)

    return guest_to_response(guest, include_invite_url=True)


@router.get("/{guest_id}", response_model=GuestUserResponse)
async def get_guest_user(
    guest_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get details of a specific guest user."""
    if current_user.role not in ["admin", "editor"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    guest = db.query(GuestUser).filter(
        GuestUser.id == guest_id,
        GuestUser.organization_id == current_user.organization_id
    ).first()

    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    return guest_to_response(guest, include_invite_url=True)


@router.patch("/{guest_id}", response_model=GuestUserResponse)
async def update_guest_user(
    guest_id: int,
    data: GuestUserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update a guest user's details or permissions.

    Only admins and editors can update guests.
    """
    if current_user.role not in ["admin", "editor"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    guest = db.query(GuestUser).filter(
        GuestUser.id == guest_id,
        GuestUser.organization_id == current_user.organization_id
    ).first()

    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    # Update fields
    if data.name is not None:
        guest.name = data.name
    if data.guest_type is not None:
        valid_types = [t.value for t in GuestType]
        if data.guest_type not in valid_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid guest_type. Must be one of: {', '.join(valid_types)}"
            )
        guest.guest_type = data.guest_type
    if data.permissions is not None:
        guest.permissions = data.permissions
    if data.is_active is not None:
        guest.is_active = data.is_active

    guest.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(guest)

    return guest_to_response(guest, include_invite_url=True)


@router.delete("/{guest_id}")
async def revoke_guest_access(
    guest_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Revoke a guest user's access.

    This deactivates the guest (soft delete) so they can no longer access the platform.
    """
    if current_user.role not in ["admin", "editor"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    guest = db.query(GuestUser).filter(
        GuestUser.id == guest_id,
        GuestUser.organization_id == current_user.organization_id
    ).first()

    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    guest.is_active = False
    guest.updated_at = datetime.utcnow()
    db.commit()

    return {"ok": True}


@router.post("/{guest_id}/resend-invite")
async def resend_guest_invite(
    guest_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Resend the invitation email with a fresh token.

    Generates a new token and sends a new invitation email.
    """
    if current_user.role not in ["admin", "editor"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    guest = db.query(GuestUser).filter(
        GuestUser.id == guest_id,
        GuestUser.organization_id == current_user.organization_id
    ).first()

    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    # Generate new token
    guest.access_token = generate_guest_token()
    guest.token_expires_at = datetime.utcnow() + timedelta(days=GUEST_TOKEN_EXPIRY_DAYS)
    guest.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(guest)

    # Send new invitation email
    org = current_user.organization
    await send_guest_invite_email(guest, org.name)

    return {
        "ok": True,
        "expires_at": guest.token_expires_at.isoformat()
    }


@router.get("/types/list")
async def list_guest_types(
    current_user: User = Depends(get_current_user)
):
    """Get list of available guest types."""
    return {
        "types": [
            {"value": t.value, "label": t.value.replace("_", " ").title()}
            for t in GuestType
        ]
    }


# ============ Public Endpoints (No Auth) ============

@public_router.get("/validate")
async def validate_guest_token(
    token: str = Query(..., description="Guest access token"),
    db: Session = Depends(get_db)
):
    """
    Validate a guest access token.

    Returns guest info if valid, error if invalid or expired.
    """
    guest = get_guest_by_token(token, db)

    if not guest:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    org = guest.organization

    return {
        "valid": True,
        "guest": {
            "id": guest.id,
            "email": guest.email,
            "name": guest.name,
            "guest_type": guest.guest_type
        },
        "organization_name": org.name if org else None,
        "permissions": guest.permissions
    }


@public_router.post("/login", response_model=GuestLoginResponse)
async def guest_login(
    data: GuestLoginRequest,
    db: Session = Depends(get_db)
):
    """
    Guest login via magic link token.

    Updates last_accessed_at and returns a session token.
    """
    guest = get_guest_by_token(data.token, db)

    if not guest:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    # Update last accessed
    guest.last_accessed_at = datetime.utcnow()
    db.commit()
    db.refresh(guest)

    # For now, we use the same access_token as the session token
    # In a production system, you might want to generate a separate JWT
    return GuestLoginResponse(
        access_token=guest.access_token,
        token_type="bearer",
        guest=guest_to_response(guest)
    )
