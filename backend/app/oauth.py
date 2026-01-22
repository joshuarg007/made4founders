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

# LinkedIn OAuth
LINKEDIN_CLIENT_ID = os.getenv("LINKEDIN_CLIENT_ID", "")
LINKEDIN_CLIENT_SECRET = os.getenv("LINKEDIN_CLIENT_SECRET", "")
LINKEDIN_REDIRECT_URI = os.getenv("LINKEDIN_REDIRECT_URI", "http://localhost:8001/api/auth/linkedin/callback")

# Twitter/X OAuth 2.0
TWITTER_CLIENT_ID = os.getenv("TWITTER_CLIENT_ID", "")
TWITTER_CLIENT_SECRET = os.getenv("TWITTER_CLIENT_SECRET", "")
TWITTER_REDIRECT_URI = os.getenv("TWITTER_REDIRECT_URI", "http://localhost:8001/api/auth/twitter/callback")

# Facebook OAuth
FACEBOOK_APP_ID = os.getenv("FACEBOOK_APP_ID", "")
FACEBOOK_APP_SECRET = os.getenv("FACEBOOK_APP_SECRET", "")
FACEBOOK_REDIRECT_URI = os.getenv("FACEBOOK_REDIRECT_URI", "http://localhost:8001/api/auth/facebook/callback")

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
    response: Response,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Handle Google OAuth callback."""
    # Handle user cancellation or errors
    if error:
        response.status_code = 302
        response.headers["Location"] = f"{FRONTEND_URL}/login?error=oauth_cancelled"
        return response

    if not code or not state:
        response.status_code = 302
        response.headers["Location"] = f"{FRONTEND_URL}/login?error=oauth_failed"
        return response

    # Verify state
    if state not in oauth_states or oauth_states[state]["provider"] != "google":
        response.status_code = 302
        response.headers["Location"] = f"{FRONTEND_URL}/login?error=invalid_state"
        return response

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
            subscription_tier=SubscriptionTier.STARTER.value,
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
    response: Response,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Handle GitHub OAuth callback."""
    # Handle user cancellation or errors
    if error:
        response.status_code = 302
        response.headers["Location"] = f"{FRONTEND_URL}/login?error=oauth_cancelled"
        return response

    if not code or not state:
        response.status_code = 302
        response.headers["Location"] = f"{FRONTEND_URL}/login?error=oauth_failed"
        return response

    # Verify state
    if state not in oauth_states or oauth_states[state]["provider"] != "github":
        response.status_code = 302
        response.headers["Location"] = f"{FRONTEND_URL}/login?error=invalid_state"
        return response

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
            subscription_tier=SubscriptionTier.STARTER.value,
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


# ============ LINKEDIN OAUTH ============

@router.get("/linkedin/login")
async def linkedin_login():
    """Initiate LinkedIn OAuth flow."""
    if not LINKEDIN_CLIENT_ID:
        raise HTTPException(status_code=500, detail="LinkedIn OAuth not configured")

    state = generate_state()
    oauth_states[state] = {"provider": "linkedin", "created_at": datetime.utcnow()}

    # LinkedIn OAuth 2.0 with OpenID Connect
    params = {
        "response_type": "code",
        "client_id": LINKEDIN_CLIENT_ID,
        "redirect_uri": LINKEDIN_REDIRECT_URI,
        "state": state,
        "scope": "openid profile email w_member_social",  # w_member_social for posting
    }

    url = f"https://www.linkedin.com/oauth/v2/authorization?{urlencode(params)}"
    return {"url": url}


@router.get("/linkedin/callback")
async def linkedin_callback(
    response: Response,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Handle LinkedIn OAuth callback."""
    # Handle user cancellation or errors
    if error:
        response.status_code = 302
        response.headers["Location"] = f"{FRONTEND_URL}/login?error=oauth_cancelled"
        return response

    if not code or not state:
        response.status_code = 302
        response.headers["Location"] = f"{FRONTEND_URL}/login?error=oauth_failed"
        return response

    # Verify state
    if state not in oauth_states or oauth_states[state]["provider"] != "linkedin":
        response.status_code = 302
        response.headers["Location"] = f"{FRONTEND_URL}/login?error=invalid_state"
        return response

    del oauth_states[state]  # Clean up

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://www.linkedin.com/oauth/v2/accessToken",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": LINKEDIN_CLIENT_ID,
                "client_secret": LINKEDIN_CLIENT_SECRET,
                "redirect_uri": LINKEDIN_REDIRECT_URI,
            },
        )

        if token_response.status_code != 200:
            response.status_code = 302
            response.headers["Location"] = f"{FRONTEND_URL}/login?error=oauth_failed"
            return response

        tokens = token_response.json()
        access_token = tokens.get("access_token")

        if not access_token:
            response.status_code = 302
            response.headers["Location"] = f"{FRONTEND_URL}/login?error=oauth_failed"
            return response

        # Get user info using OpenID Connect userinfo endpoint
        user_response = await client.get(
            "https://api.linkedin.com/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if user_response.status_code != 200:
            response.status_code = 302
            response.headers["Location"] = f"{FRONTEND_URL}/login?error=oauth_failed"
            return response

        user_info = user_response.json()

    email = user_info.get("email")
    name = user_info.get("name")
    linkedin_id = user_info.get("sub")  # OpenID Connect subject identifier
    avatar = user_info.get("picture")

    if not email:
        response.status_code = 302
        response.headers["Location"] = f"{FRONTEND_URL}/login?error=email_required"
        return response

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
            subscription_tier=SubscriptionTier.STARTER.value,
            subscription_status=SubscriptionStatus.TRIALING.value,
            trial_ends_at=datetime.utcnow() + timedelta(days=14),
        )
        db.add(org)
        db.flush()

        # Create user
        user = User(
            email=email,
            name=name,
            oauth_provider="linkedin",
            oauth_provider_id=linkedin_id,
            avatar_url=avatar,
            email_verified=True,  # LinkedIn verifies emails
            email_verified_at=datetime.utcnow(),
            organization_id=org.id,
            is_org_owner=True,
            role="admin",
            is_active=True,
        )
        db.add(user)
        db.commit()
    else:
        # Update existing user with LinkedIn info if not already linked
        if not user.oauth_provider:
            user.oauth_provider = "linkedin"
            user.oauth_provider_id = linkedin_id
        if not user.avatar_url:
            user.avatar_url = avatar
        if not user.email_verified:
            user.email_verified = True
            user.email_verified_at = datetime.utcnow()
        db.commit()

    # Store LinkedIn tokens for social posting (if user has organization)
    if user.organization_id:
        from .models import OAuthConnection

        # Check if connection already exists
        existing_conn = db.query(OAuthConnection).filter(
            OAuthConnection.organization_id == user.organization_id,
            OAuthConnection.user_id == user.id,
            OAuthConnection.provider == "linkedin"
        ).first()

        if existing_conn:
            existing_conn.access_token = access_token
            existing_conn.refresh_token = tokens.get("refresh_token")
            existing_conn.token_expires_at = datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 3600))
            existing_conn.provider_user_id = linkedin_id
            existing_conn.is_active = True
            existing_conn.updated_at = datetime.utcnow()
        else:
            oauth_conn = OAuthConnection(
                organization_id=user.organization_id,
                user_id=user.id,
                provider="linkedin",
                provider_user_id=linkedin_id,
                access_token=access_token,
                refresh_token=tokens.get("refresh_token"),
                token_expires_at=datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 3600)),
                scopes="openid,profile,email,w_member_social",
                is_active=True,
            )
            db.add(oauth_conn)
        db.commit()

    # Create auth tokens
    access = security.create_access_token(user.email)
    refresh = security.create_refresh_token(user.email)
    security.set_auth_cookies(response, access, refresh)

    # Redirect to frontend
    response.status_code = 302
    response.headers["Location"] = f"{FRONTEND_URL}/app"
    return response


# ============ TWITTER/X OAUTH ============

@router.get("/twitter/login")
async def twitter_login():
    """Initiate Twitter OAuth 2.0 flow for login."""
    if not TWITTER_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Twitter OAuth not configured")

    state = generate_state()
    oauth_states[state] = {"provider": "twitter", "created_at": datetime.utcnow()}

    # Twitter OAuth 2.0 with PKCE
    params = {
        "response_type": "code",
        "client_id": TWITTER_CLIENT_ID,
        "redirect_uri": TWITTER_REDIRECT_URI,
        "scope": "tweet.read users.read offline.access",
        "state": state,
        "code_challenge": state[:43],  # Simplified PKCE
        "code_challenge_method": "plain",
    }

    url = f"https://twitter.com/i/oauth2/authorize?{urlencode(params)}"
    return {"url": url}


@router.get("/twitter/callback")
async def twitter_callback(
    response: Response,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Handle Twitter OAuth callback for login."""
    if error:
        response.status_code = 302
        response.headers["Location"] = f"{FRONTEND_URL}/login?error=oauth_cancelled"
        return response

    if not code or not state:
        response.status_code = 302
        response.headers["Location"] = f"{FRONTEND_URL}/login?error=oauth_failed"
        return response

    if state not in oauth_states or oauth_states[state]["provider"] != "twitter":
        response.status_code = 302
        response.headers["Location"] = f"{FRONTEND_URL}/login?error=invalid_state"
        return response

    del oauth_states[state]

    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        token_response = await client.post(
            "https://api.twitter.com/2/oauth2/token",
            data={
                "code": code,
                "grant_type": "authorization_code",
                "client_id": TWITTER_CLIENT_ID,
                "redirect_uri": TWITTER_REDIRECT_URI,
                "code_verifier": state[:43],
            },
            auth=(TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET),
        )

        if token_response.status_code != 200:
            response.status_code = 302
            response.headers["Location"] = f"{FRONTEND_URL}/login?error=oauth_failed"
            return response

        tokens = token_response.json()
        access_token = tokens.get("access_token")

        # Get user info
        user_response = await client.get(
            "https://api.twitter.com/2/users/me",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"user.fields": "profile_image_url"},
        )

        if user_response.status_code != 200:
            response.status_code = 302
            response.headers["Location"] = f"{FRONTEND_URL}/login?error=oauth_failed"
            return response

        twitter_user = user_response.json().get("data", {})

    twitter_id = twitter_user.get("id")
    username = twitter_user.get("username")
    name = twitter_user.get("name", username)
    avatar = twitter_user.get("profile_image_url")

    # Twitter doesn't provide email by default - need elevated access
    # For now, create a placeholder email based on username
    email = f"{username}@twitter.placeholder"

    # Try to find user by Twitter ID first, then by email
    user = db.query(User).filter(
        User.oauth_provider == "twitter",
        User.oauth_provider_id == twitter_id
    ).first()

    if not user:
        # Check if user with this placeholder email exists
        user = db.query(User).filter(User.email == email).first()

    if not user:
        # Create new user and organization
        org_name = name.split()[0] + "'s Company" if name else "My Company"
        base_slug = create_slug(org_name)
        slug = get_unique_slug(db, base_slug)

        org = Organization(
            name=org_name,
            slug=slug,
            subscription_tier=SubscriptionTier.STARTER.value,
            subscription_status=SubscriptionStatus.TRIALING.value,
            trial_ends_at=datetime.utcnow() + timedelta(days=14),
        )
        db.add(org)
        db.flush()

        user = User(
            email=email,
            name=name,
            oauth_provider="twitter",
            oauth_provider_id=twitter_id,
            avatar_url=avatar,
            email_verified=False,  # Twitter doesn't verify email for us
            organization_id=org.id,
            is_org_owner=True,
            role="admin",
            is_active=True,
        )
        db.add(user)
        db.commit()
    else:
        if not user.oauth_provider:
            user.oauth_provider = "twitter"
            user.oauth_provider_id = twitter_id
        if not user.avatar_url:
            user.avatar_url = avatar
        db.commit()

    # Store Twitter tokens for social posting
    if user.organization_id:
        from .models import OAuthConnection

        existing_conn = db.query(OAuthConnection).filter(
            OAuthConnection.organization_id == user.organization_id,
            OAuthConnection.user_id == user.id,
            OAuthConnection.provider == "twitter"
        ).first()

        expires_at = None
        if tokens.get("expires_in"):
            expires_at = datetime.utcnow() + timedelta(seconds=tokens["expires_in"])

        if existing_conn:
            existing_conn.access_token = access_token
            existing_conn.refresh_token = tokens.get("refresh_token")
            existing_conn.token_expires_at = expires_at
            existing_conn.provider_user_id = twitter_id
            existing_conn.provider_username = username
            existing_conn.is_active = True
            existing_conn.updated_at = datetime.utcnow()
        else:
            oauth_conn = OAuthConnection(
                organization_id=user.organization_id,
                user_id=user.id,
                provider="twitter",
                provider_user_id=twitter_id,
                provider_username=username,
                access_token=access_token,
                refresh_token=tokens.get("refresh_token"),
                token_expires_at=expires_at,
                scopes="tweet.read,users.read,offline.access",
                is_active=True,
            )
            db.add(oauth_conn)
        db.commit()

    access = security.create_access_token(user.email)
    refresh = security.create_refresh_token(user.email)
    security.set_auth_cookies(response, access, refresh)

    response.status_code = 302
    response.headers["Location"] = f"{FRONTEND_URL}/app"
    return response


# ============ FACEBOOK OAUTH ============

@router.get("/facebook/login")
async def facebook_login():
    """Initiate Facebook OAuth flow for login."""
    if not FACEBOOK_APP_ID:
        raise HTTPException(status_code=500, detail="Facebook OAuth not configured")

    state = generate_state()
    oauth_states[state] = {"provider": "facebook", "created_at": datetime.utcnow()}

    params = {
        "client_id": FACEBOOK_APP_ID,
        "redirect_uri": FACEBOOK_REDIRECT_URI,
        "state": state,
        "scope": "email,public_profile",
    }

    url = f"https://www.facebook.com/v18.0/dialog/oauth?{urlencode(params)}"
    return {"url": url}


@router.get("/facebook/callback")
async def facebook_callback(
    response: Response,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Handle Facebook OAuth callback for login."""
    if error:
        response.status_code = 302
        response.headers["Location"] = f"{FRONTEND_URL}/login?error=oauth_cancelled"
        return response

    if not code or not state:
        response.status_code = 302
        response.headers["Location"] = f"{FRONTEND_URL}/login?error=oauth_failed"
        return response

    if state not in oauth_states or oauth_states[state]["provider"] != "facebook":
        response.status_code = 302
        response.headers["Location"] = f"{FRONTEND_URL}/login?error=invalid_state"
        return response

    del oauth_states[state]

    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        token_response = await client.get(
            "https://graph.facebook.com/v18.0/oauth/access_token",
            params={
                "client_id": FACEBOOK_APP_ID,
                "client_secret": FACEBOOK_APP_SECRET,
                "redirect_uri": FACEBOOK_REDIRECT_URI,
                "code": code,
            },
        )

        if token_response.status_code != 200:
            response.status_code = 302
            response.headers["Location"] = f"{FRONTEND_URL}/login?error=oauth_failed"
            return response

        tokens = token_response.json()
        access_token = tokens.get("access_token")

        # Get user info
        user_response = await client.get(
            "https://graph.facebook.com/v18.0/me",
            params={
                "access_token": access_token,
                "fields": "id,name,email,picture.type(large)",
            },
        )

        if user_response.status_code != 200:
            response.status_code = 302
            response.headers["Location"] = f"{FRONTEND_URL}/login?error=oauth_failed"
            return response

        fb_user = user_response.json()

        # Get long-lived token
        long_token_response = await client.get(
            "https://graph.facebook.com/v18.0/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": FACEBOOK_APP_ID,
                "client_secret": FACEBOOK_APP_SECRET,
                "fb_exchange_token": access_token,
            },
        )

        if long_token_response.status_code == 200:
            long_tokens = long_token_response.json()
            access_token = long_tokens.get("access_token", access_token)
            tokens["expires_in"] = long_tokens.get("expires_in", 5184000)

    facebook_id = fb_user.get("id")
    email = fb_user.get("email")
    name = fb_user.get("name")
    avatar = fb_user.get("picture", {}).get("data", {}).get("url")

    if not email:
        # Facebook user didn't share email
        email = f"{facebook_id}@facebook.placeholder"

    # Find or create user
    user = db.query(User).filter(User.email == email).first()

    if not user:
        # Check by Facebook ID
        user = db.query(User).filter(
            User.oauth_provider == "facebook",
            User.oauth_provider_id == facebook_id
        ).first()

    if not user:
        org_name = name.split()[0] + "'s Company" if name else "My Company"
        base_slug = create_slug(org_name)
        slug = get_unique_slug(db, base_slug)

        org = Organization(
            name=org_name,
            slug=slug,
            subscription_tier=SubscriptionTier.STARTER.value,
            subscription_status=SubscriptionStatus.TRIALING.value,
            trial_ends_at=datetime.utcnow() + timedelta(days=14),
        )
        db.add(org)
        db.flush()

        user = User(
            email=email,
            name=name,
            oauth_provider="facebook",
            oauth_provider_id=facebook_id,
            avatar_url=avatar,
            email_verified="@facebook.placeholder" not in email,
            email_verified_at=datetime.utcnow() if "@facebook.placeholder" not in email else None,
            organization_id=org.id,
            is_org_owner=True,
            role="admin",
            is_active=True,
        )
        db.add(user)
        db.commit()
    else:
        if not user.oauth_provider:
            user.oauth_provider = "facebook"
            user.oauth_provider_id = facebook_id
        if not user.avatar_url:
            user.avatar_url = avatar
        if not user.email_verified and "@facebook.placeholder" not in email:
            user.email_verified = True
            user.email_verified_at = datetime.utcnow()
        db.commit()

    # Store Facebook tokens for social posting
    if user.organization_id:
        from .models import OAuthConnection

        existing_conn = db.query(OAuthConnection).filter(
            OAuthConnection.organization_id == user.organization_id,
            OAuthConnection.user_id == user.id,
            OAuthConnection.provider == "facebook"
        ).first()

        expires_at = None
        if tokens.get("expires_in"):
            expires_at = datetime.utcnow() + timedelta(seconds=tokens["expires_in"])

        if existing_conn:
            existing_conn.access_token = access_token
            existing_conn.token_expires_at = expires_at
            existing_conn.provider_user_id = facebook_id
            existing_conn.provider_username = name
            existing_conn.is_active = True
            existing_conn.updated_at = datetime.utcnow()
        else:
            oauth_conn = OAuthConnection(
                organization_id=user.organization_id,
                user_id=user.id,
                provider="facebook",
                provider_user_id=facebook_id,
                provider_username=name,
                access_token=access_token,
                token_expires_at=expires_at,
                scopes="email,public_profile",
                is_active=True,
            )
            db.add(oauth_conn)
        db.commit()

    access = security.create_access_token(user.email)
    refresh = security.create_refresh_token(user.email)
    security.set_auth_cookies(response, access, refresh)

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
