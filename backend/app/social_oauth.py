"""
Social Media OAuth integration for marketing features.

Supports:
- Twitter/X OAuth 2.0
- Facebook OAuth
- Instagram (via Facebook)
- LinkedIn OAuth 2.0
"""
import os
import secrets
import httpx
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel

from .database import get_db
from .models import User, OAuthConnection
from .auth import get_current_user

router = APIRouter()

# ============ CONFIGURATION ============

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8001")

# Twitter/X OAuth 2.0
TWITTER_CLIENT_ID = os.getenv("TWITTER_CLIENT_ID", "")
TWITTER_CLIENT_SECRET = os.getenv("TWITTER_CLIENT_SECRET", "")
TWITTER_REDIRECT_URI = f"{BACKEND_URL}/api/social/twitter/callback"

# Facebook OAuth
FACEBOOK_APP_ID = os.getenv("FACEBOOK_APP_ID", "")
FACEBOOK_APP_SECRET = os.getenv("FACEBOOK_APP_SECRET", "")
FACEBOOK_REDIRECT_URI = f"{BACKEND_URL}/api/social/facebook/callback"

# LinkedIn OAuth 2.0
LINKEDIN_CLIENT_ID = os.getenv("LINKEDIN_CLIENT_ID", "")
LINKEDIN_CLIENT_SECRET = os.getenv("LINKEDIN_CLIENT_SECRET", "")
LINKEDIN_REDIRECT_URI = f"{BACKEND_URL}/api/social/linkedin/callback"

# State tokens storage (use Redis in production)
oauth_states: dict[str, dict] = {}


def generate_state(user_id: int, provider: str) -> str:
    """Generate a secure state token with user context."""
    state = secrets.token_urlsafe(32)
    oauth_states[state] = {
        "user_id": user_id,
        "provider": provider,
        "created_at": datetime.utcnow(),
    }
    return state


def validate_state(state: str, provider: str) -> Optional[int]:
    """Validate state and return user_id if valid."""
    data = oauth_states.get(state)
    if not data:
        return None
    if data["provider"] != provider:
        return None
    # Expire after 10 minutes
    if (datetime.utcnow() - data["created_at"]).total_seconds() > 600:
        del oauth_states[state]
        return None
    del oauth_states[state]
    return data["user_id"]


# ============ SCHEMAS ============

class SocialAccountResponse(BaseModel):
    id: int
    provider: str
    provider_username: Optional[str]
    page_name: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ConnectedAccountsResponse(BaseModel):
    twitter: Optional[SocialAccountResponse] = None
    facebook: Optional[SocialAccountResponse] = None
    instagram: Optional[SocialAccountResponse] = None
    linkedin: Optional[SocialAccountResponse] = None


# ============ CONNECTED ACCOUNTS ============

@router.get("/accounts", response_model=ConnectedAccountsResponse)
async def get_connected_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all connected social media accounts."""
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="No organization")

    accounts = db.query(OAuthConnection).filter(
        OAuthConnection.organization_id == current_user.organization_id,
        OAuthConnection.is_active == True,
    ).all()

    result = ConnectedAccountsResponse()
    for acc in accounts:
        account_data = SocialAccountResponse(
            id=acc.id,
            provider=acc.provider,
            provider_username=acc.provider_username,
            page_name=acc.page_name,
            is_active=acc.is_active,
            created_at=acc.created_at,
        )
        if acc.provider == "twitter":
            result.twitter = account_data
        elif acc.provider == "facebook":
            result.facebook = account_data
        elif acc.provider == "instagram":
            result.instagram = account_data
        elif acc.provider == "linkedin":
            result.linkedin = account_data

    return result


@router.delete("/accounts/{provider}")
async def disconnect_account(
    provider: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Disconnect a social media account."""
    if current_user.role not in ['admin', 'editor']:
        raise HTTPException(status_code=403, detail="Not authorized")

    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="No organization")

    account = db.query(OAuthConnection).filter(
        OAuthConnection.organization_id == current_user.organization_id,
        OAuthConnection.provider == provider,
    ).first()

    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    db.delete(account)
    db.commit()

    return {"ok": True, "message": f"{provider.title()} account disconnected"}


# ============ TWITTER/X OAUTH 2.0 ============

@router.get("/twitter/connect")
async def twitter_connect(current_user: User = Depends(get_current_user)):
    """Initiate Twitter OAuth 2.0 flow."""
    if not TWITTER_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Twitter OAuth not configured")

    state = generate_state(current_user.id, "twitter")

    # Twitter OAuth 2.0 with PKCE
    params = {
        "response_type": "code",
        "client_id": TWITTER_CLIENT_ID,
        "redirect_uri": TWITTER_REDIRECT_URI,
        "scope": "tweet.read tweet.write users.read offline.access",
        "state": state,
        "code_challenge": state[:43],  # Simplified PKCE
        "code_challenge_method": "plain",
    }

    url = f"https://twitter.com/i/oauth2/authorize?{urlencode(params)}"
    return {"url": url}


@router.get("/twitter/callback")
async def twitter_callback(
    code: str,
    state: str,
    response: Response,
    db: Session = Depends(get_db),
):
    """Handle Twitter OAuth callback."""
    user_id = validate_state(state, "twitter")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid state")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.organization_id:
        raise HTTPException(status_code=400, detail="User not found")

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
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
            raise HTTPException(status_code=400, detail="Failed to get access token")

        tokens = token_response.json()

        # Get user info
        user_response = await client.get(
            "https://api.twitter.com/2/users/me",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )

        if user_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get user info")

        twitter_user = user_response.json().get("data", {})

    # Save or update connection
    existing = db.query(OAuthConnection).filter(
        OAuthConnection.organization_id == user.organization_id,
        OAuthConnection.provider == "twitter",
    ).first()

    expires_at = None
    if tokens.get("expires_in"):
        expires_at = datetime.utcnow() + timedelta(seconds=tokens["expires_in"])

    if existing:
        existing.access_token = tokens["access_token"]
        existing.refresh_token = tokens.get("refresh_token")
        existing.token_expires_at = expires_at
        existing.provider_user_id = twitter_user.get("id")
        existing.provider_username = twitter_user.get("username")
        existing.is_active = True
        existing.updated_at = datetime.utcnow()
    else:
        connection = OAuthConnection(
            organization_id=user.organization_id,
            user_id=user.id,
            provider="twitter",
            provider_user_id=twitter_user.get("id"),
            provider_username=twitter_user.get("username"),
            access_token=tokens["access_token"],
            refresh_token=tokens.get("refresh_token"),
            token_expires_at=expires_at,
            scopes="tweet.read,tweet.write,users.read,offline.access",
        )
        db.add(connection)

    db.commit()

    response.status_code = 302
    response.headers["Location"] = f"{FRONTEND_URL}/app/marketing?connected=twitter"
    return response


# ============ LINKEDIN OAUTH 2.0 ============

@router.get("/linkedin/connect")
async def linkedin_connect(current_user: User = Depends(get_current_user)):
    """Initiate LinkedIn OAuth 2.0 flow."""
    if not LINKEDIN_CLIENT_ID:
        raise HTTPException(status_code=500, detail="LinkedIn OAuth not configured")

    state = generate_state(current_user.id, "linkedin")

    params = {
        "response_type": "code",
        "client_id": LINKEDIN_CLIENT_ID,
        "redirect_uri": LINKEDIN_REDIRECT_URI,
        "state": state,
        "scope": "openid profile email w_member_social",
    }

    url = f"https://www.linkedin.com/oauth/v2/authorization?{urlencode(params)}"
    return {"url": url}


@router.get("/linkedin/callback")
async def linkedin_callback(
    code: str,
    state: str,
    response: Response,
    db: Session = Depends(get_db),
):
    """Handle LinkedIn OAuth callback."""
    user_id = validate_state(state, "linkedin")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid state")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.organization_id:
        raise HTTPException(status_code=400, detail="User not found")

    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        token_response = await client.post(
            "https://www.linkedin.com/oauth/v2/accessToken",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": LINKEDIN_CLIENT_ID,
                "client_secret": LINKEDIN_CLIENT_SECRET,
                "redirect_uri": LINKEDIN_REDIRECT_URI,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get access token")

        tokens = token_response.json()

        # Get user info
        user_response = await client.get(
            "https://api.linkedin.com/v2/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )

        if user_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get user info")

        linkedin_user = user_response.json()

    # Save or update connection
    existing = db.query(OAuthConnection).filter(
        OAuthConnection.organization_id == user.organization_id,
        OAuthConnection.provider == "linkedin",
    ).first()

    expires_at = None
    if tokens.get("expires_in"):
        expires_at = datetime.utcnow() + timedelta(seconds=tokens["expires_in"])

    if existing:
        existing.access_token = tokens["access_token"]
        existing.refresh_token = tokens.get("refresh_token")
        existing.token_expires_at = expires_at
        existing.provider_user_id = linkedin_user.get("sub")
        existing.provider_username = linkedin_user.get("name")
        existing.is_active = True
        existing.updated_at = datetime.utcnow()
    else:
        connection = OAuthConnection(
            organization_id=user.organization_id,
            user_id=user.id,
            provider="linkedin",
            provider_user_id=linkedin_user.get("sub"),
            provider_username=linkedin_user.get("name"),
            access_token=tokens["access_token"],
            refresh_token=tokens.get("refresh_token"),
            token_expires_at=expires_at,
            scopes="openid,profile,email,w_member_social",
        )
        db.add(connection)

    db.commit()

    response.status_code = 302
    response.headers["Location"] = f"{FRONTEND_URL}/app/marketing?connected=linkedin"
    return response


# ============ LINKEDIN POSTING ============

class LinkedInPostRequest(BaseModel):
    content: str
    visibility: str = "PUBLIC"  # PUBLIC, CONNECTIONS


class LinkedInPostResponse(BaseModel):
    success: bool
    post_id: Optional[str] = None
    post_url: Optional[str] = None
    error: Optional[str] = None


@router.post("/linkedin/post", response_model=LinkedInPostResponse)
async def create_linkedin_post(
    request: LinkedInPostRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a post on LinkedIn."""
    if current_user.role not in ['admin', 'editor']:
        raise HTTPException(status_code=403, detail="Not authorized to post")

    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="No organization")

    # Get LinkedIn connection
    connection = db.query(OAuthConnection).filter(
        OAuthConnection.organization_id == current_user.organization_id,
        OAuthConnection.provider == "linkedin",
        OAuthConnection.is_active == True,
    ).first()

    if not connection:
        return LinkedInPostResponse(
            success=False,
            error="LinkedIn account not connected. Please connect your LinkedIn account first."
        )

    # Check token expiration
    if connection.token_expires_at and connection.token_expires_at < datetime.utcnow():
        return LinkedInPostResponse(
            success=False,
            error="LinkedIn token expired. Please reconnect your LinkedIn account."
        )

    try:
        async with httpx.AsyncClient() as client:
            # Get user URN
            me_response = await client.get(
                "https://api.linkedin.com/v2/userinfo",
                headers={"Authorization": f"Bearer {connection.access_token}"},
            )

            if me_response.status_code != 200:
                return LinkedInPostResponse(
                    success=False,
                    error="Failed to verify LinkedIn connection. Please reconnect."
                )

            user_sub = me_response.json().get("sub")
            author_urn = f"urn:li:person:{user_sub}"

            # Use the new Posts API
            headers = {
                "Authorization": f"Bearer {connection.access_token}",
                "Content-Type": "application/json",
                "X-Restli-Protocol-Version": "2.0.0",
                "LinkedIn-Version": "202401",
            }

            payload = {
                "author": author_urn,
                "lifecycleState": "PUBLISHED",
                "visibility": request.visibility,
                "commentary": request.content,
                "distribution": {
                    "feedDistribution": "MAIN_FEED",
                    "targetEntities": [],
                    "thirdPartyDistributionChannels": []
                }
            }

            response = await client.post(
                "https://api.linkedin.com/rest/posts",
                headers=headers,
                json=payload,
            )

            if response.status_code in [200, 201]:
                post_id = response.headers.get("x-restli-id", "")
                return LinkedInPostResponse(
                    success=True,
                    post_id=post_id,
                    post_url=f"https://www.linkedin.com/feed/update/{post_id}" if post_id else None
                )

            # Fallback to UGC Posts API
            ugc_payload = {
                "author": author_urn,
                "lifecycleState": "PUBLISHED",
                "specificContent": {
                    "com.linkedin.ugc.ShareContent": {
                        "shareCommentary": {"text": request.content},
                        "shareMediaCategory": "NONE",
                    }
                },
                "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": request.visibility},
            }

            ugc_headers = {
                "Authorization": f"Bearer {connection.access_token}",
                "Content-Type": "application/json",
                "X-Restli-Protocol-Version": "2.0.0",
            }

            response = await client.post(
                "https://api.linkedin.com/v2/ugcPosts",
                headers=ugc_headers,
                json=ugc_payload,
            )

            if response.status_code in [200, 201]:
                result = response.json()
                post_id = result.get("id", "")
                return LinkedInPostResponse(
                    success=True,
                    post_id=post_id,
                    post_url=f"https://www.linkedin.com/feed/update/{post_id}" if post_id else None
                )

            return LinkedInPostResponse(
                success=False,
                error=f"LinkedIn API error: {response.text}"
            )

    except httpx.HTTPError as e:
        return LinkedInPostResponse(
            success=False,
            error=f"Network error: {str(e)}"
        )
    except Exception as e:
        return LinkedInPostResponse(
            success=False,
            error=f"Unexpected error: {str(e)}"
        )


# ============ FACEBOOK OAUTH ============

@router.get("/facebook/connect")
async def facebook_connect(current_user: User = Depends(get_current_user)):
    """Initiate Facebook OAuth flow."""
    if not FACEBOOK_APP_ID:
        raise HTTPException(status_code=500, detail="Facebook OAuth not configured")

    state = generate_state(current_user.id, "facebook")

    params = {
        "client_id": FACEBOOK_APP_ID,
        "redirect_uri": FACEBOOK_REDIRECT_URI,
        "state": state,
        "scope": "pages_manage_posts,pages_read_engagement,pages_show_list,instagram_basic,instagram_content_publish",
    }

    url = f"https://www.facebook.com/v18.0/dialog/oauth?{urlencode(params)}"
    return {"url": url}


@router.get("/facebook/callback")
async def facebook_callback(
    code: str,
    state: str,
    response: Response,
    db: Session = Depends(get_db),
):
    """Handle Facebook OAuth callback."""
    user_id = validate_state(state, "facebook")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid state")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.organization_id:
        raise HTTPException(status_code=400, detail="User not found")

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
            raise HTTPException(status_code=400, detail="Failed to get access token")

        tokens = token_response.json()

        # Get user info
        user_response = await client.get(
            "https://graph.facebook.com/v18.0/me",
            params={
                "access_token": tokens["access_token"],
                "fields": "id,name",
            },
        )

        if user_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get user info")

        fb_user = user_response.json()

        # Get long-lived token
        long_token_response = await client.get(
            "https://graph.facebook.com/v18.0/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": FACEBOOK_APP_ID,
                "client_secret": FACEBOOK_APP_SECRET,
                "fb_exchange_token": tokens["access_token"],
            },
        )

        if long_token_response.status_code == 200:
            long_tokens = long_token_response.json()
            tokens["access_token"] = long_tokens.get("access_token", tokens["access_token"])
            tokens["expires_in"] = long_tokens.get("expires_in", 5184000)  # ~60 days

    # Save or update connection
    existing = db.query(OAuthConnection).filter(
        OAuthConnection.organization_id == user.organization_id,
        OAuthConnection.provider == "facebook",
    ).first()

    expires_at = None
    if tokens.get("expires_in"):
        expires_at = datetime.utcnow() + timedelta(seconds=tokens["expires_in"])

    if existing:
        existing.access_token = tokens["access_token"]
        existing.token_expires_at = expires_at
        existing.provider_user_id = fb_user.get("id")
        existing.provider_username = fb_user.get("name")
        existing.is_active = True
        existing.updated_at = datetime.utcnow()
    else:
        connection = OAuthConnection(
            organization_id=user.organization_id,
            user_id=user.id,
            provider="facebook",
            provider_user_id=fb_user.get("id"),
            provider_username=fb_user.get("name"),
            access_token=tokens["access_token"],
            token_expires_at=expires_at,
            scopes="pages_manage_posts,pages_read_engagement",
        )
        db.add(connection)

    db.commit()

    response.status_code = 302
    response.headers["Location"] = f"{FRONTEND_URL}/app/marketing?connected=facebook"
    return response


# ============ INSTAGRAM (VIA FACEBOOK) ============

@router.get("/instagram/connect")
async def instagram_connect(current_user: User = Depends(get_current_user)):
    """Initiate Instagram OAuth flow (via Facebook)."""
    if not FACEBOOK_APP_ID:
        raise HTTPException(status_code=500, detail="Facebook/Instagram OAuth not configured")

    state = generate_state(current_user.id, "instagram")

    params = {
        "client_id": FACEBOOK_APP_ID,
        "redirect_uri": f"{BACKEND_URL}/api/social/instagram/callback",
        "state": state,
        "scope": "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement",
    }

    url = f"https://www.facebook.com/v18.0/dialog/oauth?{urlencode(params)}"
    return {"url": url}


@router.get("/instagram/callback")
async def instagram_callback(
    code: str,
    state: str,
    response: Response,
    db: Session = Depends(get_db),
):
    """Handle Instagram OAuth callback."""
    user_id = validate_state(state, "instagram")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid state")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.organization_id:
        raise HTTPException(status_code=400, detail="User not found")

    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        token_response = await client.get(
            "https://graph.facebook.com/v18.0/oauth/access_token",
            params={
                "client_id": FACEBOOK_APP_ID,
                "client_secret": FACEBOOK_APP_SECRET,
                "redirect_uri": f"{BACKEND_URL}/api/social/instagram/callback",
                "code": code,
            },
        )

        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get access token")

        tokens = token_response.json()

        # Get Instagram business account via Facebook pages
        pages_response = await client.get(
            "https://graph.facebook.com/v18.0/me/accounts",
            params={"access_token": tokens["access_token"]},
        )

        instagram_account = None
        if pages_response.status_code == 200:
            pages = pages_response.json().get("data", [])
            for page in pages:
                # Check if page has Instagram
                ig_response = await client.get(
                    f"https://graph.facebook.com/v18.0/{page['id']}",
                    params={
                        "access_token": tokens["access_token"],
                        "fields": "instagram_business_account{id,username}",
                    },
                )
                if ig_response.status_code == 200:
                    ig_data = ig_response.json().get("instagram_business_account")
                    if ig_data:
                        instagram_account = ig_data
                        break

    if not instagram_account:
        response.status_code = 302
        response.headers["Location"] = f"{FRONTEND_URL}/app/marketing?error=no_instagram_account"
        return response

    # Save or update connection
    existing = db.query(OAuthConnection).filter(
        OAuthConnection.organization_id == user.organization_id,
        OAuthConnection.provider == "instagram",
    ).first()

    expires_at = datetime.utcnow() + timedelta(days=60)

    if existing:
        existing.access_token = tokens["access_token"]
        existing.token_expires_at = expires_at
        existing.provider_user_id = instagram_account.get("id")
        existing.provider_username = instagram_account.get("username")
        existing.is_active = True
        existing.updated_at = datetime.utcnow()
    else:
        connection = OAuthConnection(
            organization_id=user.organization_id,
            user_id=user.id,
            provider="instagram",
            provider_user_id=instagram_account.get("id"),
            provider_username=instagram_account.get("username"),
            access_token=tokens["access_token"],
            token_expires_at=expires_at,
            scopes="instagram_basic,instagram_content_publish",
        )
        db.add(connection)

    db.commit()

    response.status_code = 302
    response.headers["Location"] = f"{FRONTEND_URL}/app/marketing?connected=instagram"
    return response


# ============ SOCIAL POSTING ============

class PostRequest(BaseModel):
    content: str
    platform: str


@router.post("/post")
async def post_to_social(
    content: str,
    platform: str,
    image: Optional[bytes] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Post content to a connected social platform."""
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="No organization")

    # Get the OAuth connection
    connection = db.query(OAuthConnection).filter(
        OAuthConnection.organization_id == current_user.organization_id,
        OAuthConnection.provider == platform,
        OAuthConnection.is_active == True,
    ).first()

    if not connection:
        raise HTTPException(status_code=400, detail=f"No active {platform} connection")

    if connection.token_expires_at and connection.token_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail=f"{platform} token expired. Please reconnect.")

    try:
        async with httpx.AsyncClient() as client:
            if platform == "twitter":
                result = await post_to_twitter(client, connection.access_token, content, image)
            elif platform == "linkedin":
                result = await post_to_linkedin(client, connection, content, image)
            elif platform == "facebook":
                result = await post_to_facebook(client, connection, content, image)
            elif platform == "instagram":
                result = await post_to_instagram(client, connection, content, image)
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported platform: {platform}")

        return {"ok": True, "result": result}

    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Failed to post: {str(e)}")


async def post_to_twitter(client: httpx.AsyncClient, access_token: str, content: str, image: Optional[bytes] = None):
    """Post to Twitter/X using OAuth 2.0."""
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    payload = {"text": content}

    # Twitter v2 API tweet endpoint
    response = await client.post(
        "https://api.twitter.com/2/tweets",
        headers=headers,
        json=payload,
    )

    if response.status_code != 201:
        raise HTTPException(status_code=response.status_code, detail=f"Twitter error: {response.text}")

    return response.json()


async def post_to_linkedin(client: httpx.AsyncClient, connection: OAuthConnection, content: str, image: Optional[bytes] = None):
    """Post to LinkedIn using the new Posts API."""
    # Get user URN from userinfo
    me_response = await client.get(
        "https://api.linkedin.com/v2/userinfo",
        headers={"Authorization": f"Bearer {connection.access_token}"},
    )

    if me_response.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to get LinkedIn user info")

    user_sub = me_response.json().get("sub")
    author_urn = f"urn:li:person:{user_sub}"

    headers = {
        "Authorization": f"Bearer {connection.access_token}",
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": "202401",
    }

    # Use the new Posts API (recommended by LinkedIn)
    payload = {
        "author": author_urn,
        "lifecycleState": "PUBLISHED",
        "visibility": "PUBLIC",
        "commentary": content,
        "distribution": {
            "feedDistribution": "MAIN_FEED",
            "targetEntities": [],
            "thirdPartyDistributionChannels": []
        }
    }

    response = await client.post(
        "https://api.linkedin.com/rest/posts",
        headers=headers,
        json=payload,
    )

    if response.status_code not in [200, 201]:
        # Fallback to UGC Posts API if new API fails
        ugc_headers = {
            "Authorization": f"Bearer {connection.access_token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
        }

        ugc_payload = {
            "author": author_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": content},
                    "shareMediaCategory": "NONE",
                }
            },
            "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
        }

        response = await client.post(
            "https://api.linkedin.com/v2/ugcPosts",
            headers=ugc_headers,
            json=ugc_payload,
        )

        if response.status_code not in [200, 201]:
            raise HTTPException(status_code=response.status_code, detail=f"LinkedIn error: {response.text}")

    return response.json() if response.text else {"success": True, "id": response.headers.get("x-restli-id")}


async def post_to_facebook(client: httpx.AsyncClient, connection: OAuthConnection, content: str, image: Optional[bytes] = None):
    """Post to Facebook page."""
    # For page posts, we need to use the page access token
    # For now, post to user's feed
    response = await client.post(
        f"https://graph.facebook.com/v18.0/me/feed",
        params={
            "access_token": connection.access_token,
            "message": content,
        },
    )

    if response.status_code not in [200, 201]:
        raise HTTPException(status_code=response.status_code, detail=f"Facebook error: {response.text}")

    return response.json()


async def post_to_instagram(client: httpx.AsyncClient, connection: OAuthConnection, content: str, image: Optional[bytes] = None):
    """Post to Instagram (requires image)."""
    if not image:
        raise HTTPException(status_code=400, detail="Instagram requires an image")

    # Instagram posting requires:
    # 1. Upload image to a public URL
    # 2. Create media container
    # 3. Publish the container

    # For now, return a placeholder message
    raise HTTPException(
        status_code=501,
        detail="Instagram posting requires image hosting. Please upload your image separately and use Instagram directly."
    )
