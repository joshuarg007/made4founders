"""
Plaid Integration for Made4Founders
Real-time bank balances, transactions, and runway calculation.
"""

import os
import logging
from datetime import datetime, timedelta, date
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel

import plaid
from plaid.api import plaid_api
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from plaid.model.products import Products
from plaid.model.country_code import CountryCode
from plaid.model.item_remove_request import ItemRemoveRequest
from plaid.exceptions import ApiException

from .database import get_db
from .models import PlaidItem, PlaidAccount, PlaidTransaction, User
from .auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/plaid", tags=["plaid"])

# ============================================================================
# PLAID CLIENT CONFIGURATION
# ============================================================================

def get_plaid_client():
    """Create and return Plaid API client."""
    environment = os.getenv("PLAID_ENVIRONMENT", "sandbox")

    if environment == "production":
        host = plaid.Environment.Production
    elif environment == "development":
        host = plaid.Environment.Development
    else:
        host = plaid.Environment.Sandbox

    configuration = plaid.Configuration(
        host=host,
        api_key={
            'clientId': os.getenv("PLAID_CLIENT_ID"),
            'secret': os.getenv("PLAID_SECRET"),
        }
    )

    api_client = plaid.ApiClient(configuration)
    return plaid_api.PlaidApi(api_client)


# ============================================================================
# SCHEMAS
# ============================================================================

class LinkTokenResponse(BaseModel):
    link_token: str
    expiration: str


class PublicTokenExchange(BaseModel):
    public_token: str
    institution_id: Optional[str] = None
    institution_name: Optional[str] = None


class PlaidAccountResponse(BaseModel):
    id: int
    account_id: str
    name: Optional[str]
    official_name: Optional[str]
    mask: Optional[str]
    account_type: Optional[str]
    account_subtype: Optional[str]
    balance_available: Optional[float]
    balance_current: Optional[float]
    balance_limit: Optional[float]
    iso_currency_code: str
    is_active: bool
    institution_name: Optional[str] = None
    last_sync_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PlaidItemResponse(BaseModel):
    id: int
    item_id: str
    institution_id: Optional[str]
    institution_name: Optional[str]
    sync_status: str
    last_sync_at: Optional[datetime]
    is_active: bool
    accounts: List[PlaidAccountResponse] = []

    class Config:
        from_attributes = True


class PlaidTransactionResponse(BaseModel):
    id: int
    transaction_id: str
    amount: float
    iso_currency_code: str
    date: date
    name: Optional[str]
    merchant_name: Optional[str]
    category: Optional[str]
    personal_finance_category: Optional[str]
    pending: bool
    custom_category: Optional[str]
    notes: Optional[str]
    is_excluded: bool
    account_name: Optional[str] = None

    class Config:
        from_attributes = True


class CashPositionResponse(BaseModel):
    total_cash: float
    total_credit_available: float
    total_credit_used: float
    accounts: List[PlaidAccountResponse]
    last_updated: Optional[datetime]


class RunwayResponse(BaseModel):
    monthly_burn_rate: float
    runway_months: float
    total_cash: float
    avg_monthly_income: float
    avg_monthly_expenses: float
    trend: str  # "improving", "stable", "declining"


class TransactionSummary(BaseModel):
    total_income: float
    total_expenses: float
    net: float
    by_category: Dict[str, float]
    period_start: date
    period_end: date


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/status")
async def get_plaid_status():
    """Check if Plaid is configured and available."""
    client_id = os.getenv("PLAID_CLIENT_ID")
    secret = os.getenv("PLAID_SECRET")

    is_configured = bool(client_id and secret)

    return {
        "configured": is_configured,
        "environment": os.getenv("PLAID_ENVIRONMENT", "sandbox") if is_configured else None,
        "message": "Plaid is ready" if is_configured else "Plaid credentials not configured"
    }


@router.post("/link-token", response_model=LinkTokenResponse)
async def create_link_token(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a Plaid Link token for connecting a bank account."""
    client = get_plaid_client()

    try:
        request = LinkTokenCreateRequest(
            user=LinkTokenCreateRequestUser(
                client_user_id=str(current_user.id)
            ),
            client_name="Made4Founders",
            products=[Products("transactions")],
            country_codes=[CountryCode("US")],
            language="en",
            redirect_uri=os.getenv("PLAID_REDIRECT_URI"),
        )

        response = client.link_token_create(request)

        return LinkTokenResponse(
            link_token=response.link_token,
            expiration=response.expiration.isoformat()
        )

    except ApiException as e:
        logger.error(f"Plaid link token error: {e.body}")
        raise HTTPException(status_code=500, detail="Failed to create link token")


@router.post("/exchange-token")
async def exchange_public_token(
    data: PublicTokenExchange,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Exchange public token from Plaid Link for access token and save item."""
    client = get_plaid_client()
    org_id = current_user.organization_id

    try:
        # Exchange public token for access token
        exchange_request = ItemPublicTokenExchangeRequest(
            public_token=data.public_token
        )
        exchange_response = client.item_public_token_exchange(exchange_request)

        access_token = exchange_response.access_token
        item_id = exchange_response.item_id

        # Check if item already exists
        existing_item = db.query(PlaidItem).filter(
            PlaidItem.item_id == item_id
        ).first()

        if existing_item:
            raise HTTPException(status_code=400, detail="This bank is already connected")

        # Create PlaidItem record
        plaid_item = PlaidItem(
            organization_id=org_id,
            item_id=item_id,
            access_token=access_token,
            institution_id=data.institution_id,
            institution_name=data.institution_name,
            sync_status="pending"
        )
        db.add(plaid_item)
        db.commit()
        db.refresh(plaid_item)

        # Sync accounts immediately
        await sync_accounts_for_item(plaid_item.id, db)

        # Schedule transaction sync in background
        background_tasks.add_task(sync_transactions_for_item, plaid_item.id)

        return {"status": "success", "item_id": plaid_item.id}

    except ApiException as e:
        logger.error(f"Plaid token exchange error: {e.body}")
        raise HTTPException(status_code=500, detail="Failed to connect bank account")


@router.get("/items", response_model=List[PlaidItemResponse])
async def get_connected_items(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all connected Plaid items (banks) for the organization."""
    items = db.query(PlaidItem).filter(
        PlaidItem.organization_id == current_user.organization_id,
        PlaidItem.is_active == True
    ).all()

    result = []
    for item in items:
        accounts = db.query(PlaidAccount).filter(
            PlaidAccount.plaid_item_id == item.id,
            PlaidAccount.is_active == True
        ).all()

        item_response = PlaidItemResponse(
            id=item.id,
            item_id=item.item_id,
            institution_id=item.institution_id,
            institution_name=item.institution_name,
            sync_status=item.sync_status,
            last_sync_at=item.last_sync_at,
            is_active=item.is_active,
            accounts=[
                PlaidAccountResponse(
                    id=acc.id,
                    account_id=acc.account_id,
                    name=acc.name,
                    official_name=acc.official_name,
                    mask=acc.mask,
                    account_type=acc.account_type,
                    account_subtype=acc.account_subtype,
                    balance_available=acc.balance_available,
                    balance_current=acc.balance_current,
                    balance_limit=acc.balance_limit,
                    iso_currency_code=acc.iso_currency_code,
                    is_active=acc.is_active,
                    institution_name=item.institution_name,
                    last_sync_at=item.last_sync_at
                )
                for acc in accounts
            ]
        )
        result.append(item_response)

    return result


@router.delete("/items/{item_id}")
async def disconnect_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disconnect a Plaid item (bank) and remove all associated data."""
    item = db.query(PlaidItem).filter(
        PlaidItem.id == item_id,
        PlaidItem.organization_id == current_user.organization_id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Remove from Plaid (best effort)
    try:
        client = get_plaid_client()
        remove_request = ItemRemoveRequest(access_token=item.access_token)
        client.item_remove(remove_request)
    except ApiException as e:
        logger.warning(f"Failed to remove item from Plaid: {e.body}")

    # Delete from database (cascades to accounts and transactions)
    db.delete(item)
    db.commit()

    return {"status": "success", "message": "Bank disconnected"}


@router.post("/sync/{item_id}")
async def trigger_sync(
    item_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Trigger a sync for a specific Plaid item."""
    item = db.query(PlaidItem).filter(
        PlaidItem.id == item_id,
        PlaidItem.organization_id == current_user.organization_id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Update status
    item.sync_status = "syncing"
    db.commit()

    # Sync accounts
    await sync_accounts_for_item(item_id, db)

    # Schedule transaction sync in background
    background_tasks.add_task(sync_transactions_for_item, item_id)

    return {"status": "syncing"}


@router.get("/accounts", response_model=List[PlaidAccountResponse])
async def get_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all linked bank accounts for the organization."""
    accounts = db.query(PlaidAccount).join(PlaidItem).filter(
        PlaidAccount.organization_id == current_user.organization_id,
        PlaidAccount.is_active == True,
        PlaidItem.is_active == True
    ).all()

    result = []
    for acc in accounts:
        item = db.query(PlaidItem).filter(PlaidItem.id == acc.plaid_item_id).first()
        result.append(PlaidAccountResponse(
            id=acc.id,
            account_id=acc.account_id,
            name=acc.name,
            official_name=acc.official_name,
            mask=acc.mask,
            account_type=acc.account_type,
            account_subtype=acc.account_subtype,
            balance_available=acc.balance_available,
            balance_current=acc.balance_current,
            balance_limit=acc.balance_limit,
            iso_currency_code=acc.iso_currency_code,
            is_active=acc.is_active,
            institution_name=item.institution_name if item else None,
            last_sync_at=item.last_sync_at if item else None
        ))

    return result


@router.get("/cash-position", response_model=CashPositionResponse)
async def get_cash_position(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get aggregated cash position across all linked accounts."""
    org_id = current_user.organization_id

    accounts = db.query(PlaidAccount).join(PlaidItem).filter(
        PlaidAccount.organization_id == org_id,
        PlaidAccount.is_active == True,
        PlaidItem.is_active == True
    ).all()

    total_cash = 0.0
    total_credit_available = 0.0
    total_credit_used = 0.0
    last_updated = None

    account_responses = []

    for acc in accounts:
        item = db.query(PlaidItem).filter(PlaidItem.id == acc.plaid_item_id).first()

        if acc.account_type in ("depository", "investment"):
            total_cash += acc.balance_current or 0.0
        elif acc.account_type == "credit":
            limit = acc.balance_limit or 0.0
            current = acc.balance_current or 0.0
            total_credit_used += current
            total_credit_available += max(0, limit - current)

        if item and item.last_sync_at:
            if not last_updated or item.last_sync_at > last_updated:
                last_updated = item.last_sync_at

        account_responses.append(PlaidAccountResponse(
            id=acc.id,
            account_id=acc.account_id,
            name=acc.name,
            official_name=acc.official_name,
            mask=acc.mask,
            account_type=acc.account_type,
            account_subtype=acc.account_subtype,
            balance_available=acc.balance_available,
            balance_current=acc.balance_current,
            balance_limit=acc.balance_limit,
            iso_currency_code=acc.iso_currency_code,
            is_active=acc.is_active,
            institution_name=item.institution_name if item else None,
            last_sync_at=item.last_sync_at if item else None
        ))

    return CashPositionResponse(
        total_cash=total_cash,
        total_credit_available=total_credit_available,
        total_credit_used=total_credit_used,
        accounts=account_responses,
        last_updated=last_updated
    )


@router.get("/transactions", response_model=List[PlaidTransactionResponse])
async def get_transactions(
    days: int = 30,
    account_id: Optional[int] = None,
    category: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get transactions for the organization."""
    org_id = current_user.organization_id

    query = db.query(PlaidTransaction).filter(
        PlaidTransaction.organization_id == org_id,
        PlaidTransaction.date >= date.today() - timedelta(days=days)
    )

    if account_id:
        query = query.filter(PlaidTransaction.plaid_account_id == account_id)

    if category:
        query = query.filter(PlaidTransaction.category.ilike(f"%{category}%"))

    transactions = query.order_by(PlaidTransaction.date.desc()).offset(offset).limit(limit).all()

    result = []
    for txn in transactions:
        account = db.query(PlaidAccount).filter(PlaidAccount.id == txn.plaid_account_id).first()
        result.append(PlaidTransactionResponse(
            id=txn.id,
            transaction_id=txn.transaction_id,
            amount=txn.amount,
            iso_currency_code=txn.iso_currency_code,
            date=txn.date,
            name=txn.name,
            merchant_name=txn.merchant_name,
            category=txn.category,
            personal_finance_category=txn.personal_finance_category,
            pending=txn.pending,
            custom_category=txn.custom_category,
            notes=txn.notes,
            is_excluded=txn.is_excluded,
            account_name=account.name if account else None
        ))

    return result


@router.get("/runway", response_model=RunwayResponse)
async def get_runway(
    months: int = 3,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Calculate runway based on burn rate from recent transactions."""
    org_id = current_user.organization_id

    # Get total cash position
    accounts = db.query(PlaidAccount).join(PlaidItem).filter(
        PlaidAccount.organization_id == org_id,
        PlaidAccount.is_active == True,
        PlaidItem.is_active == True,
        PlaidAccount.account_type.in_(["depository", "investment"])
    ).all()

    total_cash = sum(acc.balance_current or 0.0 for acc in accounts)

    # Get transactions for the specified period
    start_date = date.today() - timedelta(days=months * 30)
    transactions = db.query(PlaidTransaction).filter(
        PlaidTransaction.organization_id == org_id,
        PlaidTransaction.date >= start_date,
        PlaidTransaction.is_excluded == False,
        PlaidTransaction.pending == False
    ).all()

    # Calculate income and expenses
    total_income = 0.0
    total_expenses = 0.0

    for txn in transactions:
        if txn.amount < 0:  # Plaid: negative = credit (money in)
            total_income += abs(txn.amount)
        else:  # Positive = debit (money out)
            total_expenses += txn.amount

    # Calculate monthly averages
    avg_monthly_income = total_income / months
    avg_monthly_expenses = total_expenses / months
    monthly_burn_rate = avg_monthly_expenses - avg_monthly_income

    # Calculate runway
    if monthly_burn_rate > 0:
        runway_months = total_cash / monthly_burn_rate
    else:
        runway_months = float('inf')  # Profitable!

    # Determine trend (compare first half to second half)
    midpoint = start_date + timedelta(days=(months * 30) // 2)

    first_half_expenses = sum(
        txn.amount for txn in transactions
        if txn.date < midpoint and txn.amount > 0
    )
    second_half_expenses = sum(
        txn.amount for txn in transactions
        if txn.date >= midpoint and txn.amount > 0
    )

    if first_half_expenses > 0:
        change_pct = (second_half_expenses - first_half_expenses) / first_half_expenses
        if change_pct < -0.1:
            trend = "improving"
        elif change_pct > 0.1:
            trend = "declining"
        else:
            trend = "stable"
    else:
        trend = "stable"

    return RunwayResponse(
        monthly_burn_rate=monthly_burn_rate,
        runway_months=min(runway_months, 999),  # Cap at 999 for display
        total_cash=total_cash,
        avg_monthly_income=avg_monthly_income,
        avg_monthly_expenses=avg_monthly_expenses,
        trend=trend
    )


@router.get("/summary", response_model=TransactionSummary)
async def get_transaction_summary(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get transaction summary with category breakdown."""
    org_id = current_user.organization_id
    start_date = date.today() - timedelta(days=days)

    transactions = db.query(PlaidTransaction).filter(
        PlaidTransaction.organization_id == org_id,
        PlaidTransaction.date >= start_date,
        PlaidTransaction.is_excluded == False,
        PlaidTransaction.pending == False
    ).all()

    total_income = 0.0
    total_expenses = 0.0
    by_category: Dict[str, float] = {}

    for txn in transactions:
        category = txn.custom_category or txn.personal_finance_category or txn.category or "Uncategorized"

        if txn.amount < 0:
            total_income += abs(txn.amount)
        else:
            total_expenses += txn.amount
            by_category[category] = by_category.get(category, 0) + txn.amount

    return TransactionSummary(
        total_income=total_income,
        total_expenses=total_expenses,
        net=total_income - total_expenses,
        by_category=by_category,
        period_start=start_date,
        period_end=date.today()
    )


@router.patch("/transactions/{transaction_id}")
async def update_transaction(
    transaction_id: int,
    custom_category: Optional[str] = None,
    notes: Optional[str] = None,
    is_excluded: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update transaction with custom category, notes, or exclusion."""
    txn = db.query(PlaidTransaction).filter(
        PlaidTransaction.id == transaction_id,
        PlaidTransaction.organization_id == current_user.organization_id
    ).first()

    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if custom_category is not None:
        txn.custom_category = custom_category
    if notes is not None:
        txn.notes = notes
    if is_excluded is not None:
        txn.is_excluded = is_excluded

    txn.updated_at = datetime.utcnow()
    db.commit()

    return {"status": "success"}


# ============================================================================
# SYNC FUNCTIONS
# ============================================================================

async def sync_accounts_for_item(item_id: int, db: Session):
    """Sync accounts for a Plaid item."""
    from .database import SessionLocal

    # Use new session for background task
    db = SessionLocal()

    try:
        item = db.query(PlaidItem).filter(PlaidItem.id == item_id).first()
        if not item:
            return

        client = get_plaid_client()

        request = AccountsGetRequest(access_token=item.access_token)
        response = client.accounts_get(request)

        for acc_data in response.accounts:
            # Check if account exists
            existing = db.query(PlaidAccount).filter(
                PlaidAccount.account_id == acc_data.account_id
            ).first()

            if existing:
                # Update balances
                existing.balance_available = acc_data.balances.available
                existing.balance_current = acc_data.balances.current
                existing.balance_limit = acc_data.balances.limit
                existing.updated_at = datetime.utcnow()
            else:
                # Create new account
                new_account = PlaidAccount(
                    organization_id=item.organization_id,
                    plaid_item_id=item.id,
                    account_id=acc_data.account_id,
                    name=acc_data.name,
                    official_name=acc_data.official_name,
                    mask=acc_data.mask,
                    account_type=str(acc_data.type) if acc_data.type else None,
                    account_subtype=str(acc_data.subtype) if acc_data.subtype else None,
                    balance_available=acc_data.balances.available,
                    balance_current=acc_data.balances.current,
                    balance_limit=acc_data.balances.limit,
                    iso_currency_code=acc_data.balances.iso_currency_code or "USD"
                )
                db.add(new_account)

        item.last_sync_at = datetime.utcnow()
        item.sync_status = "synced"
        item.sync_error = None
        db.commit()

    except ApiException as e:
        logger.error(f"Failed to sync accounts for item {item_id}: {e.body}")
        item = db.query(PlaidItem).filter(PlaidItem.id == item_id).first()
        if item:
            item.sync_status = "error"
            item.sync_error = str(e.body)
            db.commit()
    finally:
        db.close()


def sync_transactions_for_item(item_id: int):
    """Sync transactions for a Plaid item (runs in background)."""
    from .database import SessionLocal

    db = SessionLocal()

    try:
        item = db.query(PlaidItem).filter(PlaidItem.id == item_id).first()
        if not item:
            return

        client = get_plaid_client()

        has_more = True
        cursor = item.cursor
        added_count = 0
        modified_count = 0
        removed_count = 0

        while has_more:
            request = TransactionsSyncRequest(
                access_token=item.access_token,
                cursor=cursor,
                count=500
            )
            response = client.transactions_sync(request)

            # Process added transactions
            for txn_data in response.added:
                existing = db.query(PlaidTransaction).filter(
                    PlaidTransaction.transaction_id == txn_data.transaction_id
                ).first()

                if not existing:
                    # Find the account
                    account = db.query(PlaidAccount).filter(
                        PlaidAccount.account_id == txn_data.account_id
                    ).first()

                    if account:
                        new_txn = PlaidTransaction(
                            organization_id=item.organization_id,
                            plaid_account_id=account.id,
                            transaction_id=txn_data.transaction_id,
                            amount=txn_data.amount,
                            iso_currency_code=txn_data.iso_currency_code or "USD",
                            date=txn_data.date,
                            datetime_posted=txn_data.datetime if hasattr(txn_data, 'datetime') else None,
                            name=txn_data.name,
                            merchant_name=txn_data.merchant_name,
                            category=txn_data.category[0] if txn_data.category else None,
                            category_detailed=", ".join(txn_data.category) if txn_data.category else None,
                            personal_finance_category=txn_data.personal_finance_category.primary if hasattr(txn_data, 'personal_finance_category') and txn_data.personal_finance_category else None,
                            pending=txn_data.pending,
                            location_city=txn_data.location.city if txn_data.location else None,
                            location_state=txn_data.location.region if txn_data.location else None
                        )
                        db.add(new_txn)
                        added_count += 1

            # Process modified transactions
            for txn_data in response.modified:
                existing = db.query(PlaidTransaction).filter(
                    PlaidTransaction.transaction_id == txn_data.transaction_id
                ).first()

                if existing:
                    existing.amount = txn_data.amount
                    existing.name = txn_data.name
                    existing.merchant_name = txn_data.merchant_name
                    existing.pending = txn_data.pending
                    existing.updated_at = datetime.utcnow()
                    modified_count += 1

            # Process removed transactions
            for removed_txn in response.removed:
                existing = db.query(PlaidTransaction).filter(
                    PlaidTransaction.transaction_id == removed_txn.transaction_id
                ).first()

                if existing:
                    db.delete(existing)
                    removed_count += 1

            cursor = response.next_cursor
            has_more = response.has_more

        # Update cursor and status
        item.cursor = cursor
        item.last_sync_at = datetime.utcnow()
        item.sync_status = "synced"
        item.sync_error = None
        db.commit()

        logger.info(f"Synced item {item_id}: +{added_count} ~{modified_count} -{removed_count}")

    except ApiException as e:
        logger.error(f"Failed to sync transactions for item {item_id}: {e.body}")
        item = db.query(PlaidItem).filter(PlaidItem.id == item_id).first()
        if item:
            item.sync_status = "error"
            item.sync_error = str(e.body)
            db.commit()
    finally:
        db.close()
