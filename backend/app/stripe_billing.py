"""
Stripe subscription billing integration.

Handles:
- Checkout session creation
- Subscription management
- Webhook processing
- Customer portal
"""
import os
import stripe
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel

from .database import get_db
from .models import User, Organization, SubscriptionHistory, SubscriptionTier, SubscriptionStatus
from .auth import get_current_user

router = APIRouter()

# ============ CONFIGURATION ============

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Price IDs (set these after creating products in Stripe)
PRICE_IDS = {
    "starter_monthly": os.getenv("STRIPE_PRICE_STARTER_MONTHLY", ""),
    "starter_yearly": os.getenv("STRIPE_PRICE_STARTER_YEARLY", ""),
    "growth_monthly": os.getenv("STRIPE_PRICE_GROWTH_MONTHLY", ""),
    "growth_yearly": os.getenv("STRIPE_PRICE_GROWTH_YEARLY", ""),
    "scale_monthly": os.getenv("STRIPE_PRICE_SCALE_MONTHLY", ""),
    "scale_yearly": os.getenv("STRIPE_PRICE_SCALE_YEARLY", ""),
}

# Initialize Stripe
if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


# ============ SCHEMAS ============

class CreateCheckoutRequest(BaseModel):
    price_key: str  # starter_monthly, pro_monthly, etc.


class SubscriptionResponse(BaseModel):
    tier: str
    status: str
    trial_ends_at: Optional[datetime]
    subscription_ends_at: Optional[datetime]
    stripe_customer_id: Optional[str]


# ============ HELPERS ============

def get_or_create_stripe_customer(user: User, org: Organization, db: Session) -> str:
    """Get existing Stripe customer or create new one."""
    if org.stripe_customer_id:
        return org.stripe_customer_id

    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    customer = stripe.Customer.create(
        email=user.email,
        name=user.name or user.email,
        metadata={
            "organization_id": str(org.id),
            "organization_slug": org.slug,
        },
    )

    org.stripe_customer_id = customer.id
    db.commit()

    return customer.id


def tier_from_price_key(price_key: str) -> str:
    """Get subscription tier from price key."""
    if price_key.startswith("starter"):
        return SubscriptionTier.FREE.value
    elif price_key.startswith("growth"):
        return SubscriptionTier.GROWTH.value
    elif price_key.startswith("scale"):
        return SubscriptionTier.SCALE.value
    elif price_key.startswith("enterprise"):
        return SubscriptionTier.ENTERPRISE.value
    return SubscriptionTier.FREE.value


# ============ ROUTES ============

@router.get("/config")
async def get_stripe_config():
    """Get publishable key for frontend."""
    return {"publishable_key": STRIPE_PUBLISHABLE_KEY}


@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current subscription status."""
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="User has no organization")

    org = db.query(Organization).filter(Organization.id == current_user.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    return SubscriptionResponse(
        tier=org.subscription_tier or SubscriptionTier.FREE.value,
        status=org.subscription_status or SubscriptionStatus.TRIALING.value,
        trial_ends_at=org.trial_ends_at,
        subscription_ends_at=org.subscription_ends_at,
        stripe_customer_id=org.stripe_customer_id,
    )


@router.post("/create-checkout-session")
async def create_checkout_session(
    request: CreateCheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Stripe checkout session for subscription."""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="User has no organization")

    org = db.query(Organization).filter(Organization.id == current_user.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    price_id = PRICE_IDS.get(request.price_key)
    if not price_id:
        raise HTTPException(status_code=400, detail=f"Invalid price key: {request.price_key}")

    # Get or create customer
    customer_id = get_or_create_stripe_customer(current_user, org, db)

    # Create checkout session
    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=f"{FRONTEND_URL}/settings/billing?success=true",
        cancel_url=f"{FRONTEND_URL}/settings/billing?canceled=true",
        subscription_data={
            "metadata": {
                "organization_id": str(org.id),
                "price_key": request.price_key,
            },
        },
        metadata={
            "organization_id": str(org.id),
            "price_key": request.price_key,
        },
    )

    return {"checkout_url": session.url, "session_id": session.id}


@router.post("/create-portal-session")
async def create_portal_session(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Stripe customer portal session."""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="User has no organization")

    org = db.query(Organization).filter(Organization.id == current_user.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if not org.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No billing account found")

    session = stripe.billing_portal.Session.create(
        customer=org.stripe_customer_id,
        return_url=f"{FRONTEND_URL}/settings/billing",
    )

    return {"portal_url": session.url}


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None),
    db: Session = Depends(get_db),
):
    """Handle Stripe webhooks."""
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    payload = await request.body()

    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle the event
    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        await handle_checkout_completed(data, db)
    elif event_type == "customer.subscription.created":
        await handle_subscription_created(data, db)
    elif event_type == "customer.subscription.updated":
        await handle_subscription_updated(data, db)
    elif event_type == "customer.subscription.deleted":
        await handle_subscription_deleted(data, db)
    elif event_type == "invoice.paid":
        await handle_invoice_paid(data, db)
    elif event_type == "invoice.payment_failed":
        await handle_invoice_failed(data, db)

    return {"received": True}


# ============ WEBHOOK HANDLERS ============

async def handle_checkout_completed(data: dict, db: Session):
    """Handle successful checkout."""
    org_id = data.get("metadata", {}).get("organization_id")
    if not org_id:
        return

    org = db.query(Organization).filter(Organization.id == int(org_id)).first()
    if not org:
        return

    # Update customer ID if not set
    customer_id = data.get("customer")
    if customer_id and not org.stripe_customer_id:
        org.stripe_customer_id = customer_id

    # Update subscription ID
    subscription_id = data.get("subscription")
    if subscription_id:
        org.stripe_subscription_id = subscription_id

    db.commit()


async def handle_subscription_created(data: dict, db: Session):
    """Handle new subscription."""
    customer_id = data.get("customer")
    org = db.query(Organization).filter(Organization.stripe_customer_id == customer_id).first()
    if not org:
        return

    org.stripe_subscription_id = data.get("id")
    org.subscription_status = SubscriptionStatus.ACTIVE.value

    # Determine tier from price
    items = data.get("items", {}).get("data", [])
    if items:
        price_id = items[0].get("price", {}).get("id")
        for key, pid in PRICE_IDS.items():
            if pid == price_id:
                org.subscription_tier = tier_from_price_key(key)
                break

    # Clear trial
    org.trial_ends_at = None

    # Set subscription end date
    current_period_end = data.get("current_period_end")
    if current_period_end:
        org.subscription_ends_at = datetime.fromtimestamp(current_period_end)

    # Log history
    history = SubscriptionHistory(
        organization_id=org.id,
        event_type="created",
        tier=org.subscription_tier,
        metadata={"subscription_id": data.get("id")},
    )
    db.add(history)
    db.commit()


async def handle_subscription_updated(data: dict, db: Session):
    """Handle subscription changes."""
    customer_id = data.get("customer")
    org = db.query(Organization).filter(Organization.stripe_customer_id == customer_id).first()
    if not org:
        return

    # Update status
    status = data.get("status")
    if status == "active":
        org.subscription_status = SubscriptionStatus.ACTIVE.value
    elif status == "past_due":
        org.subscription_status = SubscriptionStatus.PAST_DUE.value
    elif status == "canceled":
        org.subscription_status = SubscriptionStatus.CANCELED.value
    elif status == "unpaid":
        org.subscription_status = SubscriptionStatus.UNPAID.value

    # Update tier if changed
    items = data.get("items", {}).get("data", [])
    if items:
        price_id = items[0].get("price", {}).get("id")
        for key, pid in PRICE_IDS.items():
            if pid == price_id:
                org.subscription_tier = tier_from_price_key(key)
                break

    # Update end date
    current_period_end = data.get("current_period_end")
    if current_period_end:
        org.subscription_ends_at = datetime.fromtimestamp(current_period_end)

    # Log history
    history = SubscriptionHistory(
        organization_id=org.id,
        event_type="updated",
        tier=org.subscription_tier,
        metadata={"status": status},
    )
    db.add(history)
    db.commit()


async def handle_subscription_deleted(data: dict, db: Session):
    """Handle subscription cancellation."""
    customer_id = data.get("customer")
    org = db.query(Organization).filter(Organization.stripe_customer_id == customer_id).first()
    if not org:
        return

    org.subscription_status = SubscriptionStatus.CANCELED.value
    org.subscription_tier = SubscriptionTier.FREE.value
    org.stripe_subscription_id = None

    # Log history
    history = SubscriptionHistory(
        organization_id=org.id,
        event_type="canceled",
        tier=SubscriptionTier.FREE.value,
    )
    db.add(history)
    db.commit()


async def handle_invoice_paid(data: dict, db: Session):
    """Handle successful payment."""
    customer_id = data.get("customer")
    org = db.query(Organization).filter(Organization.stripe_customer_id == customer_id).first()
    if not org:
        return

    # Log payment
    history = SubscriptionHistory(
        organization_id=org.id,
        event_type="payment_succeeded",
        tier=org.subscription_tier,
        amount_cents=data.get("amount_paid"),
        stripe_invoice_id=data.get("id"),
        stripe_payment_intent_id=data.get("payment_intent"),
    )
    db.add(history)
    db.commit()


async def handle_invoice_failed(data: dict, db: Session):
    """Handle failed payment."""
    customer_id = data.get("customer")
    org = db.query(Organization).filter(Organization.stripe_customer_id == customer_id).first()
    if not org:
        return

    org.subscription_status = SubscriptionStatus.PAST_DUE.value

    # Log failure
    history = SubscriptionHistory(
        organization_id=org.id,
        event_type="payment_failed",
        tier=org.subscription_tier,
        amount_cents=data.get("amount_due"),
        stripe_invoice_id=data.get("id"),
    )
    db.add(history)
    db.commit()
