"""
Accounting Software OAuth integrations.

Supports:
- QuickBooks Online OAuth 2.0
- Xero OAuth 2.0
- FreshBooks OAuth 2.0
- Wave (GraphQL API with OAuth)
- Zoho Books OAuth 2.0
"""
import os
import secrets
import httpx
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Any, Callable, TypeVar
from urllib.parse import urlencode
import base64
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query

logger = logging.getLogger(__name__)

T = TypeVar('T')


def log_intuit_tid(response: httpx.Response, context: str = ""):
    """
    Extract and log the intuit_tid from Intuit API response headers.
    This transaction ID helps Intuit support troubleshoot issues.
    """
    intuit_tid = response.headers.get("intuit_tid")
    if intuit_tid:
        logger.info(f"Intuit TID [{context}]: {intuit_tid}")
        if response.status_code >= 400:
            logger.error(f"Intuit API error - TID: {intuit_tid}, Status: {response.status_code}, Context: {context}")
    return intuit_tid


# Intuit Discovery Document cache
_intuit_discovery_cache: dict = {}
_intuit_discovery_cache_time: datetime = None
INTUIT_DISCOVERY_URL = "https://developer.intuit.com/.well-known/openid_configuration"
DISCOVERY_CACHE_TTL = 3600  # Cache for 1 hour


async def get_intuit_discovery() -> dict:
    """
    Fetch Intuit's OpenID Connect discovery document.
    Caches the result for 1 hour to avoid repeated requests.
    """
    global _intuit_discovery_cache, _intuit_discovery_cache_time

    # Check if cache is valid
    if _intuit_discovery_cache and _intuit_discovery_cache_time:
        cache_age = (datetime.utcnow() - _intuit_discovery_cache_time).total_seconds()
        if cache_age < DISCOVERY_CACHE_TTL:
            return _intuit_discovery_cache

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(INTUIT_DISCOVERY_URL)
            response.raise_for_status()
            _intuit_discovery_cache = response.json()
            _intuit_discovery_cache_time = datetime.utcnow()
            logger.info("Fetched Intuit discovery document successfully")
            return _intuit_discovery_cache
    except Exception as e:
        logger.warning(f"Failed to fetch Intuit discovery document: {e}. Using fallback endpoints.")
        # Return fallback endpoints if discovery fails
        return {
            "authorization_endpoint": "https://appcenter.intuit.com/connect/oauth2",
            "token_endpoint": "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
            "revocation_endpoint": "https://developer.api.intuit.com/v2/oauth2/tokens/revoke",
            "userinfo_endpoint": "https://accounts.platform.intuit.com/v1/openid_connect/userinfo",
        }


async def retry_with_backoff(
    func: Callable[..., T],
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 10.0,
    retryable_status_codes: tuple = (408, 429, 500, 502, 503, 504),
) -> T:
    """
    Retry an async function with exponential backoff.

    Args:
        func: Async function to retry
        max_retries: Maximum number of retry attempts (default: 3)
        base_delay: Initial delay in seconds (default: 1.0)
        max_delay: Maximum delay in seconds (default: 10.0)
        retryable_status_codes: HTTP status codes that trigger a retry

    Returns:
        Result of the function call

    Raises:
        The last exception if all retries fail
    """
    last_exception = None

    for attempt in range(max_retries + 1):
        try:
            return await func()
        except httpx.HTTPStatusError as e:
            last_exception = e
            if e.response.status_code not in retryable_status_codes:
                raise
            if attempt == max_retries:
                logger.error(f"Max retries ({max_retries}) exceeded. Last error: {e}")
                raise
            delay = min(base_delay * (2 ** attempt), max_delay)
            logger.warning(f"Request failed with status {e.response.status_code}. Retrying in {delay}s (attempt {attempt + 1}/{max_retries})")
            await asyncio.sleep(delay)
        except (httpx.ConnectError, httpx.ReadTimeout, httpx.WriteTimeout) as e:
            last_exception = e
            if attempt == max_retries:
                logger.error(f"Max retries ({max_retries}) exceeded. Last error: {e}")
                raise
            delay = min(base_delay * (2 ** attempt), max_delay)
            logger.warning(f"Connection error: {e}. Retrying in {delay}s (attempt {attempt + 1}/{max_retries})")
            await asyncio.sleep(delay)

    raise last_exception
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from .database import get_db
from .models import User, AccountingConnection
from .auth import get_current_user

router = APIRouter()

# ============ CONFIGURATION ============

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8001")

# QuickBooks Online OAuth 2.0
QUICKBOOKS_CLIENT_ID = os.getenv("QUICKBOOKS_CLIENT_ID", "")
QUICKBOOKS_CLIENT_SECRET = os.getenv("QUICKBOOKS_CLIENT_SECRET", "")
QUICKBOOKS_REDIRECT_URI = f"{BACKEND_URL}/api/accounting/quickbooks/callback"
QUICKBOOKS_ENVIRONMENT = os.getenv("QUICKBOOKS_ENVIRONMENT", "sandbox")  # sandbox or production

# Xero OAuth 2.0
XERO_CLIENT_ID = os.getenv("XERO_CLIENT_ID", "")
XERO_CLIENT_SECRET = os.getenv("XERO_CLIENT_SECRET", "")
XERO_REDIRECT_URI = f"{BACKEND_URL}/api/accounting/xero/callback"

# FreshBooks OAuth 2.0
FRESHBOOKS_CLIENT_ID = os.getenv("FRESHBOOKS_CLIENT_ID", "")
FRESHBOOKS_CLIENT_SECRET = os.getenv("FRESHBOOKS_CLIENT_SECRET", "")
FRESHBOOKS_REDIRECT_URI = f"{BACKEND_URL}/api/accounting/freshbooks/callback"

# Wave (GraphQL API)
WAVE_CLIENT_ID = os.getenv("WAVE_CLIENT_ID", "")
WAVE_CLIENT_SECRET = os.getenv("WAVE_CLIENT_SECRET", "")
WAVE_REDIRECT_URI = f"{BACKEND_URL}/api/accounting/wave/callback"

# Zoho Books OAuth 2.0
ZOHO_CLIENT_ID = os.getenv("ZOHO_CLIENT_ID", "")
ZOHO_CLIENT_SECRET = os.getenv("ZOHO_CLIENT_SECRET", "")
ZOHO_REDIRECT_URI = f"{BACKEND_URL}/api/accounting/zoho/callback"
ZOHO_ACCOUNTS_URL = os.getenv("ZOHO_ACCOUNTS_URL", "https://accounts.zoho.com")  # .com, .eu, .in, etc.

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

class AccountingAccountResponse(BaseModel):
    id: int
    provider: str
    company_name: Optional[str]
    company_id: Optional[str]
    is_active: bool
    last_sync_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class ConnectedAccountingResponse(BaseModel):
    quickbooks: Optional[AccountingAccountResponse] = None
    xero: Optional[AccountingAccountResponse] = None
    freshbooks: Optional[AccountingAccountResponse] = None
    wave: Optional[AccountingAccountResponse] = None
    zoho: Optional[AccountingAccountResponse] = None


class FinancialSummary(BaseModel):
    revenue: float = 0.0
    expenses: float = 0.0
    profit: float = 0.0
    outstanding_invoices: float = 0.0
    overdue_invoices: float = 0.0
    cash_balance: float = 0.0
    accounts_payable: float = 0.0
    accounts_receivable: float = 0.0
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None


# ============ CONNECTED ACCOUNTS ============

@router.get("/accounts", response_model=ConnectedAccountingResponse)
async def get_connected_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all connected accounting accounts for the user's organization."""
    connections = db.query(AccountingConnection).filter(
        AccountingConnection.organization_id == current_user.organization_id,
        AccountingConnection.is_active == True,
    ).all()

    result = ConnectedAccountingResponse()
    for conn in connections:
        account_data = AccountingAccountResponse.model_validate(conn)
        setattr(result, conn.provider, account_data)

    return result


@router.delete("/accounts/{provider}")
async def disconnect_account(
    provider: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Disconnect an accounting provider."""
    connection = db.query(AccountingConnection).filter(
        AccountingConnection.organization_id == current_user.organization_id,
        AccountingConnection.provider == provider,
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    db.delete(connection)
    db.commit()

    return {"status": "disconnected", "provider": provider}


# ============ QUICKBOOKS ONLINE ============

@router.get("/quickbooks/connect")
async def quickbooks_connect(
    current_user: User = Depends(get_current_user),
):
    """Initiate QuickBooks OAuth flow using Intuit discovery document."""
    if not QUICKBOOKS_CLIENT_ID:
        raise HTTPException(status_code=400, detail="QuickBooks not configured")

    state = generate_state(current_user.id, "quickbooks")

    # Get authorization endpoint from discovery document
    discovery = await get_intuit_discovery()
    auth_endpoint = discovery.get("authorization_endpoint", "https://appcenter.intuit.com/connect/oauth2")

    params = {
        "client_id": QUICKBOOKS_CLIENT_ID,
        "response_type": "code",
        "scope": "com.intuit.quickbooks.accounting",
        "redirect_uri": QUICKBOOKS_REDIRECT_URI,
        "state": state,
    }

    return {"url": f"{auth_endpoint}?{urlencode(params)}"}


@router.get("/quickbooks/callback")
async def quickbooks_callback(
    code: str = Query(...),
    state: str = Query(...),
    realmId: str = Query(...),  # QuickBooks company ID
    db: Session = Depends(get_db),
):
    """Handle QuickBooks OAuth callback."""
    user_id = validate_state(state, "quickbooks")
    if not user_id:
        return RedirectResponse(f"{FRONTEND_URL}/app/banking?error=Invalid+state")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return RedirectResponse(f"{FRONTEND_URL}/app/banking?error=User+not+found")

    try:
        # Get token endpoint from discovery document
        discovery = await get_intuit_discovery()
        token_url = discovery.get("token_endpoint", "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer")

        auth_header = base64.b64encode(
            f"{QUICKBOOKS_CLIENT_ID}:{QUICKBOOKS_CLIENT_SECRET}".encode()
        ).decode()

        async with httpx.AsyncClient(timeout=30.0) as client:
            async def exchange_token():
                response = await client.post(
                    token_url,
                    headers={
                        "Authorization": f"Basic {auth_header}",
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    data={
                        "grant_type": "authorization_code",
                        "code": code,
                        "redirect_uri": QUICKBOOKS_REDIRECT_URI,
                    },
                )
                log_intuit_tid(response, "token_exchange")
                response.raise_for_status()
                return response.json()

            tokens = await retry_with_backoff(exchange_token)

            # Get company info
            base_api = "https://sandbox-quickbooks.api.intuit.com" if QUICKBOOKS_ENVIRONMENT == "sandbox" else "https://quickbooks.api.intuit.com"
            company_response = await client.get(
                f"{base_api}/v3/company/{realmId}/companyinfo/{realmId}",
                headers={"Authorization": f"Bearer {tokens['access_token']}"},
            )
            log_intuit_tid(company_response, "company_info")
            company_info = company_response.json().get("CompanyInfo", {}) if company_response.status_code == 200 else {}

        # Save or update connection
        existing = db.query(AccountingConnection).filter(
            AccountingConnection.organization_id == user.organization_id,
            AccountingConnection.provider == "quickbooks",
        ).first()

        if existing:
            existing.access_token = tokens["access_token"]
            existing.refresh_token = tokens.get("refresh_token")
            existing.token_expires_at = datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 3600))
            existing.company_id = realmId
            existing.company_name = company_info.get("CompanyName", "QuickBooks Company")
            existing.is_active = True
        else:
            connection = AccountingConnection(
                organization_id=user.organization_id,
                user_id=user.id,
                provider="quickbooks",
                company_id=realmId,
                company_name=company_info.get("CompanyName", "QuickBooks Company"),
                access_token=tokens["access_token"],
                refresh_token=tokens.get("refresh_token"),
                token_expires_at=datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 3600)),
                is_active=True,
            )
            db.add(connection)

        db.commit()
        return RedirectResponse(f"{FRONTEND_URL}/app/banking?connected=QuickBooks")

    except Exception as e:
        print(f"QuickBooks OAuth error: {e}")
        return RedirectResponse(f"{FRONTEND_URL}/app/banking?error=QuickBooks+connection+failed")


# ============ XERO ============

@router.get("/xero/connect")
async def xero_connect(
    current_user: User = Depends(get_current_user),
):
    """Initiate Xero OAuth flow."""
    if not XERO_CLIENT_ID:
        raise HTTPException(status_code=400, detail="Xero not configured")

    state = generate_state(current_user.id, "xero")

    params = {
        "response_type": "code",
        "client_id": XERO_CLIENT_ID,
        "redirect_uri": XERO_REDIRECT_URI,
        "scope": "openid profile email accounting.transactions accounting.contacts accounting.settings offline_access",
        "state": state,
    }

    return {"url": f"https://login.xero.com/identity/connect/authorize?{urlencode(params)}"}


@router.get("/xero/callback")
async def xero_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
):
    """Handle Xero OAuth callback."""
    user_id = validate_state(state, "xero")
    if not user_id:
        return RedirectResponse(f"{FRONTEND_URL}/app/banking?error=Invalid+state")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return RedirectResponse(f"{FRONTEND_URL}/app/banking?error=User+not+found")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Exchange code for tokens with retry
            async def exchange_token():
                response = await client.post(
                    "https://identity.xero.com/connect/token",
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                    data={
                        "grant_type": "authorization_code",
                        "code": code,
                        "redirect_uri": XERO_REDIRECT_URI,
                        "client_id": XERO_CLIENT_ID,
                        "client_secret": XERO_CLIENT_SECRET,
                    },
                )
                response.raise_for_status()
                return response.json()

            tokens = await retry_with_backoff(exchange_token)

            # Get tenant (organization) info
            connections_response = await client.get(
                "https://api.xero.com/connections",
                headers={"Authorization": f"Bearer {tokens['access_token']}"},
            )
            tenants = connections_response.json() if connections_response.status_code == 200 else []
            tenant = tenants[0] if tenants else {}

        # Save connection
        existing = db.query(AccountingConnection).filter(
            AccountingConnection.organization_id == user.organization_id,
            AccountingConnection.provider == "xero",
        ).first()

        if existing:
            existing.access_token = tokens["access_token"]
            existing.refresh_token = tokens.get("refresh_token")
            existing.token_expires_at = datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 1800))
            existing.company_id = tenant.get("tenantId")
            existing.company_name = tenant.get("tenantName", "Xero Organization")
            existing.is_active = True
        else:
            connection = AccountingConnection(
                organization_id=user.organization_id,
                user_id=user.id,
                provider="xero",
                company_id=tenant.get("tenantId"),
                company_name=tenant.get("tenantName", "Xero Organization"),
                access_token=tokens["access_token"],
                refresh_token=tokens.get("refresh_token"),
                token_expires_at=datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 1800)),
                is_active=True,
            )
            db.add(connection)

        db.commit()
        return RedirectResponse(f"{FRONTEND_URL}/app/banking?connected=Xero")

    except Exception as e:
        print(f"Xero OAuth error: {e}")
        return RedirectResponse(f"{FRONTEND_URL}/app/banking?error=Xero+connection+failed")


# ============ FRESHBOOKS ============

@router.get("/freshbooks/connect")
async def freshbooks_connect(
    current_user: User = Depends(get_current_user),
):
    """Initiate FreshBooks OAuth flow."""
    if not FRESHBOOKS_CLIENT_ID:
        raise HTTPException(status_code=400, detail="FreshBooks not configured")

    state = generate_state(current_user.id, "freshbooks")

    params = {
        "client_id": FRESHBOOKS_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": FRESHBOOKS_REDIRECT_URI,
        "state": state,
    }

    return {"url": f"https://auth.freshbooks.com/oauth/authorize?{urlencode(params)}"}


@router.get("/freshbooks/callback")
async def freshbooks_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
):
    """Handle FreshBooks OAuth callback."""
    user_id = validate_state(state, "freshbooks")
    if not user_id:
        return RedirectResponse(f"{FRONTEND_URL}/app/banking?error=Invalid+state")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return RedirectResponse(f"{FRONTEND_URL}/app/banking?error=User+not+found")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Exchange code for tokens with retry
            async def exchange_token():
                response = await client.post(
                    "https://api.freshbooks.com/auth/oauth/token",
                    headers={"Content-Type": "application/json"},
                    json={
                        "grant_type": "authorization_code",
                        "code": code,
                        "redirect_uri": FRESHBOOKS_REDIRECT_URI,
                        "client_id": FRESHBOOKS_CLIENT_ID,
                        "client_secret": FRESHBOOKS_CLIENT_SECRET,
                    },
                )
                response.raise_for_status()
                return response.json()

            tokens = await retry_with_backoff(exchange_token)

            # Get user/business info
            me_response = await client.get(
                "https://api.freshbooks.com/auth/api/v1/users/me",
                headers={"Authorization": f"Bearer {tokens['access_token']}"},
            )
            me_data = me_response.json().get("response", {}) if me_response.status_code == 200 else {}
            business = me_data.get("business_memberships", [{}])[0].get("business", {}) if me_data.get("business_memberships") else {}

        # Save connection
        existing = db.query(AccountingConnection).filter(
            AccountingConnection.organization_id == user.organization_id,
            AccountingConnection.provider == "freshbooks",
        ).first()

        if existing:
            existing.access_token = tokens["access_token"]
            existing.refresh_token = tokens.get("refresh_token")
            existing.token_expires_at = datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 43200))
            existing.company_id = str(business.get("id", ""))
            existing.company_name = business.get("name", "FreshBooks Business")
            existing.is_active = True
        else:
            connection = AccountingConnection(
                organization_id=user.organization_id,
                user_id=user.id,
                provider="freshbooks",
                company_id=str(business.get("id", "")),
                company_name=business.get("name", "FreshBooks Business"),
                access_token=tokens["access_token"],
                refresh_token=tokens.get("refresh_token"),
                token_expires_at=datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 43200)),
                is_active=True,
            )
            db.add(connection)

        db.commit()
        return RedirectResponse(f"{FRONTEND_URL}/app/banking?connected=FreshBooks")

    except Exception as e:
        print(f"FreshBooks OAuth error: {e}")
        return RedirectResponse(f"{FRONTEND_URL}/app/banking?error=FreshBooks+connection+failed")


# ============ WAVE ============

@router.get("/wave/connect")
async def wave_connect(
    current_user: User = Depends(get_current_user),
):
    """Initiate Wave OAuth flow."""
    if not WAVE_CLIENT_ID:
        raise HTTPException(status_code=400, detail="Wave not configured")

    state = generate_state(current_user.id, "wave")

    params = {
        "client_id": WAVE_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": WAVE_REDIRECT_URI,
        "scope": "business:read account:read transaction:read invoice:read",
        "state": state,
    }

    return {"url": f"https://api.waveapps.com/oauth2/authorize/?{urlencode(params)}"}


@router.get("/wave/callback")
async def wave_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
):
    """Handle Wave OAuth callback."""
    user_id = validate_state(state, "wave")
    if not user_id:
        return RedirectResponse(f"{FRONTEND_URL}/app/banking?error=Invalid+state")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return RedirectResponse(f"{FRONTEND_URL}/app/banking?error=User+not+found")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Exchange code for tokens with retry
            async def exchange_token():
                response = await client.post(
                    "https://api.waveapps.com/oauth2/token/",
                    data={
                        "grant_type": "authorization_code",
                        "code": code,
                        "redirect_uri": WAVE_REDIRECT_URI,
                        "client_id": WAVE_CLIENT_ID,
                        "client_secret": WAVE_CLIENT_SECRET,
                    },
                )
                response.raise_for_status()
                return response.json()

            tokens = await retry_with_backoff(exchange_token)

            # Get business info via GraphQL
            graphql_query = """
            query {
                businesses {
                    edges {
                        node {
                            id
                            name
                        }
                    }
                }
            }
            """
            business_response = await client.post(
                "https://gql.waveapps.com/graphql/public",
                headers={
                    "Authorization": f"Bearer {tokens['access_token']}",
                    "Content-Type": "application/json",
                },
                json={"query": graphql_query},
            )
            business_data = business_response.json() if business_response.status_code == 200 else {}
            businesses = business_data.get("data", {}).get("businesses", {}).get("edges", [])
            business = businesses[0].get("node", {}) if businesses else {}

        # Save connection
        existing = db.query(AccountingConnection).filter(
            AccountingConnection.organization_id == user.organization_id,
            AccountingConnection.provider == "wave",
        ).first()

        if existing:
            existing.access_token = tokens["access_token"]
            existing.refresh_token = tokens.get("refresh_token")
            existing.token_expires_at = datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 31536000))
            existing.company_id = business.get("id", "")
            existing.company_name = business.get("name", "Wave Business")
            existing.is_active = True
        else:
            connection = AccountingConnection(
                organization_id=user.organization_id,
                user_id=user.id,
                provider="wave",
                company_id=business.get("id", ""),
                company_name=business.get("name", "Wave Business"),
                access_token=tokens["access_token"],
                refresh_token=tokens.get("refresh_token"),
                token_expires_at=datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 31536000)),
                is_active=True,
            )
            db.add(connection)

        db.commit()
        return RedirectResponse(f"{FRONTEND_URL}/app/banking?connected=Wave")

    except Exception as e:
        print(f"Wave OAuth error: {e}")
        return RedirectResponse(f"{FRONTEND_URL}/app/banking?error=Wave+connection+failed")


# ============ ZOHO BOOKS ============

@router.get("/zoho/connect")
async def zoho_connect(
    current_user: User = Depends(get_current_user),
):
    """Initiate Zoho Books OAuth flow."""
    if not ZOHO_CLIENT_ID:
        raise HTTPException(status_code=400, detail="Zoho Books not configured")

    state = generate_state(current_user.id, "zoho")

    params = {
        "client_id": ZOHO_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": ZOHO_REDIRECT_URI,
        "scope": "ZohoBooks.fullaccess.all",
        "state": state,
        "access_type": "offline",
        "prompt": "consent",
    }

    return {"url": f"{ZOHO_ACCOUNTS_URL}/oauth/v2/auth?{urlencode(params)}"}


@router.get("/zoho/callback")
async def zoho_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
):
    """Handle Zoho Books OAuth callback."""
    user_id = validate_state(state, "zoho")
    if not user_id:
        return RedirectResponse(f"{FRONTEND_URL}/app/banking?error=Invalid+state")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return RedirectResponse(f"{FRONTEND_URL}/app/banking?error=User+not+found")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Exchange code for tokens with retry
            async def exchange_token():
                response = await client.post(
                    f"{ZOHO_ACCOUNTS_URL}/oauth/v2/token",
                    data={
                        "grant_type": "authorization_code",
                        "code": code,
                        "redirect_uri": ZOHO_REDIRECT_URI,
                        "client_id": ZOHO_CLIENT_ID,
                        "client_secret": ZOHO_CLIENT_SECRET,
                    },
                )
                response.raise_for_status()
                return response.json()

            tokens = await retry_with_backoff(exchange_token)

            # Get organizations
            org_response = await client.get(
                "https://books.zoho.com/api/v3/organizations",
                headers={"Authorization": f"Zoho-oauthtoken {tokens['access_token']}"},
            )
            org_data = org_response.json() if org_response.status_code == 200 else {}
            organizations = org_data.get("organizations", [])
            org = organizations[0] if organizations else {}

        # Save connection
        existing = db.query(AccountingConnection).filter(
            AccountingConnection.organization_id == user.organization_id,
            AccountingConnection.provider == "zoho",
        ).first()

        if existing:
            existing.access_token = tokens["access_token"]
            existing.refresh_token = tokens.get("refresh_token")
            existing.token_expires_at = datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 3600))
            existing.company_id = str(org.get("organization_id", ""))
            existing.company_name = org.get("name", "Zoho Organization")
            existing.extra_data = json.dumps({"api_domain": tokens.get("api_domain", "https://books.zoho.com")})
            existing.is_active = True
        else:
            connection = AccountingConnection(
                organization_id=user.organization_id,
                user_id=user.id,
                provider="zoho",
                company_id=str(org.get("organization_id", "")),
                company_name=org.get("name", "Zoho Organization"),
                access_token=tokens["access_token"],
                refresh_token=tokens.get("refresh_token"),
                token_expires_at=datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 3600)),
                extra_data=json.dumps({"api_domain": tokens.get("api_domain", "https://books.zoho.com")}),
                is_active=True,
            )
            db.add(connection)

        db.commit()
        return RedirectResponse(f"{FRONTEND_URL}/app/banking?connected=Zoho+Books")

    except Exception as e:
        print(f"Zoho OAuth error: {e}")
        return RedirectResponse(f"{FRONTEND_URL}/app/banking?error=Zoho+connection+failed")


# ============ DATA SYNC ENDPOINTS ============

@router.get("/sync/{provider}")
async def sync_accounting_data(
    provider: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Trigger a sync with the specified accounting provider."""
    connection = db.query(AccountingConnection).filter(
        AccountingConnection.organization_id == current_user.organization_id,
        AccountingConnection.provider == provider,
        AccountingConnection.is_active == True,
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail=f"No active {provider} connection found")

    # Check if token needs refresh
    if connection.token_expires_at and connection.token_expires_at < datetime.utcnow():
        await refresh_token(connection, db)

    # Perform sync based on provider
    summary = await fetch_financial_summary(connection)

    # Update last sync time
    connection.last_sync_at = datetime.utcnow()
    db.commit()

    return {"status": "synced", "provider": provider, "summary": summary}


@router.get("/summary", response_model=FinancialSummary)
async def get_financial_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get aggregated financial summary from all connected accounting providers."""
    connections = db.query(AccountingConnection).filter(
        AccountingConnection.organization_id == current_user.organization_id,
        AccountingConnection.is_active == True,
    ).all()

    if not connections:
        return FinancialSummary()

    # Use the first active connection for now (could aggregate multiple)
    connection = connections[0]

    try:
        return await fetch_financial_summary(connection)
    except Exception as e:
        print(f"Error fetching financial summary: {e}")
        return FinancialSummary()


async def refresh_token(connection: AccountingConnection, db: Session):
    """Refresh an expired OAuth token with retry logic."""
    if not connection.refresh_token:
        connection.is_active = False
        db.commit()
        raise HTTPException(status_code=401, detail="Token expired and no refresh token available")

    # Get Intuit token endpoint from discovery document for QuickBooks
    intuit_token_url = None
    if connection.provider == "quickbooks":
        discovery = await get_intuit_discovery()
        intuit_token_url = discovery.get("token_endpoint", "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            async def do_refresh():
                if connection.provider == "quickbooks":
                    auth_header = base64.b64encode(
                        f"{QUICKBOOKS_CLIENT_ID}:{QUICKBOOKS_CLIENT_SECRET}".encode()
                    ).decode()
                    response = await client.post(
                        intuit_token_url,
                        headers={
                            "Authorization": f"Basic {auth_header}",
                            "Content-Type": "application/x-www-form-urlencoded",
                        },
                        data={
                            "grant_type": "refresh_token",
                            "refresh_token": connection.refresh_token,
                        },
                    )
                elif connection.provider == "xero":
                    response = await client.post(
                        "https://identity.xero.com/connect/token",
                        headers={"Content-Type": "application/x-www-form-urlencoded"},
                        data={
                            "grant_type": "refresh_token",
                            "refresh_token": connection.refresh_token,
                            "client_id": XERO_CLIENT_ID,
                            "client_secret": XERO_CLIENT_SECRET,
                        },
                    )
                elif connection.provider == "freshbooks":
                    response = await client.post(
                        "https://api.freshbooks.com/auth/oauth/token",
                        headers={"Content-Type": "application/json"},
                        json={
                            "grant_type": "refresh_token",
                            "refresh_token": connection.refresh_token,
                            "client_id": FRESHBOOKS_CLIENT_ID,
                            "client_secret": FRESHBOOKS_CLIENT_SECRET,
                        },
                    )
                elif connection.provider == "zoho":
                    response = await client.post(
                        f"{ZOHO_ACCOUNTS_URL}/oauth/v2/token",
                        data={
                            "grant_type": "refresh_token",
                            "refresh_token": connection.refresh_token,
                            "client_id": ZOHO_CLIENT_ID,
                            "client_secret": ZOHO_CLIENT_SECRET,
                        },
                    )
                else:
                    # Wave tokens are long-lived, typically don't need refresh
                    return None

                # Capture intuit_tid for QuickBooks troubleshooting
                if connection.provider == "quickbooks":
                    log_intuit_tid(response, "token_refresh")

                response.raise_for_status()
                return response.json()

            tokens = await retry_with_backoff(do_refresh)

            if tokens is None:
                return

            connection.access_token = tokens["access_token"]
            if tokens.get("refresh_token"):
                connection.refresh_token = tokens["refresh_token"]
            connection.token_expires_at = datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 3600))
            db.commit()

    except Exception as e:
        logger.error(f"Token refresh error for {connection.provider}: {e}")
        connection.is_active = False
        db.commit()
        raise HTTPException(status_code=401, detail="Failed to refresh token")


async def fetch_financial_summary(connection: AccountingConnection) -> FinancialSummary:
    """Fetch financial summary from the connected accounting provider."""
    summary = FinancialSummary(
        period_start=datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0),
        period_end=datetime.utcnow(),
    )

    try:
        async with httpx.AsyncClient() as client:
            if connection.provider == "quickbooks":
                summary = await fetch_quickbooks_summary(client, connection)
            elif connection.provider == "xero":
                summary = await fetch_xero_summary(client, connection)
            elif connection.provider == "freshbooks":
                summary = await fetch_freshbooks_summary(client, connection)
            elif connection.provider == "wave":
                summary = await fetch_wave_summary(client, connection)
            elif connection.provider == "zoho":
                summary = await fetch_zoho_summary(client, connection)
    except Exception as e:
        print(f"Error fetching summary from {connection.provider}: {e}")

    return summary


async def fetch_quickbooks_summary(client: httpx.AsyncClient, connection: AccountingConnection) -> FinancialSummary:
    """Fetch financial data from QuickBooks."""
    base_url = "https://sandbox-quickbooks.api.intuit.com" if QUICKBOOKS_ENVIRONMENT == "sandbox" else "https://quickbooks.api.intuit.com"
    headers = {"Authorization": f"Bearer {connection.access_token}", "Accept": "application/json"}

    # Get profit and loss report
    pnl_response = await client.get(
        f"{base_url}/v3/company/{connection.company_id}/reports/ProfitAndLoss?date_macro=This+Month",
        headers=headers,
    )
    # Capture intuit_tid for troubleshooting
    log_intuit_tid(pnl_response, f"pnl_report_{connection.company_id}")

    summary = FinancialSummary(
        period_start=datetime.utcnow().replace(day=1),
        period_end=datetime.utcnow(),
    )

    if pnl_response.status_code == 200:
        # Parse QuickBooks report format (complex nested structure)
        data = pnl_response.json()
        # Simplified parsing - would need more robust handling
        summary.revenue = 0
        summary.expenses = 0

    return summary


async def fetch_xero_summary(client: httpx.AsyncClient, connection: AccountingConnection) -> FinancialSummary:
    """Fetch financial data from Xero."""
    headers = {
        "Authorization": f"Bearer {connection.access_token}",
        "Xero-Tenant-Id": connection.company_id,
        "Accept": "application/json",
    }

    summary = FinancialSummary(
        period_start=datetime.utcnow().replace(day=1),
        period_end=datetime.utcnow(),
    )

    # Get invoices
    invoices_response = await client.get(
        "https://api.xero.com/api.xro/2.0/Invoices?Statuses=AUTHORISED,OVERDUE",
        headers=headers,
    )

    if invoices_response.status_code == 200:
        invoices = invoices_response.json().get("Invoices", [])
        for inv in invoices:
            if inv.get("Type") == "ACCREC":  # Accounts Receivable
                summary.accounts_receivable += float(inv.get("AmountDue", 0))
                if inv.get("Status") == "OVERDUE":
                    summary.overdue_invoices += float(inv.get("AmountDue", 0))

    return summary


async def fetch_freshbooks_summary(client: httpx.AsyncClient, connection: AccountingConnection) -> FinancialSummary:
    """Fetch financial data from FreshBooks."""
    headers = {"Authorization": f"Bearer {connection.access_token}"}
    account_id = connection.company_id

    summary = FinancialSummary(
        period_start=datetime.utcnow().replace(day=1),
        period_end=datetime.utcnow(),
    )

    # Get invoices
    invoices_response = await client.get(
        f"https://api.freshbooks.com/accounting/account/{account_id}/invoices/invoices",
        headers=headers,
    )

    if invoices_response.status_code == 200:
        invoices = invoices_response.json().get("response", {}).get("result", {}).get("invoices", [])
        for inv in invoices:
            outstanding = float(inv.get("outstanding", {}).get("amount", 0))
            summary.outstanding_invoices += outstanding

    return summary


async def fetch_wave_summary(client: httpx.AsyncClient, connection: AccountingConnection) -> FinancialSummary:
    """Fetch financial data from Wave via GraphQL."""
    headers = {
        "Authorization": f"Bearer {connection.access_token}",
        "Content-Type": "application/json",
    }

    query = """
    query($businessId: ID!) {
        business(id: $businessId) {
            invoices {
                edges {
                    node {
                        status
                        amountDue {
                            value
                        }
                    }
                }
            }
        }
    }
    """

    summary = FinancialSummary(
        period_start=datetime.utcnow().replace(day=1),
        period_end=datetime.utcnow(),
    )

    response = await client.post(
        "https://gql.waveapps.com/graphql/public",
        headers=headers,
        json={"query": query, "variables": {"businessId": connection.company_id}},
    )

    if response.status_code == 200:
        data = response.json().get("data", {}).get("business", {})
        invoices = data.get("invoices", {}).get("edges", [])
        for inv in invoices:
            node = inv.get("node", {})
            if node.get("status") in ["SENT", "PARTIAL", "OVERDUE"]:
                amount = float(node.get("amountDue", {}).get("value", 0))
                summary.outstanding_invoices += amount
                if node.get("status") == "OVERDUE":
                    summary.overdue_invoices += amount

    return summary


async def fetch_zoho_summary(client: httpx.AsyncClient, connection: AccountingConnection) -> FinancialSummary:
    """Fetch financial data from Zoho Books."""
    extra_data = json.loads(connection.extra_data or "{}")
    api_domain = extra_data.get("api_domain", "https://books.zoho.com")
    headers = {"Authorization": f"Zoho-oauthtoken {connection.access_token}"}

    summary = FinancialSummary(
        period_start=datetime.utcnow().replace(day=1),
        period_end=datetime.utcnow(),
    )

    # Get invoices
    invoices_response = await client.get(
        f"{api_domain}/api/v3/invoices?organization_id={connection.company_id}&status=sent|overdue",
        headers=headers,
    )

    if invoices_response.status_code == 200:
        invoices = invoices_response.json().get("invoices", [])
        for inv in invoices:
            balance = float(inv.get("balance", 0))
            summary.outstanding_invoices += balance
            if inv.get("status") == "overdue":
                summary.overdue_invoices += balance

    return summary
