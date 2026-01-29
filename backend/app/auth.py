from typing import Optional, List
from datetime import datetime, timedelta
import secrets

from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from pydantic import BaseModel

from .database import get_db
from .models import User, UserSession
from .schemas import (
    Token, UserCreate, UserResponse, UserMe, UserAdminCreate, UserAdminUpdate,
    VerifyEmailRequest, ResendVerificationRequest, ForgotPasswordRequest,
    ResetPasswordRequest, SessionResponse
)
from . import security
from .captcha import verify_captcha, get_captcha_config
from .email_service import send_verification_email, send_password_reset_email
from .session_manager import (
    create_session, is_token_revoked, get_user_sessions, get_session_by_id,
    revoke_session, revoke_all_sessions, parse_device_info
)

# Security constants
LOCKOUT_THRESHOLD = 5  # Failed attempts before lockout
LOCKOUT_DURATION_MINUTES = 15
VERIFICATION_TOKEN_EXPIRE_HOURS = 24
PASSWORD_RESET_TOKEN_EXPIRE_HOURS = 1

router = APIRouter()


class MFALoginRequest(BaseModel):
    mfa_token: str
    code: str


class LoginWithCaptchaRequest(BaseModel):
    username: str
    password: str
    captcha_token: Optional[str] = None

# Bearer fallback
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/token", auto_error=False)


def authenticate_user(db: Session, email: str, password: str) -> tuple[Optional[User], Optional[str]]:
    """
    Authenticate user with lockout and email verification checks.

    Returns:
        (user, error_code) - user if successful, error_code if failed:
        - "invalid_credentials": Wrong email/password
        - "account_locked": Too many failed attempts
        - "email_not_verified": Email not verified yet
    """
    user = db.query(User).filter(User.email == email).first()

    if not user:
        return None, "invalid_credentials"

    # Check if account is locked
    if user.locked_until and user.locked_until > datetime.utcnow():
        return None, "account_locked"

    # Clear lockout if expired
    if user.locked_until and user.locked_until <= datetime.utcnow():
        user.locked_until = None
        user.failed_login_attempts = 0
        db.commit()

    # Verify password
    if not security.verify_password(password, user.hashed_password):
        # Increment failed attempts
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1

        # Lock account if threshold reached
        if user.failed_login_attempts >= LOCKOUT_THRESHOLD:
            user.locked_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_DURATION_MINUTES)

        db.commit()
        return None, "invalid_credentials"

    # Check email verification
    if not user.email_verified:
        return None, "email_not_verified"

    # Successful login - reset failed attempts
    if user.failed_login_attempts > 0:
        user.failed_login_attempts = 0
        user.locked_until = None
        db.commit()

    return user, None


def get_current_user(
    db: Session = Depends(get_db),
    bearer: Optional[str] = Depends(oauth2_scheme),
    access_cookie: Optional[str] = Cookie(None, alias="access_token"),
) -> User:
    token = access_cookie or bearer or ""
    if hasattr(token, "value"):
        token = token.value
    if not isinstance(token, str):
        token = str(token)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Decode full token to get jti for revocation check
    payload = security.decode_token_full(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    email = payload.get("sub")
    token_id = payload.get("jti")

    # Check if token has been revoked
    if token_id and is_token_revoked(db, token_id):
        raise HTTPException(status_code=401, detail="Token has been revoked")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is inactive")

    # Store token_id on user object for session management
    user._current_token_id = token_id
    return user


def get_current_user_optional(
    db: Session = Depends(get_db),
    bearer: Optional[str] = Depends(oauth2_scheme),
    access_cookie: Optional[str] = Cookie(None, alias="access_token"),
) -> Optional[User]:
    """Same as get_current_user but returns None instead of raising."""
    token = access_cookie or bearer or ""
    if hasattr(token, "value"):
        token = token.value
    if not isinstance(token, str):
        token = str(token)
    if not token:
        return None

    payload = security.decode_token_full(token)
    if not payload:
        return None

    email = payload.get("sub")
    token_id = payload.get("jti")

    # Check if token has been revoked
    if token_id and is_token_revoked(db, token_id):
        return None

    user = db.query(User).filter(User.email == email).first()
    if not user or not user.is_active:
        return None

    # Store token_id on user object for session management
    user._current_token_id = token_id
    return user


@router.get("/captcha-config")
def captcha_config():
    """Get captcha configuration for the frontend."""
    return get_captcha_config()


@router.post("/token")
async def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user, error_code = authenticate_user(db, form_data.username, form_data.password)

    if error_code == "account_locked":
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Account temporarily locked due to too many failed attempts. Try again later."
        )
    if error_code == "email_not_verified":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="email_not_verified"
        )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    # Check if MFA is enabled
    if user.mfa_enabled and user.mfa_secret:
        mfa_token = jwt.encode(
            {
                "sub": user.email,
                "typ": "mfa",
                "exp": datetime.utcnow() + timedelta(minutes=5),
            },
            security.SECRET_KEY,
            algorithm=security.ALGORITHM,
        )
        return {
            "mfa_required": True,
            "mfa_token": mfa_token,
            "message": "MFA verification required"
        }

    # Check if MFA setup is required (user doesn't have MFA enabled)
    # For now, MFA is mandatory for all users
    if not user.mfa_enabled:
        setup_token = jwt.encode(
            {
                "sub": user.email,
                "typ": "mfa_setup",
                "exp": datetime.utcnow() + timedelta(minutes=30),
            },
            security.SECRET_KEY,
            algorithm=security.ALGORITHM,
        )
        # Set temporary auth cookies for the setup flow
        access = security.create_access_token(user.email)
        refresh = security.create_refresh_token(user.email)
        security.set_auth_cookies(response, access, refresh)

        # Create session record for setup flow
        payload = security.decode_token_full(access)
        if payload:
            device_info = parse_device_info(request.headers.get("user-agent", ""))
            ip_address = request.client.host if request.client else None
            create_session(
                db=db,
                user=user,
                token_id=payload.get("jti"),
                device_info=device_info,
                ip_address=ip_address,
                expires_at=datetime.utcfromtimestamp(payload.get("exp"))
            )

        return {
            "mfa_setup_required": True,
            "setup_token": setup_token,
            "message": "MFA setup required"
        }

    access = security.create_access_token(user.email)
    refresh = security.create_refresh_token(user.email)
    security.set_auth_cookies(response, access, refresh)

    # Create session record
    payload = security.decode_token_full(access)
    if payload:
        device_info = parse_device_info(request.headers.get("user-agent", ""))
        ip_address = request.client.host if request.client else None
        create_session(
            db=db,
            user=user,
            token_id=payload.get("jti"),
            device_info=device_info,
            ip_address=ip_address,
            expires_at=datetime.utcfromtimestamp(payload.get("exp"))
        )

    return {"access_token": access, "token_type": "bearer"}


@router.post("/login")
async def login_with_captcha(
    http_request: Request,
    response: Response,
    request: LoginWithCaptchaRequest,
    db: Session = Depends(get_db),
):
    """Login endpoint with captcha support."""
    # Verify captcha if enabled
    if not await verify_captcha(request.captcha_token or ""):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Captcha verification failed"
        )

    user, error_code = authenticate_user(db, request.username, request.password)

    if error_code == "account_locked":
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Account temporarily locked due to too many failed attempts. Try again later."
        )
    if error_code == "email_not_verified":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="email_not_verified"
        )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    # Check if MFA is enabled
    if user.mfa_enabled and user.mfa_secret:
        mfa_token = jwt.encode(
            {
                "sub": user.email,
                "typ": "mfa",
                "exp": datetime.utcnow() + timedelta(minutes=5),
            },
            security.SECRET_KEY,
            algorithm=security.ALGORITHM,
        )
        return {
            "mfa_required": True,
            "mfa_token": mfa_token,
            "message": "MFA verification required"
        }

    # Check if MFA setup is required (user doesn't have MFA enabled)
    # For now, MFA is mandatory for all users
    if not user.mfa_enabled:
        setup_token = jwt.encode(
            {
                "sub": user.email,
                "typ": "mfa_setup",
                "exp": datetime.utcnow() + timedelta(minutes=30),
            },
            security.SECRET_KEY,
            algorithm=security.ALGORITHM,
        )
        # Set temporary auth cookies for the setup flow
        access = security.create_access_token(user.email)
        refresh = security.create_refresh_token(user.email)
        security.set_auth_cookies(response, access, refresh)

        # Create session record for setup flow
        payload = security.decode_token_full(access)
        if payload:
            device_info = parse_device_info(http_request.headers.get("user-agent", ""))
            ip_address = http_request.client.host if http_request.client else None
            create_session(
                db=db,
                user=user,
                token_id=payload.get("jti"),
                device_info=device_info,
                ip_address=ip_address,
                expires_at=datetime.utcfromtimestamp(payload.get("exp"))
            )

        return {
            "mfa_setup_required": True,
            "setup_token": setup_token,
            "message": "MFA setup required"
        }

    access = security.create_access_token(user.email)
    refresh = security.create_refresh_token(user.email)
    security.set_auth_cookies(response, access, refresh)

    # Create session record
    payload = security.decode_token_full(access)
    if payload:
        device_info = parse_device_info(http_request.headers.get("user-agent", ""))
        ip_address = http_request.client.host if http_request.client else None
        create_session(
            db=db,
            user=user,
            token_id=payload.get("jti"),
            device_info=device_info,
            ip_address=ip_address,
            expires_at=datetime.utcfromtimestamp(payload.get("exp"))
        )

    return {"access_token": access, "token_type": "bearer"}


@router.post("/token/mfa")
def login_with_mfa(
    http_request: Request,
    response: Response,
    request: MFALoginRequest,
    db: Session = Depends(get_db),
):
    """Complete login with MFA verification."""
    # Import here to avoid circular import with mfa.py
    from .mfa import verify_mfa_code_or_backup

    # Verify the MFA token
    try:
        payload = jwt.decode(
            request.mfa_token,
            security.SECRET_KEY,
            algorithms=[security.ALGORITHM]
        )
        if payload.get("typ") != "mfa":
            raise HTTPException(status_code=401, detail="Invalid MFA token")
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid MFA token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired MFA token")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Verify MFA code (TOTP or backup code)
    if not verify_mfa_code_or_backup(user, request.code, db):
        raise HTTPException(status_code=401, detail="Invalid MFA code")

    # MFA verified - issue tokens
    access = security.create_access_token(user.email)
    refresh = security.create_refresh_token(user.email)
    security.set_auth_cookies(response, access, refresh)

    # Create session record
    access_payload = security.decode_token_full(access)
    if access_payload:
        device_info = parse_device_info(http_request.headers.get("user-agent", ""))
        ip_address = http_request.client.host if http_request.client else None
        create_session(
            db=db,
            user=user,
            token_id=access_payload.get("jti"),
            device_info=device_info,
            ip_address=ip_address,
            expires_at=datetime.utcfromtimestamp(access_payload.get("exp"))
        )

    return {"access_token": access, "token_type": "bearer"}


@router.post("/token/refresh", response_model=Token)
def refresh_token(
    response: Response,
    db: Session = Depends(get_db),
    refresh_cookie: Optional[str] = Cookie(default=None, alias="refresh_token"),
):
    if not refresh_cookie:
        raise HTTPException(status_code=401, detail="Missing refresh token")
    try:
        payload = jwt.decode(
            refresh_cookie,
            security.SECRET_KEY,
            algorithms=[security.ALGORITHM]
        )
        if payload.get("typ") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        email: str = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    new_access = security.create_access_token(email)
    security.set_auth_cookies(response, new_access, refresh_cookie)
    return {"access_token": new_access, "token_type": "bearer"}


@router.post("/logout")
def logout(
    response: Response,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Logout and revoke current session."""
    # Revoke current session if user is authenticated
    if current_user:
        current_token_id = getattr(current_user, '_current_token_id', None)
        if current_token_id:
            session = db.query(UserSession).filter(
                UserSession.token_id == current_token_id,
                UserSession.user_id == current_user.id,
                UserSession.is_revoked == False
            ).first()
            if session:
                revoke_session(db, session, reason="logout")

    security.clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me", response_model=UserMe)
def me(current_user: User = Depends(get_current_user)):
    return {
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role or "viewer",
        "has_completed_onboarding": current_user.has_completed_onboarding or False,
    }


@router.post("/me/complete-onboarding")
def complete_onboarding(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark user's onboarding as complete"""
    current_user.has_completed_onboarding = True
    db.commit()
    return {"ok": True}


@router.post("/register", response_model=UserResponse)
async def register(
    user_data: UserCreate,
    response: Response,
    db: Session = Depends(get_db),
):
    # Check if user exists
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    # Check if this is the first user - make them admin
    user_count = db.query(User).count()
    is_first_user = user_count == 0

    # Generate email verification token
    verification_token = secrets.token_urlsafe(32)
    verification_expires = datetime.utcnow() + timedelta(hours=VERIFICATION_TOKEN_EXPIRE_HOURS)

    # Create user with verification token (not verified yet)
    hashed_password = security.get_password_hash(user_data.password)
    user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        name=user_data.name,
        role="admin" if is_first_user else "viewer",
        email_verified=False,
        email_verification_token=verification_token,
        email_verification_token_expires=verification_expires,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Send verification email (don't block on failure)
    await send_verification_email(user.email, verification_token, user.name)

    # No auto-login - user must verify email first
    return user


# ============ Email Verification ============

@router.post("/verify-email")
def verify_email(
    request: VerifyEmailRequest,
    db: Session = Depends(get_db),
):
    """Verify email address using token from email link."""
    user = db.query(User).filter(
        User.email_verification_token == request.token
    ).first()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid verification token")

    # Check if token has expired
    if user.email_verification_token_expires and user.email_verification_token_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Verification token has expired")

    # Mark email as verified
    user.email_verified = True
    user.email_verification_token = None
    user.email_verification_token_expires = None
    db.commit()

    return {"message": "Email verified successfully"}


@router.post("/resend-verification")
async def resend_verification(
    request: ResendVerificationRequest,
    db: Session = Depends(get_db),
):
    """Resend verification email."""
    # Generic response to prevent email enumeration
    generic_response = {"message": "If an account exists with this email, a verification link has been sent."}

    user = db.query(User).filter(User.email == request.email).first()
    if not user or user.email_verified:
        return generic_response

    # Generate new verification token
    verification_token = secrets.token_urlsafe(32)
    verification_expires = datetime.utcnow() + timedelta(hours=VERIFICATION_TOKEN_EXPIRE_HOURS)

    user.email_verification_token = verification_token
    user.email_verification_token_expires = verification_expires
    db.commit()

    await send_verification_email(user.email, verification_token, user.name)
    return generic_response


# ============ Password Reset ============

@router.post("/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """Request password reset email."""
    # Generic response to prevent email enumeration
    generic_response = {"message": "If an account exists with this email, a password reset link has been sent."}

    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        return generic_response

    # Generate password reset token
    reset_token = secrets.token_urlsafe(32)
    reset_expires = datetime.utcnow() + timedelta(hours=PASSWORD_RESET_TOKEN_EXPIRE_HOURS)

    user.password_reset_token = reset_token
    user.password_reset_token_expires = reset_expires
    db.commit()

    await send_password_reset_email(user.email, reset_token, user.name)
    return generic_response


@router.post("/reset-password")
def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    """Reset password using token from email link."""
    user = db.query(User).filter(
        User.password_reset_token == request.token
    ).first()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid reset token")

    # Check if token has expired
    if user.password_reset_token_expires and user.password_reset_token_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Reset token has expired")

    # Update password
    user.hashed_password = security.get_password_hash(request.new_password)
    user.password_reset_token = None
    user.password_reset_token_expires = None
    db.commit()

    # Revoke all existing sessions for security
    revoke_all_sessions(db, user.id, reason="password_reset")

    return {"message": "Password reset successfully"}


# ============ Session Management ============

@router.get("/sessions", response_model=List[SessionResponse])
def list_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all active sessions for the current user."""
    sessions = get_user_sessions(db, current_user.id)
    current_token_id = getattr(current_user, '_current_token_id', None)

    result = []
    for session in sessions:
        result.append(SessionResponse(
            id=session.id,
            device_info=session.device_info,
            ip_address=session.ip_address,
            created_at=session.created_at,
            last_used_at=session.last_used_at,
            is_current=(session.token_id == current_token_id) if current_token_id else False
        ))
    return result


@router.post("/sessions/{session_id}/revoke")
def revoke_single_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoke a specific session."""
    session = get_session_by_id(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Prevent revoking current session through this endpoint
    current_token_id = getattr(current_user, '_current_token_id', None)
    if current_token_id and session.token_id == current_token_id:
        raise HTTPException(status_code=400, detail="Cannot revoke current session. Use logout instead.")

    revoke_session(db, session, reason="manual_revoke")
    return {"message": "Session revoked successfully"}


@router.post("/sessions/revoke-all")
def revoke_all_other_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoke all sessions except the current one."""
    current_token_id = getattr(current_user, '_current_token_id', None)
    count = revoke_all_sessions(
        db,
        current_user.id,
        reason="revoke_all",
        exclude_token_id=current_token_id
    )
    return {"message": f"Revoked {count} session(s)", "count": count}


# ============ Admin-only User Management ============

def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Require admin role for user management."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )
    return current_user


@router.get("/users", response_model=List[UserResponse])
def list_users(
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """List all users (admin only)."""
    return db.query(User).order_by(User.created_at.desc()).all()


@router.post("/users", response_model=UserResponse)
def create_user(
    user_data: UserAdminCreate,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Create a new user (admin only)."""
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    if user_data.role not in ["admin", "editor", "viewer"]:
        raise HTTPException(status_code=400, detail="Invalid role")

    hashed_password = security.get_password_hash(user_data.password)
    user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        name=user_data.name,
        role=user_data.role,
        is_active=user_data.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Get a specific user (admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_data: UserAdminUpdate,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Update a user (admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = user_data.model_dump(exclude_unset=True)

    # Prevent removing the last admin
    if update_data.get("role") and update_data["role"] != "admin" and user.role == "admin":
        admin_count = db.query(User).filter(User.role == "admin", User.is_active == True).count()
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove the last admin")

    # Hash password if provided
    if "password" in update_data and update_data["password"]:
        update_data["hashed_password"] = security.get_password_hash(update_data.pop("password"))
    elif "password" in update_data:
        del update_data["password"]

    # Validate role
    if "role" in update_data and update_data["role"] not in ["admin", "editor", "viewer"]:
        raise HTTPException(status_code=400, detail="Invalid role")

    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Delete a user (admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent self-deletion
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    # Prevent deleting the last admin
    if user.role == "admin":
        admin_count = db.query(User).filter(User.role == "admin", User.is_active == True).count()
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last admin")

    db.delete(user)
    db.commit()
    return {"ok": True}


# ============ Password Verification ============

class VerifyPasswordRequest(BaseModel):
    password: str


@router.post("/verify-password")
def verify_password(
    request: VerifyPasswordRequest,
    current_user: User = Depends(get_current_user),
):
    """Verify the current user's password for sensitive operations."""
    if not security.verify_password(request.password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect password")
    return {"verified": True}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password")
def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change password for authenticated user."""
    # Verify current password
    if not security.verify_password(request.current_password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    # Validate new password
    if len(request.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    if request.current_password == request.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from current password")

    # Update password
    current_user.hashed_password = security.get_password_hash(request.new_password)
    db.commit()

    return {"message": "Password changed successfully"}
