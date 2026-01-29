"""
Teller Integration for Made4Founders
Real-time bank balances, transactions, and runway calculation.
Free tier: 1,000 connected accounts (vs Plaid's $0.10/call)
"""

import os
import logging
from datetime import datetime, timedelta, date
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
import httpx

from .database import get_db
from .models import TellerEnrollment, TellerAccount, TellerTransaction, User
from .auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/teller", tags=["teller"])

# ============================================================================
# TELLER API CONFIGURATION
# ============================================================================

TELLER_API_BASE = "https://api.teller.io"
TELLER_APPLICATION_ID = os.getenv("TELLER_APPLICATION_ID", "")
TELLER_ENVIRONMENT = os.getenv("TELLER_ENVIRONMENT", "sandbox")


def get_teller_headers(access_token: str) -> dict:
    """Get headers for Teller API requests."""
    return {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }


async def teller_request(
    method: str,
    endpoint: str,
    access_token: str,
    params: Optional[dict] = None
) -> dict:
    """Make a request to the Teller API."""
    url = f"{TELLER_API_BASE}{endpoint}"
    headers = get_teller_headers(access_token)

    async with httpx.AsyncClient() as client:
        if method == "GET":
            response = await client.get(url, headers=headers, params=params, timeout=30.0)
        elif method == "DELETE":
            response = await client.delete(url, headers=headers, timeout=30.0)
        else:
            response = await client.request(method, url, headers=headers, timeout=30.0)

        if response.status_code == 429:
            raise HTTPException(status_code=429, detail="Rate limited by Teller API")

        if response.status_code >= 400:
            logger.error(f"Teller API error: {response.status_code} - {response.text}")
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Teller API error: {response.text}"
            )

        return response.json() if response.text else {}


# ============================================================================
# SCHEMAS
# ============================================================================

class EnrollmentCreate(BaseModel):
    access_token: str
    enrollment_id: str
    institution_id: Optional[str] = None
    institution_name: Optional[str] = None


class TellerAccountResponse(BaseModel):
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


class TellerEnrollmentResponse(BaseModel):
    id: int
    enrollment_id: str
    institution_id: Optional[str]
    institution_name: Optional[str]
    sync_status: str
    last_sync_at: Optional[datetime]
    is_active: bool
    accounts: List[TellerAccountResponse] = []

    class Config:
        from_attributes = True


class TellerTransactionResponse(BaseModel):
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
    accounts: List[TellerAccountResponse]
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
async def get_teller_status():
    """Check if Teller is configured and available."""
    is_configured = bool(TELLER_APPLICATION_ID)

    return {
        "configured": is_configured,
        "environment": TELLER_ENVIRONMENT if is_configured else None,
        "application_id": TELLER_APPLICATION_ID if is_configured else None,
        "message": "Teller is ready" if is_configured else "Teller Application ID not configured"
    }


@router.post("/enrollment")
async def create_enrollment(
    data: EnrollmentCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Save enrollment from Teller Connect callback."""
    org_id = current_user.organization_id

    # Check if enrollment already exists
    existing = db.query(TellerEnrollment).filter(
        TellerEnrollment.enrollment_id == data.enrollment_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="This bank is already connected")

    # Create enrollment record
    enrollment = TellerEnrollment(
        organization_id=org_id,
        enrollment_id=data.enrollment_id,
        access_token=data.access_token,
        institution_id=data.institution_id,
        institution_name=data.institution_name,
        sync_status="pending"
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)

    # Sync accounts immediately
    await sync_accounts_for_enrollment(enrollment.id, db)

    # Schedule transaction sync in background
    background_tasks.add_task(sync_transactions_for_enrollment, enrollment.id)

    return {"status": "success", "enrollment_id": enrollment.id}


@router.get("/enrollments", response_model=List[TellerEnrollmentResponse])
async def get_enrollments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all connected Teller enrollments (banks) for the organization."""
    enrollments = db.query(TellerEnrollment).filter(
        TellerEnrollment.organization_id == current_user.organization_id,
        TellerEnrollment.is_active == True
    ).all()

    result = []
    for enrollment in enrollments:
        accounts = db.query(TellerAccount).filter(
            TellerAccount.teller_enrollment_id == enrollment.id,
            TellerAccount.is_active == True
        ).all()

        enrollment_response = TellerEnrollmentResponse(
            id=enrollment.id,
            enrollment_id=enrollment.enrollment_id,
            institution_id=enrollment.institution_id,
            institution_name=enrollment.institution_name,
            sync_status=enrollment.sync_status,
            last_sync_at=enrollment.last_sync_at,
            is_active=enrollment.is_active,
            accounts=[
                TellerAccountResponse(
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
                    institution_name=enrollment.institution_name,
                    last_sync_at=enrollment.last_sync_at
                )
                for acc in accounts
            ]
        )
        result.append(enrollment_response)

    return result


# Alias for frontend compatibility (matches Plaid endpoint naming)
@router.get("/items", response_model=List[TellerEnrollmentResponse])
async def get_items(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Alias for /enrollments to maintain frontend compatibility."""
    return await get_enrollments(current_user, db)


@router.delete("/enrollments/{enrollment_id}")
async def disconnect_enrollment(
    enrollment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disconnect a Teller enrollment (bank) and remove all associated data."""
    enrollment = db.query(TellerEnrollment).filter(
        TellerEnrollment.id == enrollment_id,
        TellerEnrollment.organization_id == current_user.organization_id
    ).first()

    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    # Remove from Teller (best effort - deletes all accounts in enrollment)
    try:
        await teller_request("DELETE", "/accounts", enrollment.access_token)
    except Exception as e:
        logger.warning(f"Failed to remove enrollment from Teller: {e}")

    # Delete from database (cascades to accounts and transactions)
    db.delete(enrollment)
    db.commit()

    return {"status": "success", "message": "Bank disconnected"}


# Alias for frontend compatibility
@router.delete("/items/{item_id}")
async def disconnect_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Alias for /enrollments/{id} to maintain frontend compatibility."""
    return await disconnect_enrollment(item_id, current_user, db)


@router.post("/sync/{enrollment_id}")
async def trigger_sync(
    enrollment_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Trigger a sync for a specific Teller enrollment."""
    enrollment = db.query(TellerEnrollment).filter(
        TellerEnrollment.id == enrollment_id,
        TellerEnrollment.organization_id == current_user.organization_id
    ).first()

    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    # Update status
    enrollment.sync_status = "syncing"
    db.commit()

    # Sync accounts
    await sync_accounts_for_enrollment(enrollment_id, db)

    # Schedule transaction sync in background
    background_tasks.add_task(sync_transactions_for_enrollment, enrollment_id)

    return {"status": "syncing"}


@router.get("/accounts", response_model=List[TellerAccountResponse])
async def get_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all linked bank accounts for the organization."""
    accounts = db.query(TellerAccount).join(TellerEnrollment).filter(
        TellerAccount.organization_id == current_user.organization_id,
        TellerAccount.is_active == True,
        TellerEnrollment.is_active == True
    ).all()

    result = []
    for acc in accounts:
        enrollment = db.query(TellerEnrollment).filter(
            TellerEnrollment.id == acc.teller_enrollment_id
        ).first()
        result.append(TellerAccountResponse(
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
            institution_name=enrollment.institution_name if enrollment else None,
            last_sync_at=enrollment.last_sync_at if enrollment else None
        ))

    return result


@router.get("/cash-position", response_model=CashPositionResponse)
async def get_cash_position(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get aggregated cash position across all linked accounts."""
    org_id = current_user.organization_id

    accounts = db.query(TellerAccount).join(TellerEnrollment).filter(
        TellerAccount.organization_id == org_id,
        TellerAccount.is_active == True,
        TellerEnrollment.is_active == True
    ).all()

    total_cash = 0.0
    total_credit_available = 0.0
    total_credit_used = 0.0
    last_updated = None

    account_responses = []

    for acc in accounts:
        enrollment = db.query(TellerEnrollment).filter(
            TellerEnrollment.id == acc.teller_enrollment_id
        ).first()

        if acc.account_type in ("depository", "investment"):
            total_cash += acc.balance_current or 0.0
        elif acc.account_type == "credit":
            limit = acc.balance_limit or 0.0
            current = acc.balance_current or 0.0
            total_credit_used += current
            total_credit_available += max(0, limit - current)

        if enrollment and enrollment.last_sync_at:
            if not last_updated or enrollment.last_sync_at > last_updated:
                last_updated = enrollment.last_sync_at

        account_responses.append(TellerAccountResponse(
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
            institution_name=enrollment.institution_name if enrollment else None,
            last_sync_at=enrollment.last_sync_at if enrollment else None
        ))

    return CashPositionResponse(
        total_cash=total_cash,
        total_credit_available=total_credit_available,
        total_credit_used=total_credit_used,
        accounts=account_responses,
        last_updated=last_updated
    )


@router.get("/transactions", response_model=List[TellerTransactionResponse])
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

    query = db.query(TellerTransaction).filter(
        TellerTransaction.organization_id == org_id,
        TellerTransaction.date >= date.today() - timedelta(days=days)
    )

    if account_id:
        query = query.filter(TellerTransaction.teller_account_id == account_id)

    if category:
        query = query.filter(TellerTransaction.category.ilike(f"%{category}%"))

    transactions = query.order_by(TellerTransaction.date.desc()).offset(offset).limit(limit).all()

    result = []
    for txn in transactions:
        account = db.query(TellerAccount).filter(
            TellerAccount.id == txn.teller_account_id
        ).first()
        result.append(TellerTransactionResponse(
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
    accounts = db.query(TellerAccount).join(TellerEnrollment).filter(
        TellerAccount.organization_id == org_id,
        TellerAccount.is_active == True,
        TellerEnrollment.is_active == True,
        TellerAccount.account_type.in_(["depository", "investment"])
    ).all()

    total_cash = sum(acc.balance_current or 0.0 for acc in accounts)

    # Get transactions for the specified period
    start_date = date.today() - timedelta(days=months * 30)
    transactions = db.query(TellerTransaction).filter(
        TellerTransaction.organization_id == org_id,
        TellerTransaction.date >= start_date,
        TellerTransaction.is_excluded == False,
        TellerTransaction.pending == False
    ).all()

    # Calculate income and expenses
    # Teller: positive amount = money out (debit), negative = money in (credit)
    total_income = 0.0
    total_expenses = 0.0

    for txn in transactions:
        if txn.amount < 0:  # Negative = credit (money in)
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

    transactions = db.query(TellerTransaction).filter(
        TellerTransaction.organization_id == org_id,
        TellerTransaction.date >= start_date,
        TellerTransaction.is_excluded == False,
        TellerTransaction.pending == False
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
    txn = db.query(TellerTransaction).filter(
        TellerTransaction.id == transaction_id,
        TellerTransaction.organization_id == current_user.organization_id
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

# Teller category mapping to standardized categories
TELLER_CATEGORY_MAP = {
    "accommodation": "Travel",
    "advertising": "Business",
    "bar": "Food and Drink",
    "charity": "Other",
    "clothing": "Shopping",
    "dining": "Food and Drink",
    "education": "Education",
    "electronics": "Shopping",
    "entertainment": "Entertainment",
    "fuel": "Transportation",
    "general": "Other",
    "groceries": "Food and Drink",
    "health": "Healthcare",
    "home": "Home",
    "income": "Income",
    "insurance": "Insurance",
    "investment": "Investment",
    "loan": "Loan Payments",
    "office": "Business",
    "phone": "Utilities",
    "service": "Services",
    "shopping": "Shopping",
    "software": "Software",
    "sport": "Entertainment",
    "tax": "Taxes",
    "transport": "Transportation",
    "transportation": "Transportation",
    "utilities": "Utilities",
}


async def sync_accounts_for_enrollment(enrollment_id: int, db: Session):
    """Sync accounts for a Teller enrollment."""
    from .database import SessionLocal

    # Use new session for background task
    db = SessionLocal()

    try:
        enrollment = db.query(TellerEnrollment).filter(
            TellerEnrollment.id == enrollment_id
        ).first()
        if not enrollment:
            return

        # Fetch accounts from Teller API
        accounts_data = await teller_request(
            "GET", "/accounts", enrollment.access_token
        )

        for acc_data in accounts_data:
            account_id = acc_data.get("id")

            # Check if account exists
            existing = db.query(TellerAccount).filter(
                TellerAccount.account_id == account_id
            ).first()

            # Fetch balance for this account
            try:
                balance_data = await teller_request(
                    "GET", f"/accounts/{account_id}/balances", enrollment.access_token
                )
                ledger_balance = float(balance_data.get("ledger") or 0)
                available_balance = float(balance_data.get("available") or 0)
            except Exception as e:
                logger.warning(f"Failed to fetch balance for account {account_id}: {e}")
                ledger_balance = None
                available_balance = None

            institution = acc_data.get("institution", {})

            if existing:
                # Update balances
                existing.balance_current = ledger_balance
                existing.balance_available = available_balance
                existing.updated_at = datetime.utcnow()
            else:
                # Create new account
                new_account = TellerAccount(
                    organization_id=enrollment.organization_id,
                    teller_enrollment_id=enrollment.id,
                    account_id=account_id,
                    name=acc_data.get("name"),
                    official_name=acc_data.get("name"),  # Teller doesn't have official_name
                    mask=acc_data.get("last_four"),
                    account_type=acc_data.get("type"),
                    account_subtype=acc_data.get("subtype"),
                    balance_available=available_balance,
                    balance_current=ledger_balance,
                    balance_limit=None,  # Teller doesn't return limit in accounts
                    iso_currency_code=acc_data.get("currency", "USD")
                )
                db.add(new_account)

        enrollment.last_sync_at = datetime.utcnow()
        enrollment.sync_status = "synced"
        enrollment.sync_error = None
        db.commit()

    except Exception as e:
        logger.error(f"Failed to sync accounts for enrollment {enrollment_id}: {e}")
        enrollment = db.query(TellerEnrollment).filter(
            TellerEnrollment.id == enrollment_id
        ).first()
        if enrollment:
            enrollment.sync_status = "error"
            enrollment.sync_error = str(e)
            db.commit()
    finally:
        db.close()


def sync_transactions_for_enrollment(enrollment_id: int):
    """Sync transactions for a Teller enrollment (runs in background)."""
    import asyncio
    from .database import SessionLocal

    db = SessionLocal()

    try:
        enrollment = db.query(TellerEnrollment).filter(
            TellerEnrollment.id == enrollment_id
        ).first()
        if not enrollment:
            return

        # Get all accounts for this enrollment
        accounts = db.query(TellerAccount).filter(
            TellerAccount.teller_enrollment_id == enrollment_id,
            TellerAccount.is_active == True
        ).all()

        added_count = 0

        for account in accounts:
            try:
                # Fetch transactions from Teller API
                # Get last 90 days of transactions
                start_date = (date.today() - timedelta(days=90)).isoformat()

                transactions_data = asyncio.get_event_loop().run_until_complete(
                    teller_request(
                        "GET",
                        f"/accounts/{account.account_id}/transactions",
                        enrollment.access_token,
                        params={"count": 500, "start_date": start_date}
                    )
                )

                for txn_data in transactions_data:
                    txn_id = txn_data.get("id")

                    # Check if transaction exists
                    existing = db.query(TellerTransaction).filter(
                        TellerTransaction.transaction_id == txn_id
                    ).first()

                    if not existing:
                        # Parse amount (Teller returns string)
                        amount_str = txn_data.get("amount", "0")
                        amount = float(amount_str) if amount_str else 0.0

                        # Get category from details
                        details = txn_data.get("details", {})
                        raw_category = details.get("category")
                        mapped_category = TELLER_CATEGORY_MAP.get(raw_category, raw_category)

                        # Get counterparty info
                        counterparty = details.get("counterparty", {})
                        merchant_name = counterparty.get("name")

                        new_txn = TellerTransaction(
                            organization_id=enrollment.organization_id,
                            teller_account_id=account.id,
                            transaction_id=txn_id,
                            amount=amount,
                            iso_currency_code="USD",
                            date=datetime.strptime(txn_data.get("date"), "%Y-%m-%d").date(),
                            name=txn_data.get("description"),
                            merchant_name=merchant_name,
                            category=mapped_category,
                            personal_finance_category=raw_category,
                            pending=txn_data.get("status") != "posted",
                        )
                        db.add(new_txn)
                        added_count += 1

            except Exception as e:
                logger.error(f"Failed to sync transactions for account {account.account_id}: {e}")
                continue

        # Update status
        enrollment.last_sync_at = datetime.utcnow()
        enrollment.sync_status = "synced"
        enrollment.sync_error = None
        db.commit()

        logger.info(f"Synced enrollment {enrollment_id}: +{added_count} transactions")

    except Exception as e:
        logger.error(f"Failed to sync transactions for enrollment {enrollment_id}: {e}")
        enrollment = db.query(TellerEnrollment).filter(
            TellerEnrollment.id == enrollment_id
        ).first()
        if enrollment:
            enrollment.sync_status = "error"
            enrollment.sync_error = str(e)
            db.commit()
    finally:
        db.close()
