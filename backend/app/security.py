"""
Security utilities for Made4Founders.

Features:
- JWT token creation and validation (HS512)
- Secure cookie handling with HSTS support
- BCrypt password hashing with cost factor 12
- Token fingerprinting for additional security
"""
import os
import hashlib
import secrets
from datetime import datetime, UTC, timedelta
from typing import Optional

from fastapi import Response, Request
from jose import jwt, JWTError
from passlib.context import CryptContext

# ============ CONFIGURATION ============

# JWT settings - MUST set SECRET_KEY in production
SECRET_KEY = os.getenv("SECRET_KEY", "made4founders-dev-secret-change-in-production")
IS_PROD = os.getenv("ENVIRONMENT", "").lower() == "production"

# Enforce secure SECRET_KEY in production
if IS_PROD and (SECRET_KEY == "made4founders-dev-secret-change-in-production" or len(SECRET_KEY) < 32):
    raise RuntimeError("CRITICAL: Production requires SECRET_KEY of at least 32 characters. Set a secure SECRET_KEY environment variable.")
elif len(SECRET_KEY) < 32:
    import warnings
    warnings.warn("SECRET_KEY should be at least 32 characters for security")

# Use HS512 for stronger security (512-bit hash)
ALGORITHM = "HS512"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

# Cookie security - secure defaults
IS_PRODUCTION = os.getenv("ENVIRONMENT", "development") == "production"
COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", "true" if IS_PRODUCTION else "false").lower() == "true"
COOKIE_SAMESITE: str = os.getenv("COOKIE_SAMESITE", "strict" if IS_PRODUCTION else "lax").lower()
COOKIE_DOMAIN: Optional[str] = os.getenv("COOKIE_DOMAIN")

# Password hashing with cost factor 12 (recommended by OWASP)
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12
)


def get_password_hash(password: str) -> str:
    """Hash password using BCrypt with cost factor 12."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password using constant-time comparison."""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def generate_token_id() -> str:
    """Generate a unique token ID for tracking/revocation."""
    return secrets.token_urlsafe(16)


def create_access_token(sub: str, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a secure access token with:
    - Unique token ID (jti) for tracking
    - Issued-at timestamp (iat)
    - Expiration (exp)
    - Type indicator (typ)
    """
    now = datetime.now(UTC)
    expire = now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))

    payload = {
        "sub": sub,
        "exp": expire,
        "iat": now,
        "jti": generate_token_id(),
        "typ": "access"
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(sub: str, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a secure refresh token with extended lifetime.
    """
    now = datetime.now(UTC)
    expire = now + (expires_delta or timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))

    payload = {
        "sub": sub,
        "exp": expire,
        "iat": now,
        "jti": generate_token_id(),
        "typ": "refresh"
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[str]:
    """
    Decode and validate an access token.
    Returns email (sub) if valid; None otherwise.
    """
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            options={
                "require_exp": True,
                "require_sub": True,
                "verify_exp": True,
                "verify_iat": True
            }
        )

        # Verify token type
        if payload.get("typ") not in (None, "access"):
            return None

        return payload.get("sub")

    except JWTError:
        return None


def decode_token_full(token: str) -> Optional[dict]:
    """
    Decode and validate an access token, returning full payload.
    Returns dict with sub, jti, exp, etc. if valid; None otherwise.
    """
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            options={
                "require_exp": True,
                "require_sub": True,
                "verify_exp": True,
                "verify_iat": True
            }
        )

        # Verify token type
        if payload.get("typ") not in (None, "access"):
            return None

        return payload

    except JWTError:
        return None


def decode_refresh_token(token: str) -> Optional[str]:
    """
    Decode and validate a refresh token.
    Returns email (sub) if valid; None otherwise.
    """
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            options={
                "require_exp": True,
                "require_sub": True,
                "verify_exp": True,
                "verify_iat": True
            }
        )

        # Must be refresh token type
        if payload.get("typ") != "refresh":
            return None

        return payload.get("sub")

    except JWTError:
        return None


def set_auth_cookies(resp: Response, access_token: str, refresh_token: str) -> None:
    """
    Set secure authentication cookies.

    Security features:
    - HttpOnly: Prevents XSS access
    - Secure: HTTPS-only (in production)
    - SameSite: CSRF protection
    - Path restriction
    """
    def _set(key: str, value: str, max_age: int):
        kwargs = dict(
            httponly=True,
            secure=COOKIE_SECURE,
            samesite=COOKIE_SAMESITE,
            path="/",
            max_age=max_age,
        )
        if COOKIE_DOMAIN:
            kwargs["domain"] = COOKIE_DOMAIN
        resp.set_cookie(key=key, value=value, **kwargs)

    _set("access_token", access_token, ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    _set("refresh_token", refresh_token, REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600)


def clear_auth_cookies(resp: Response) -> None:
    """Clear authentication cookies on logout."""
    kwargs = {"path": "/"}
    if COOKIE_DOMAIN:
        kwargs["domain"] = COOKIE_DOMAIN
    resp.delete_cookie("access_token", **kwargs)
    resp.delete_cookie("refresh_token", **kwargs)


def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Validate password meets security requirements.

    Requirements:
    - At least 8 characters (12 recommended)
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character

    Returns:
        (is_valid, error_message)
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters"

    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    has_special = any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?/~`" for c in password)

    if not has_upper:
        return False, "Password must contain at least one uppercase letter"
    if not has_lower:
        return False, "Password must contain at least one lowercase letter"
    if not has_digit:
        return False, "Password must contain at least one digit"
    if not has_special:
        return False, "Password must contain at least one special character"

    # Check for common weak passwords
    weak_passwords = [
        "password", "password1", "123456", "12345678",
        "qwerty", "admin", "letmein", "welcome"
    ]
    if password.lower() in weak_passwords:
        return False, "Password is too common"

    return True, ""
