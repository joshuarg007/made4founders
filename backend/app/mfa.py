"""
MFA (Multi-Factor Authentication) module.
Implements TOTP-based two-factor authentication.
"""
import pyotp
import qrcode
import io
import base64
import secrets
import json
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from .database import get_db
from .models import User
from .security import verify_password, get_password_hash
from .auth import get_current_user

router = APIRouter()

APP_NAME = "Made4Founders"


class MFASetupResponse(BaseModel):
    secret: str
    qr_code: str  # Base64 encoded QR code image
    backup_codes: List[str]


class MFAVerifyRequest(BaseModel):
    code: str


class MFADisableRequest(BaseModel):
    password: str
    code: str


def generate_totp_secret() -> str:
    """Generate a new TOTP secret."""
    return pyotp.random_base32()


def generate_backup_codes(count: int = 8) -> List[str]:
    """Generate backup codes for MFA recovery."""
    return [secrets.token_hex(4).upper() for _ in range(count)]


def verify_totp(secret: str, code: str) -> bool:
    """Verify a TOTP code."""
    totp = pyotp.TOTP(secret)
    # Allow 1 window before/after for clock drift
    return totp.verify(code, valid_window=1)


def generate_qr_code(secret: str, email: str) -> str:
    """Generate a QR code for authenticator app setup."""
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(name=email, issuer_name=APP_NAME)

    # Generate QR code
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)

    return base64.b64encode(buffer.getvalue()).decode()


@router.get("/status")
async def mfa_status(
    current_user: User = Depends(get_current_user),
):
    """Check if MFA is enabled for the current user."""
    return {
        "mfa_enabled": current_user.mfa_enabled,
    }


@router.post("/setup", response_model=MFASetupResponse)
async def mfa_setup(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Initialize MFA setup. Returns a QR code and backup codes.
    The user must verify with a code before MFA is activated.
    """
    if current_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is already enabled")

    # Generate new secret
    secret = generate_totp_secret()

    # Generate backup codes
    backup_codes = generate_backup_codes()

    # Store secret temporarily (not enabled yet)
    current_user.mfa_secret = secret
    # Store hashed backup codes
    current_user.mfa_backup_codes = json.dumps([get_password_hash(code) for code in backup_codes])
    db.commit()

    # Generate QR code
    qr_code = generate_qr_code(secret, current_user.email)

    return MFASetupResponse(
        secret=secret,
        qr_code=qr_code,
        backup_codes=backup_codes,
    )


@router.post("/verify")
async def mfa_verify_setup(
    request: MFAVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Verify MFA setup with a code from the authenticator app.
    This enables MFA for the user's account.
    """
    if current_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is already enabled")

    if not current_user.mfa_secret:
        raise HTTPException(status_code=400, detail="MFA setup not initiated. Call /setup first.")

    # Verify the code
    if not verify_totp(current_user.mfa_secret, request.code):
        raise HTTPException(status_code=400, detail="Invalid verification code")

    # Enable MFA
    current_user.mfa_enabled = True
    db.commit()

    return {"message": "MFA enabled successfully"}


@router.post("/disable")
async def mfa_disable(
    request: MFADisableRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Disable MFA for the user's account.
    Requires password and current MFA code for security.
    """
    if not current_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is not enabled")

    # Verify password
    if not current_user.hashed_password or not verify_password(request.password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid password")

    # Verify MFA code
    if not verify_totp(current_user.mfa_secret, request.code):
        raise HTTPException(status_code=400, detail="Invalid MFA code")

    # Disable MFA
    current_user.mfa_enabled = False
    current_user.mfa_secret = None
    current_user.mfa_backup_codes = None
    db.commit()

    return {"message": "MFA disabled successfully"}


@router.post("/regenerate-backup-codes")
async def regenerate_backup_codes(
    request: MFAVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Regenerate backup codes. Requires current MFA code.
    """
    if not current_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is not enabled")

    # Verify MFA code
    if not verify_totp(current_user.mfa_secret, request.code):
        raise HTTPException(status_code=400, detail="Invalid MFA code")

    # Generate new backup codes
    backup_codes = generate_backup_codes()
    current_user.mfa_backup_codes = json.dumps([get_password_hash(code) for code in backup_codes])
    db.commit()

    return {"backup_codes": backup_codes}


def verify_mfa_code_or_backup(user: User, code: str, db: Session) -> bool:
    """
    Verify MFA code or backup code.
    If backup code is used, it's consumed (removed from the list).
    """
    # First try TOTP
    if verify_totp(user.mfa_secret, code):
        return True

    # Try backup codes
    if user.mfa_backup_codes:
        backup_codes = json.loads(user.mfa_backup_codes)
        for i, hashed_code in enumerate(backup_codes):
            if verify_password(code.upper().replace("-", ""), hashed_code):
                # Remove used backup code
                backup_codes.pop(i)
                user.mfa_backup_codes = json.dumps(backup_codes)
                db.commit()
                return True

    return False
