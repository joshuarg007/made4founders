"""
OAuth 2.0 authentication for Google and GitHub.

This module handles:
- OAuth flow initiation
- Callback handling
- User creation/login via OAuth
- Token management
"""
import os
import secrets
import httpx
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Response, Request
from sqlalchemy.orm import Session

from .database import get_db
from .models import User, Organization, SubscriptionStatus, SubscriptionTier
from . import security

router = APIRouter()

# ============ CONFIGURATION ============

# Google OAuth
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8001/api/auth/google/callback")

# GitHub OAuth
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GITHUB_REDIRECT_URI = os.getenv("GITHUB_REDIRECT_URI", "http://localhost:8001/api/auth/github/callback")

# Frontend URL for redirects
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# State tokens (in production, use Redis or database)
oauth_states: dict[str, dict] = {}


def generate_state() -> str:
    """Generate a secure random state token."""
    return secrets.token_urlsafe(32)


def create_slug(name: str) -> str:
    """Create a URL-friendly slug from a name."""
    import re
    slug = name.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_-]+', '-', slug)
    slug = re.sub(r'^-+|-+$', '', slug)
    return slug[:100]  # Limit length


def get_unique_slug(db: Session, base_slug: str) -> str:
    """Ensure slug is unique by appending a number if needed."""
    slug = base_slug
    counter = 1
    while db.query(Organization).filter(Organization.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1
    return slug


# ============ GOOGLE OAUTH ============

@router.get("/google/login")
async def google_login():
    """Initiate Google OAuth flow."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    state = generate_state()
    oauth_states[state] = {"provider": "google", "created_at": datetime.utcnow()}

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "consent",
    }

    url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    return {"url": url}


@router.get("/google/callback")
async def google_callback(
    code: str,
    state: str,
    response: Response,
    db: Session = Depends(get_db),
):
    """Handle Google OAuth callback."""
    # Verify state
    if state not in oauth_states or oauth_states[state]["provider"] != "google":
        raise HTTPException(status_code=400, detail="Invalid state parameter")

    del oauth_states[state]  # Clean up

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": GOOGLE_REDIRECT_URI,
            },
        )

        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get access token")

        tokens = token_response.json()
        access_token = tokens["access_token"]

        # Get user info
        user_response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if user_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get user info")

        user_info = user_response.json()

    email = user_info.get("email")
    name = user_info.get("name")
    google_id = user_info.get("id")
    avatar = user_info.get("picture")

    if not email:
        raise HTTPException(status_code=400, detail="Email not provided by Google")

    # Find or create user
    user = db.query(User).filter(User.email == email).first()

    if not user:
        # Create new user and organization
        org_name = name.split()[0] + "'s Company" if name else "My Company"
        base_slug = create_slug(org_name)
        slug = get_unique_slug(db, base_slug)

        # Create organization with 14-day trial
        org = Organization(
            name=org_name,
            slug=slug,
            subscription_tier=SubscriptionTier.FREE.value,
            subscription_status=SubscriptionStatus.TRIALING.value,
            trial_ends_at=datetime.utcnow() + timedelta(days=14),
        )
        db.add(org)
        db.flush()

        # Create user
        user = User(
            email=email,
            name=name,
            oauth_provider="google",
            oauth_provider_id=google_id,
            avatar_url=avatar,
            email_verified=True,  # Google verifies emails
            email_verified_at=datetime.utcnow(),
            organization_id=org.id,
            is_org_owner=True,
            role="admin",
            is_active=True,
        )
        db.add(user)
        db.commit()
    else:
        # Update existing user with Google info if not already linked
        if not user.oauth_provider:
            user.oauth_provider = "google"
            user.oauth_provider_id = google_id
        if not user.avatar_url:
            user.avatar_url = avatar
        if not user.email_verified:
            user.email_verified = True
            user.email_verified_at = datetime.utcnow()
        db.commit()

    # Create auth tokens
    access = security.create_access_token(user.email)
    refresh = security.create_refresh_token(user.email)
    security.set_auth_cookies(response, access, refresh)

    # Redirect to frontend
    response.status_code = 302
    response.headers["Location"] = f"{FRONTEND_URL}/app"
    return response


# ============ GITHUB OAUTH ============

@router.get("/github/login")
async def github_login():
    """Initiate GitHub OAuth flow."""
    if not GITHUB_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GitHub OAuth not configured")

    state = generate_state()
    oauth_states[state] = {"provider": "github", "created_at": datetime.utcnow()}

    params = {
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": GITHUB_REDIRECT_URI,
        "scope": "read:user user:email",
        "state": state,
    }

    url = f"https://github.com/login/oauth/authorize?{urlencode(params)}"
    return {"url": url}


@router.get("/github/callback")
async def github_callback(
    code: str,
    state: str,
    response: Response,
    db: Session = Depends(get_db),
):
    """Handle GitHub OAuth callback."""
    # Verify state
    if state not in oauth_states or oauth_states[state]["provider"] != "github":
        raise HTTPException(status_code=400, detail="Invalid state parameter")

    del oauth_states[state]  # Clean up

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": GITHUB_REDIRECT_URI,
            },
        )

        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get access token")

        tokens = token_response.json()
        access_token = tokens.get("access_token")

        if not access_token:
            raise HTTPException(status_code=400, detail="No access token in response")

        # Get user info
        user_response = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github.v3+json",
            },
        )

        if user_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get user info")

        user_info = user_response.json()

        # Get email (might need separate request if email is private)
        email = user_info.get("email")
        if not email:
            email_response = await client.get(
                "https://api.github.com/user/emails",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github.v3+json",
                },
            )
            if email_response.status_code == 200:
                emails = email_response.json()
                primary_email = next(
                    (e for e in emails if e.get("primary") and e.get("verified")),
                    None
                )
                if primary_email:
                    email = primary_email["email"]

    if not email:
        raise HTTPException(status_code=400, detail="Email not provided by GitHub")

    name = user_info.get("name") or user_info.get("login")
    github_id = str(user_info.get("id"))
    avatar = user_info.get("avatar_url")

    # Find or create user
    user = db.query(User).filter(User.email == email).first()

    if not user:
        # Create new user and organization
        org_name = name.split()[0] + "'s Company" if name else "My Company"
        base_slug = create_slug(org_name)
        slug = get_unique_slug(db, base_slug)

        # Create organization with 14-day trial
        org = Organization(
            name=org_name,
            slug=slug,
            subscription_tier=SubscriptionTier.FREE.value,
            subscription_status=SubscriptionStatus.TRIALING.value,
            trial_ends_at=datetime.utcnow() + timedelta(days=14),
        )
        db.add(org)
        db.flush()

        # Create user
        user = User(
            email=email,
            name=name,
            oauth_provider="github",
            oauth_provider_id=github_id,
            avatar_url=avatar,
            email_verified=True,  # GitHub verifies emails
            email_verified_at=datetime.utcnow(),
            organization_id=org.id,
            is_org_owner=True,
            role="admin",
            is_active=True,
        )
        db.add(user)
        db.commit()
    else:
        # Update existing user with GitHub info if not already linked
        if not user.oauth_provider:
            user.oauth_provider = "github"
            user.oauth_provider_id = github_id
        if not user.avatar_url:
            user.avatar_url = avatar
        if not user.email_verified:
            user.email_verified = True
            user.email_verified_at = datetime.utcnow()
        db.commit()

    # Create auth tokens
    access = security.create_access_token(user.email)
    refresh = security.create_refresh_token(user.email)
    security.set_auth_cookies(response, access, refresh)

    # Redirect to frontend
    response.status_code = 302
    response.headers["Location"] = f"{FRONTEND_URL}/app"
    return response


# ============ CLEANUP ============

def cleanup_old_states():
    """Remove expired state tokens (call periodically)."""
    now = datetime.utcnow()
    expired = [
        state for state, data in oauth_states.items()
        if (now - data["created_at"]).total_seconds() > 600  # 10 minutes
    ]
    for state in expired:
        del oauth_states[state]
