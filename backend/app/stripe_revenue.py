"""
Stripe Revenue Integration for Made4Founders
Connect user's Stripe account to pull revenue metrics (MRR, ARR, churn).
"""

import os
import logging
from datetime import datetime, timedelta, date
from typing import Optional, List, Dict, Any
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

import stripe
from stripe.error import StripeError

from .database import get_db
from .models import User, StripeConnection, StripeCustomerSync, StripeSubscriptionSync
from .auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/stripe-revenue", tags=["stripe-revenue"])

# ============================================================================
# CONFIGURATION
# ============================================================================

STRIPE_CLIENT_ID = os.getenv("STRIPE_CONNECT_CLIENT_ID", "")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


# ============================================================================
# SCHEMAS
# ============================================================================

class StripeConnectionResponse(BaseModel):
    id: int
    stripe_account_id: str
    account_name: Optional[str]
    is_active: bool
    last_sync_at: Optional[datetime]
    sync_status: str
    created_at: datetime

    class Config:
        from_attributes = True


class RevenueMetrics(BaseModel):
    mrr: float  # Monthly Recurring Revenue
    arr: float  # Annual Recurring Revenue
    total_revenue_30d: float
    total_revenue_90d: float
    active_subscriptions: int
    total_customers: int
    new_customers_30d: int
    churned_subscriptions_30d: int
    churn_rate: float  # Percentage
    average_revenue_per_customer: float
    growth_rate_mom: float  # Month-over-month growth %


class RevenueChartData(BaseModel):
    labels: List[str]  # Date labels
    mrr: List[float]
    revenue: List[float]
    customers: List[int]


class SubscriptionBreakdown(BaseModel):
    plan_name: str
    count: int
    mrr: float
    percentage: float


class TopCustomer(BaseModel):
    customer_id: str
    email: Optional[str]
    name: Optional[str]
    total_revenue: float
    subscription_count: int
    status: str


class RevenueDashboard(BaseModel):
    metrics: RevenueMetrics
    chart_data: RevenueChartData
    subscription_breakdown: List[SubscriptionBreakdown]
    top_customers: List[TopCustomer]
    last_updated: Optional[datetime]


# ============================================================================
# OAUTH FLOW
# ============================================================================

@router.get("/connect")
async def get_connect_url(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get Stripe Connect OAuth URL for connecting user's Stripe account."""
    if not STRIPE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Stripe Connect not configured")

    # Check if already connected
    existing = db.query(StripeConnection).filter(
        StripeConnection.organization_id == current_user.organization_id,
        StripeConnection.is_active == True
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Stripe account already connected")

    # Build OAuth URL
    state = f"{current_user.organization_id}"
    redirect_uri = f"{FRONTEND_URL}/app/integrations?stripe_callback=1"

    oauth_url = (
        f"https://connect.stripe.com/oauth/authorize"
        f"?response_type=code"
        f"&client_id={STRIPE_CLIENT_ID}"
        f"&scope=read_only"
        f"&state={state}"
        f"&redirect_uri={redirect_uri}"
    )

    return {"url": oauth_url}


@router.get("/callback")
async def oauth_callback(
    code: str,
    state: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Handle Stripe Connect OAuth callback."""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    org_id = current_user.organization_id

    # Verify state matches
    if state != str(org_id):
        raise HTTPException(status_code=400, detail="Invalid state parameter")

    try:
        # Exchange code for access token
        stripe.api_key = STRIPE_SECRET_KEY
        response = stripe.OAuth.token(
            grant_type="authorization_code",
            code=code,
        )

        stripe_account_id = response.get("stripe_user_id")
        access_token = response.get("access_token")
        refresh_token = response.get("refresh_token")

        if not stripe_account_id or not access_token:
            raise HTTPException(status_code=400, detail="Failed to connect Stripe account")

        # Get account details
        account = stripe.Account.retrieve(stripe_account_id)
        account_name = account.get("business_profile", {}).get("name") or account.get("email")

        # Check if this account is already connected
        existing = db.query(StripeConnection).filter(
            StripeConnection.stripe_account_id == stripe_account_id
        ).first()

        if existing:
            if existing.organization_id != org_id:
                raise HTTPException(
                    status_code=400,
                    detail="This Stripe account is connected to another organization"
                )
            # Reactivate existing connection
            existing.access_token = access_token
            existing.refresh_token = refresh_token
            existing.is_active = True
            existing.sync_status = "pending"
            existing.updated_at = datetime.utcnow()
            db.commit()
            connection = existing
        else:
            # Create new connection
            connection = StripeConnection(
                organization_id=org_id,
                stripe_account_id=stripe_account_id,
                access_token=access_token,
                refresh_token=refresh_token,
                account_name=account_name,
                sync_status="pending"
            )
            db.add(connection)
            db.commit()
            db.refresh(connection)

        # Schedule initial sync in background
        background_tasks.add_task(sync_stripe_data, connection.id)

        return {"status": "success", "account_name": account_name}

    except StripeError as e:
        logger.error(f"Stripe OAuth error: {e}")
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")


@router.delete("/disconnect")
async def disconnect_stripe(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disconnect Stripe account and remove synced data."""
    connection = db.query(StripeConnection).filter(
        StripeConnection.organization_id == current_user.organization_id,
        StripeConnection.is_active == True
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="No Stripe account connected")

    # Revoke OAuth access (best effort)
    try:
        stripe.api_key = STRIPE_SECRET_KEY
        stripe.OAuth.deauthorize(
            client_id=STRIPE_CLIENT_ID,
            stripe_user_id=connection.stripe_account_id,
        )
    except StripeError as e:
        logger.warning(f"Failed to revoke Stripe OAuth: {e}")

    # Soft delete - keep data but mark inactive
    connection.is_active = False
    connection.updated_at = datetime.utcnow()
    db.commit()

    return {"status": "success"}


# ============================================================================
# DATA SYNC
# ============================================================================

@router.get("/connection", response_model=Optional[StripeConnectionResponse])
async def get_connection(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current Stripe connection status."""
    connection = db.query(StripeConnection).filter(
        StripeConnection.organization_id == current_user.organization_id,
        StripeConnection.is_active == True
    ).first()

    if not connection:
        return None

    return StripeConnectionResponse(
        id=connection.id,
        stripe_account_id=connection.stripe_account_id,
        account_name=connection.account_name,
        is_active=connection.is_active,
        last_sync_at=connection.last_sync_at,
        sync_status=connection.sync_status,
        created_at=connection.created_at
    )


@router.post("/sync")
async def trigger_sync(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Trigger a manual sync of Stripe data."""
    connection = db.query(StripeConnection).filter(
        StripeConnection.organization_id == current_user.organization_id,
        StripeConnection.is_active == True
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="No Stripe account connected")

    connection.sync_status = "syncing"
    db.commit()

    background_tasks.add_task(sync_stripe_data, connection.id)

    return {"status": "syncing"}


def sync_stripe_data(connection_id: int):
    """Sync Stripe data for a connection (runs in background)."""
    from .database import SessionLocal

    db = SessionLocal()

    try:
        connection = db.query(StripeConnection).filter(
            StripeConnection.id == connection_id
        ).first()

        if not connection:
            return

        stripe.api_key = connection.access_token

        # Sync customers
        sync_customers(connection, db)

        # Sync subscriptions
        sync_subscriptions(connection, db)

        # Update connection status
        connection.last_sync_at = datetime.utcnow()
        connection.sync_status = "synced"
        connection.sync_error = None
        db.commit()

        logger.info(f"Synced Stripe data for connection {connection_id}")

    except StripeError as e:
        logger.error(f"Stripe sync error for connection {connection_id}: {e}")
        connection = db.query(StripeConnection).filter(
            StripeConnection.id == connection_id
        ).first()
        if connection:
            connection.sync_status = "error"
            connection.sync_error = str(e)
            db.commit()
    finally:
        db.close()


def sync_customers(connection: StripeConnection, db: Session):
    """Sync customers from Stripe."""
    org_id = connection.organization_id

    # Fetch all customers
    customers = stripe.Customer.list(limit=100)

    for customer_data in customers.auto_paging_iter():
        existing = db.query(StripeCustomerSync).filter(
            StripeCustomerSync.stripe_customer_id == customer_data.id,
            StripeCustomerSync.organization_id == org_id
        ).first()

        customer_created = datetime.fromtimestamp(customer_data.created) if customer_data.created else None

        if existing:
            existing.email = customer_data.email
            existing.name = customer_data.name
            existing.updated_at = datetime.utcnow()
        else:
            new_customer = StripeCustomerSync(
                organization_id=org_id,
                stripe_connection_id=connection.id,
                stripe_customer_id=customer_data.id,
                email=customer_data.email,
                name=customer_data.name,
                customer_created_at=customer_created
            )
            db.add(new_customer)

    db.commit()


def sync_subscriptions(connection: StripeConnection, db: Session):
    """Sync subscriptions from Stripe."""
    org_id = connection.organization_id

    # Fetch all subscriptions (including canceled for churn calculation)
    subscriptions = stripe.Subscription.list(limit=100, status="all")

    for sub_data in subscriptions.auto_paging_iter():
        existing = db.query(StripeSubscriptionSync).filter(
            StripeSubscriptionSync.stripe_subscription_id == sub_data.id,
            StripeSubscriptionSync.organization_id == org_id
        ).first()

        # Calculate MRR for this subscription
        mrr = 0.0
        plan_name = "Unknown"
        if sub_data.items and sub_data.items.data:
            for item in sub_data.items.data:
                price = item.price
                if price:
                    plan_name = price.nickname or price.product or "Unknown"
                    amount = price.unit_amount or 0
                    interval = price.recurring.interval if price.recurring else "month"
                    interval_count = price.recurring.interval_count if price.recurring else 1

                    # Normalize to monthly
                    if interval == "year":
                        mrr += (amount / 100) / 12
                    elif interval == "week":
                        mrr += (amount / 100) * 4.33
                    elif interval == "day":
                        mrr += (amount / 100) * 30
                    else:  # month
                        mrr += (amount / 100) / interval_count

        sub_created = datetime.fromtimestamp(sub_data.created) if sub_data.created else None
        period_end = datetime.fromtimestamp(sub_data.current_period_end) if sub_data.current_period_end else None
        canceled_at = datetime.fromtimestamp(sub_data.canceled_at) if sub_data.canceled_at else None

        if existing:
            existing.status = sub_data.status
            existing.mrr = mrr
            existing.plan_name = plan_name
            existing.current_period_end = period_end
            existing.canceled_at = canceled_at
            existing.updated_at = datetime.utcnow()
        else:
            new_sub = StripeSubscriptionSync(
                organization_id=org_id,
                stripe_connection_id=connection.id,
                stripe_subscription_id=sub_data.id,
                stripe_customer_id=sub_data.customer,
                status=sub_data.status,
                plan_name=plan_name,
                mrr=mrr,
                subscription_created_at=sub_created,
                current_period_end=period_end,
                canceled_at=canceled_at
            )
            db.add(new_sub)

    db.commit()


# ============================================================================
# METRICS ENDPOINTS
# ============================================================================

@router.get("/metrics", response_model=RevenueMetrics)
async def get_revenue_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get revenue metrics (MRR, ARR, churn, etc.)."""
    org_id = current_user.organization_id

    # Check connection
    connection = db.query(StripeConnection).filter(
        StripeConnection.organization_id == org_id,
        StripeConnection.is_active == True
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="No Stripe account connected")

    # Get active subscriptions for MRR
    active_subs = db.query(StripeSubscriptionSync).filter(
        StripeSubscriptionSync.organization_id == org_id,
        StripeSubscriptionSync.status == "active"
    ).all()

    mrr = sum(sub.mrr or 0 for sub in active_subs)
    arr = mrr * 12

    # Get total customers
    total_customers = db.query(StripeCustomerSync).filter(
        StripeCustomerSync.organization_id == org_id
    ).count()

    # Get new customers in last 30 days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    new_customers_30d = db.query(StripeCustomerSync).filter(
        StripeCustomerSync.organization_id == org_id,
        StripeCustomerSync.customer_created_at >= thirty_days_ago
    ).count()

    # Get churned subscriptions in last 30 days
    churned_30d = db.query(StripeSubscriptionSync).filter(
        StripeSubscriptionSync.organization_id == org_id,
        StripeSubscriptionSync.status == "canceled",
        StripeSubscriptionSync.canceled_at >= thirty_days_ago
    ).count()

    # Calculate churn rate
    total_subs = db.query(StripeSubscriptionSync).filter(
        StripeSubscriptionSync.organization_id == org_id
    ).count()
    churn_rate = (churned_30d / total_subs * 100) if total_subs > 0 else 0

    # Calculate ARPC
    arpc = mrr / total_customers if total_customers > 0 else 0

    # Calculate MoM growth (compare current MRR to 30 days ago)
    # For now, use subscription count growth as proxy
    sixty_days_ago = datetime.utcnow() - timedelta(days=60)
    old_active_count = db.query(StripeSubscriptionSync).filter(
        StripeSubscriptionSync.organization_id == org_id,
        StripeSubscriptionSync.subscription_created_at <= thirty_days_ago,
        StripeSubscriptionSync.status.in_(["active", "canceled"]),
        (StripeSubscriptionSync.canceled_at == None) | (StripeSubscriptionSync.canceled_at > thirty_days_ago)
    ).count()

    growth_rate = ((len(active_subs) - old_active_count) / old_active_count * 100) if old_active_count > 0 else 0

    return RevenueMetrics(
        mrr=round(mrr, 2),
        arr=round(arr, 2),
        total_revenue_30d=0,  # Would need charge data
        total_revenue_90d=0,  # Would need charge data
        active_subscriptions=len(active_subs),
        total_customers=total_customers,
        new_customers_30d=new_customers_30d,
        churned_subscriptions_30d=churned_30d,
        churn_rate=round(churn_rate, 2),
        average_revenue_per_customer=round(arpc, 2),
        growth_rate_mom=round(growth_rate, 2)
    )


@router.get("/chart", response_model=RevenueChartData)
async def get_revenue_chart(
    days: int = Query(default=30, ge=7, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get revenue chart data for the specified period."""
    org_id = current_user.organization_id

    # Generate date labels
    labels = []
    mrr_data = []
    revenue_data = []
    customer_data = []

    for i in range(days, 0, -7):  # Weekly intervals
        point_date = date.today() - timedelta(days=i)
        labels.append(point_date.strftime("%b %d"))

        # Count active subscriptions at this point
        active_at_point = db.query(StripeSubscriptionSync).filter(
            StripeSubscriptionSync.organization_id == org_id,
            StripeSubscriptionSync.subscription_created_at <= datetime.combine(point_date, datetime.min.time()),
            (StripeSubscriptionSync.canceled_at == None) |
            (StripeSubscriptionSync.canceled_at > datetime.combine(point_date, datetime.min.time()))
        ).all()

        point_mrr = sum(sub.mrr or 0 for sub in active_at_point)
        mrr_data.append(round(point_mrr, 2))
        revenue_data.append(round(point_mrr, 2))  # Simplified

        # Count customers at this point
        customers_at_point = db.query(StripeCustomerSync).filter(
            StripeCustomerSync.organization_id == org_id,
            StripeCustomerSync.customer_created_at <= datetime.combine(point_date, datetime.min.time())
        ).count()
        customer_data.append(customers_at_point)

    return RevenueChartData(
        labels=labels,
        mrr=mrr_data,
        revenue=revenue_data,
        customers=customer_data
    )


@router.get("/breakdown", response_model=List[SubscriptionBreakdown])
async def get_subscription_breakdown(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get breakdown of subscriptions by plan."""
    org_id = current_user.organization_id

    active_subs = db.query(StripeSubscriptionSync).filter(
        StripeSubscriptionSync.organization_id == org_id,
        StripeSubscriptionSync.status == "active"
    ).all()

    # Group by plan
    by_plan: Dict[str, Dict] = defaultdict(lambda: {"count": 0, "mrr": 0.0})
    total_mrr = 0.0

    for sub in active_subs:
        plan = sub.plan_name or "Unknown"
        by_plan[plan]["count"] += 1
        by_plan[plan]["mrr"] += sub.mrr or 0
        total_mrr += sub.mrr or 0

    breakdown = []
    for plan_name, data in sorted(by_plan.items(), key=lambda x: x[1]["mrr"], reverse=True):
        breakdown.append(SubscriptionBreakdown(
            plan_name=plan_name,
            count=data["count"],
            mrr=round(data["mrr"], 2),
            percentage=round((data["mrr"] / total_mrr * 100) if total_mrr > 0 else 0, 1)
        ))

    return breakdown


@router.get("/top-customers", response_model=List[TopCustomer])
async def get_top_customers(
    limit: int = Query(default=10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get top customers by revenue."""
    org_id = current_user.organization_id

    # Get customers with their subscription totals
    customers = db.query(StripeCustomerSync).filter(
        StripeCustomerSync.organization_id == org_id
    ).all()

    customer_revenue = []

    for customer in customers:
        subs = db.query(StripeSubscriptionSync).filter(
            StripeSubscriptionSync.organization_id == org_id,
            StripeSubscriptionSync.stripe_customer_id == customer.stripe_customer_id
        ).all()

        active_subs = [s for s in subs if s.status == "active"]
        total_mrr = sum(s.mrr or 0 for s in active_subs)

        if total_mrr > 0 or len(subs) > 0:
            customer_revenue.append(TopCustomer(
                customer_id=customer.stripe_customer_id,
                email=customer.email,
                name=customer.name,
                total_revenue=round(total_mrr * 12, 2),  # Annualized
                subscription_count=len(active_subs),
                status="active" if active_subs else "churned"
            ))

    # Sort by revenue and limit
    customer_revenue.sort(key=lambda x: x.total_revenue, reverse=True)
    return customer_revenue[:limit]


@router.get("/dashboard", response_model=RevenueDashboard)
async def get_revenue_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get complete revenue dashboard data."""
    org_id = current_user.organization_id

    connection = db.query(StripeConnection).filter(
        StripeConnection.organization_id == org_id,
        StripeConnection.is_active == True
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="No Stripe account connected")

    # Get all data
    metrics = await get_revenue_metrics(current_user, db)
    chart_data = await get_revenue_chart(30, current_user, db)
    breakdown = await get_subscription_breakdown(current_user, db)
    top_customers = await get_top_customers(5, current_user, db)

    return RevenueDashboard(
        metrics=metrics,
        chart_data=chart_data,
        subscription_breakdown=breakdown,
        top_customers=top_customers,
        last_updated=connection.last_sync_at
    )
