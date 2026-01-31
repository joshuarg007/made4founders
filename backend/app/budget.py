"""
Budget API - Budget vs Actuals tracking.

Features:
- Budget categories with Teller mapping
- Budget periods (monthly, quarterly, annual)
- Automatic actual calculation from Teller transactions
- Variance reporting and forecasting
"""

import json
from datetime import datetime, UTC, date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from .database import get_db
from .auth import get_current_user
from .models import User, BudgetCategory, BudgetPeriod, BudgetLineItem, TellerTransaction
from .schemas import (
    BudgetCategoryCreate, BudgetCategoryUpdate, BudgetCategoryResponse,
    BudgetLineItemCreate, BudgetLineItemUpdate, BudgetLineItemResponse,
    BudgetPeriodCreate, BudgetPeriodUpdate, BudgetPeriodResponse, BudgetPeriodWithLineItems,
    BudgetVarianceReport, BudgetForecast, BudgetSummary
)

router = APIRouter(prefix="/api/budget", tags=["Budget"])


# ============================================
# DEFAULT CATEGORIES
# ============================================

DEFAULT_CATEGORIES = [
    {"name": "Payroll", "color": "#f59e0b", "icon": "Users", "plaid_categories": ["TRANSFER_OUT_PAYROLL"], "display_order": 1},
    {"name": "Software & SaaS", "color": "#3b82f6", "icon": "Zap", "plaid_categories": ["SHOPS_COMPUTERS_AND_ELECTRONICS"], "merchant_keywords": ["AWS", "Google", "Microsoft", "Stripe", "Slack", "Zoom", "GitHub"], "display_order": 2},
    {"name": "Marketing", "color": "#ec4899", "icon": "Megaphone", "plaid_categories": ["GENERAL_SERVICES_ADVERTISING"], "merchant_keywords": ["Facebook Ads", "Google Ads", "LinkedIn"], "display_order": 3},
    {"name": "Office & Rent", "color": "#8b5cf6", "icon": "Building2", "plaid_categories": ["RENT_AND_UTILITIES_RENT", "RENT_AND_UTILITIES_UTILITIES"], "display_order": 4},
    {"name": "Professional Services", "color": "#6366f1", "icon": "Briefcase", "plaid_categories": ["GENERAL_SERVICES_PROFESSIONAL_SERVICES"], "merchant_keywords": ["lawyer", "attorney", "accountant", "CPA"], "display_order": 5},
    {"name": "Travel", "color": "#14b8a6", "icon": "Plane", "plaid_categories": ["TRAVEL_FLIGHTS", "TRAVEL_LODGING", "TRAVEL_RENTAL_CARS"], "display_order": 6},
    {"name": "Meals & Entertainment", "color": "#f97316", "icon": "Coffee", "plaid_categories": ["FOOD_AND_DRINK_RESTAURANTS", "FOOD_AND_DRINK_COFFEE"], "display_order": 7},
    {"name": "Equipment", "color": "#10b981", "icon": "Monitor", "plaid_categories": ["SHOPS_COMPUTERS_AND_ELECTRONICS", "SHOPS_FURNITURE_AND_HOME_DECOR"], "display_order": 8},
    {"name": "Insurance", "color": "#e11d48", "icon": "Shield", "plaid_categories": ["GENERAL_SERVICES_INSURANCE"], "display_order": 9},
    {"name": "Other", "color": "#6b7280", "icon": "MoreHorizontal", "plaid_categories": [], "display_order": 100},
]


# ============================================
# CATEGORY ENDPOINTS
# ============================================

@router.get("/categories", response_model=List[BudgetCategoryResponse])
def list_categories(
    include_inactive: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all budget categories."""
    query = db.query(BudgetCategory).filter(
        BudgetCategory.organization_id == current_user.organization_id
    )

    if not include_inactive:
        query = query.filter(BudgetCategory.is_active == True)

    categories = query.order_by(BudgetCategory.display_order, BudgetCategory.name).all()

    result = []
    for cat in categories:
        result.append({
            "id": cat.id,
            "organization_id": cat.organization_id,
            "name": cat.name,
            "description": cat.description,
            "color": cat.color,
            "icon": cat.icon,
            "parent_id": cat.parent_id,
            "display_order": cat.display_order,
            "plaid_categories": json.loads(cat.plaid_categories) if cat.plaid_categories else None,
            "merchant_keywords": json.loads(cat.merchant_keywords) if cat.merchant_keywords else None,
            "is_active": cat.is_active,
            "created_at": cat.created_at,
            "updated_at": cat.updated_at,
        })

    return result


@router.post("/categories", response_model=BudgetCategoryResponse)
def create_category(
    category: BudgetCategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a budget category."""
    db_category = BudgetCategory(
        organization_id=current_user.organization_id,
        name=category.name,
        description=category.description,
        color=category.color,
        icon=category.icon,
        parent_id=category.parent_id,
        display_order=category.display_order,
        plaid_categories=json.dumps(category.plaid_categories) if category.plaid_categories else None,
        merchant_keywords=json.dumps(category.merchant_keywords) if category.merchant_keywords else None,
    )
    db.add(db_category)
    db.commit()
    db.refresh(db_category)

    return {
        "id": db_category.id,
        "organization_id": db_category.organization_id,
        "name": db_category.name,
        "description": db_category.description,
        "color": db_category.color,
        "icon": db_category.icon,
        "parent_id": db_category.parent_id,
        "display_order": db_category.display_order,
        "plaid_categories": json.loads(db_category.plaid_categories) if db_category.plaid_categories else None,
        "merchant_keywords": json.loads(db_category.merchant_keywords) if db_category.merchant_keywords else None,
        "is_active": db_category.is_active,
        "created_at": db_category.created_at,
        "updated_at": db_category.updated_at,
    }


@router.patch("/categories/{category_id}", response_model=BudgetCategoryResponse)
def update_category(
    category_id: int,
    updates: BudgetCategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a budget category."""
    category = db.query(BudgetCategory).filter(
        BudgetCategory.id == category_id,
        BudgetCategory.organization_id == current_user.organization_id
    ).first()

    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    update_data = updates.model_dump(exclude_unset=True)

    # Handle JSON fields
    if "plaid_categories" in update_data:
        update_data["plaid_categories"] = json.dumps(update_data["plaid_categories"]) if update_data["plaid_categories"] else None
    if "merchant_keywords" in update_data:
        update_data["merchant_keywords"] = json.dumps(update_data["merchant_keywords"]) if update_data["merchant_keywords"] else None

    for key, value in update_data.items():
        setattr(category, key, value)

    db.commit()
    db.refresh(category)

    return {
        "id": category.id,
        "organization_id": category.organization_id,
        "name": category.name,
        "description": category.description,
        "color": category.color,
        "icon": category.icon,
        "parent_id": category.parent_id,
        "display_order": category.display_order,
        "plaid_categories": json.loads(category.plaid_categories) if category.plaid_categories else None,
        "merchant_keywords": json.loads(category.merchant_keywords) if category.merchant_keywords else None,
        "is_active": category.is_active,
        "created_at": category.created_at,
        "updated_at": category.updated_at,
    }


@router.delete("/categories/{category_id}")
def delete_category(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a budget category (soft delete)."""
    category = db.query(BudgetCategory).filter(
        BudgetCategory.id == category_id,
        BudgetCategory.organization_id == current_user.organization_id
    ).first()

    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    category.is_active = False
    db.commit()

    return {"message": "Category deleted"}


@router.post("/categories/initialize-defaults")
def initialize_default_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Initialize default budget categories for the organization."""
    # Check if categories already exist
    existing = db.query(BudgetCategory).filter(
        BudgetCategory.organization_id == current_user.organization_id
    ).count()

    if existing > 0:
        return {"message": f"Categories already exist ({existing} found)", "created": 0}

    created = 0
    for cat_data in DEFAULT_CATEGORIES:
        db_category = BudgetCategory(
            organization_id=current_user.organization_id,
            name=cat_data["name"],
            color=cat_data.get("color"),
            icon=cat_data.get("icon"),
            display_order=cat_data.get("display_order", 0),
            plaid_categories=json.dumps(cat_data.get("plaid_categories", [])),
            merchant_keywords=json.dumps(cat_data.get("merchant_keywords", [])) if cat_data.get("merchant_keywords") else None,
        )
        db.add(db_category)
        created += 1

    db.commit()

    return {"message": f"Created {created} default categories", "created": created}


# ============================================
# BUDGET PERIOD ENDPOINTS
# ============================================

@router.get("/periods", response_model=List[BudgetPeriodResponse])
def list_periods(
    include_inactive: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all budget periods."""
    query = db.query(BudgetPeriod).filter(
        BudgetPeriod.organization_id == current_user.organization_id
    )

    if not include_inactive:
        query = query.filter(BudgetPeriod.is_active == True)

    periods = query.order_by(BudgetPeriod.start_date.desc()).all()

    return [{
        "id": p.id,
        "organization_id": p.organization_id,
        "period_type": p.period_type,
        "start_date": p.start_date,
        "end_date": p.end_date,
        "name": p.name,
        "notes": p.notes,
        "total_budget": p.total_budget,
        "is_active": p.is_active,
        "created_at": p.created_at,
        "updated_at": p.updated_at,
    } for p in periods]


@router.get("/periods/current", response_model=BudgetPeriodWithLineItems)
def get_current_period(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the current active budget period with line items."""
    today = date.today()

    period = db.query(BudgetPeriod).filter(
        BudgetPeriod.organization_id == current_user.organization_id,
        BudgetPeriod.start_date <= today,
        BudgetPeriod.end_date >= today,
        BudgetPeriod.is_active == True
    ).first()

    if not period:
        raise HTTPException(status_code=404, detail="No active budget period found")

    # Get line items with category info
    line_items = []
    for item in period.line_items:
        category = item.category
        line_items.append({
            "id": item.id,
            "organization_id": item.organization_id,
            "budget_period_id": item.budget_period_id,
            "category_id": item.category_id,
            "budgeted_amount": item.budgeted_amount,
            "actual_amount": item.actual_amount,
            "transaction_count": item.transaction_count,
            "variance_amount": item.variance_amount,
            "variance_percent": item.variance_percent,
            "status": item.status,
            "notes": item.notes,
            "last_calculated_at": item.last_calculated_at,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
            "category_name": category.name if category else None,
            "category_color": category.color if category else None,
            "category_icon": category.icon if category else None,
        })

    return {
        "id": period.id,
        "organization_id": period.organization_id,
        "period_type": period.period_type,
        "start_date": period.start_date,
        "end_date": period.end_date,
        "name": period.name,
        "notes": period.notes,
        "total_budget": period.total_budget,
        "is_active": period.is_active,
        "created_at": period.created_at,
        "updated_at": period.updated_at,
        "line_items": line_items,
    }


@router.post("/periods", response_model=BudgetPeriodWithLineItems)
def create_period(
    period_data: BudgetPeriodCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new budget period with line items."""
    # Calculate total budget from line items
    total_budget = sum(item.budgeted_amount for item in (period_data.line_items or []))

    db_period = BudgetPeriod(
        organization_id=current_user.organization_id,
        period_type=period_data.period_type,
        start_date=period_data.start_date,
        end_date=period_data.end_date,
        name=period_data.name,
        notes=period_data.notes,
        total_budget=total_budget,
    )
    db.add(db_period)
    db.flush()  # Get the period ID

    # Add line items
    line_items_result = []
    for item in (period_data.line_items or []):
        # Verify category exists
        category = db.query(BudgetCategory).filter(
            BudgetCategory.id == item.category_id,
            BudgetCategory.organization_id == current_user.organization_id
        ).first()

        if not category:
            raise HTTPException(status_code=400, detail=f"Category {item.category_id} not found")

        db_item = BudgetLineItem(
            organization_id=current_user.organization_id,
            budget_period_id=db_period.id,
            category_id=item.category_id,
            budgeted_amount=item.budgeted_amount,
            notes=item.notes,
        )
        db.add(db_item)
        db.flush()

        line_items_result.append({
            "id": db_item.id,
            "organization_id": db_item.organization_id,
            "budget_period_id": db_item.budget_period_id,
            "category_id": db_item.category_id,
            "budgeted_amount": db_item.budgeted_amount,
            "actual_amount": 0,
            "transaction_count": 0,
            "variance_amount": None,
            "variance_percent": None,
            "status": "on_track",
            "notes": db_item.notes,
            "last_calculated_at": None,
            "created_at": db_item.created_at,
            "updated_at": db_item.updated_at,
            "category_name": category.name,
            "category_color": category.color,
            "category_icon": category.icon,
        })

    db.commit()

    return {
        "id": db_period.id,
        "organization_id": db_period.organization_id,
        "period_type": db_period.period_type,
        "start_date": db_period.start_date,
        "end_date": db_period.end_date,
        "name": db_period.name,
        "notes": db_period.notes,
        "total_budget": db_period.total_budget,
        "is_active": db_period.is_active,
        "created_at": db_period.created_at,
        "updated_at": db_period.updated_at,
        "line_items": line_items_result,
    }


@router.get("/periods/{period_id}", response_model=BudgetPeriodWithLineItems)
def get_period(
    period_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a budget period with line items."""
    period = db.query(BudgetPeriod).filter(
        BudgetPeriod.id == period_id,
        BudgetPeriod.organization_id == current_user.organization_id
    ).first()

    if not period:
        raise HTTPException(status_code=404, detail="Budget period not found")

    line_items = []
    for item in period.line_items:
        category = item.category
        line_items.append({
            "id": item.id,
            "organization_id": item.organization_id,
            "budget_period_id": item.budget_period_id,
            "category_id": item.category_id,
            "budgeted_amount": item.budgeted_amount,
            "actual_amount": item.actual_amount,
            "transaction_count": item.transaction_count,
            "variance_amount": item.variance_amount,
            "variance_percent": item.variance_percent,
            "status": item.status,
            "notes": item.notes,
            "last_calculated_at": item.last_calculated_at,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
            "category_name": category.name if category else None,
            "category_color": category.color if category else None,
            "category_icon": category.icon if category else None,
        })

    return {
        "id": period.id,
        "organization_id": period.organization_id,
        "period_type": period.period_type,
        "start_date": period.start_date,
        "end_date": period.end_date,
        "name": period.name,
        "notes": period.notes,
        "total_budget": period.total_budget,
        "is_active": period.is_active,
        "created_at": period.created_at,
        "updated_at": period.updated_at,
        "line_items": line_items,
    }


@router.patch("/periods/{period_id}", response_model=BudgetPeriodResponse)
def update_period(
    period_id: int,
    updates: BudgetPeriodUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a budget period."""
    period = db.query(BudgetPeriod).filter(
        BudgetPeriod.id == period_id,
        BudgetPeriod.organization_id == current_user.organization_id
    ).first()

    if not period:
        raise HTTPException(status_code=404, detail="Budget period not found")

    update_data = updates.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(period, key, value)

    db.commit()
    db.refresh(period)

    return {
        "id": period.id,
        "organization_id": period.organization_id,
        "period_type": period.period_type,
        "start_date": period.start_date,
        "end_date": period.end_date,
        "name": period.name,
        "notes": period.notes,
        "total_budget": period.total_budget,
        "is_active": period.is_active,
        "created_at": period.created_at,
        "updated_at": period.updated_at,
    }


@router.delete("/periods/{period_id}")
def delete_period(
    period_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a budget period (soft delete)."""
    period = db.query(BudgetPeriod).filter(
        BudgetPeriod.id == period_id,
        BudgetPeriod.organization_id == current_user.organization_id
    ).first()

    if not period:
        raise HTTPException(status_code=404, detail="Budget period not found")

    period.is_active = False
    db.commit()

    return {"message": "Budget period deleted"}


# ============================================
# LINE ITEM ENDPOINTS
# ============================================

@router.post("/periods/{period_id}/line-items", response_model=BudgetLineItemResponse)
def add_line_item(
    period_id: int,
    item: BudgetLineItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a line item to a budget period."""
    period = db.query(BudgetPeriod).filter(
        BudgetPeriod.id == period_id,
        BudgetPeriod.organization_id == current_user.organization_id
    ).first()

    if not period:
        raise HTTPException(status_code=404, detail="Budget period not found")

    category = db.query(BudgetCategory).filter(
        BudgetCategory.id == item.category_id,
        BudgetCategory.organization_id == current_user.organization_id
    ).first()

    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    db_item = BudgetLineItem(
        organization_id=current_user.organization_id,
        budget_period_id=period_id,
        category_id=item.category_id,
        budgeted_amount=item.budgeted_amount,
        notes=item.notes,
    )
    db.add(db_item)

    # Update period total
    period.total_budget += item.budgeted_amount

    db.commit()
    db.refresh(db_item)

    return {
        "id": db_item.id,
        "organization_id": db_item.organization_id,
        "budget_period_id": db_item.budget_period_id,
        "category_id": db_item.category_id,
        "budgeted_amount": db_item.budgeted_amount,
        "actual_amount": db_item.actual_amount,
        "transaction_count": db_item.transaction_count,
        "variance_amount": db_item.variance_amount,
        "variance_percent": db_item.variance_percent,
        "status": db_item.status,
        "notes": db_item.notes,
        "last_calculated_at": db_item.last_calculated_at,
        "created_at": db_item.created_at,
        "updated_at": db_item.updated_at,
        "category_name": category.name,
        "category_color": category.color,
        "category_icon": category.icon,
    }


@router.patch("/periods/{period_id}/line-items/{item_id}", response_model=BudgetLineItemResponse)
def update_line_item(
    period_id: int,
    item_id: int,
    updates: BudgetLineItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a budget line item."""
    item = db.query(BudgetLineItem).filter(
        BudgetLineItem.id == item_id,
        BudgetLineItem.budget_period_id == period_id,
        BudgetLineItem.organization_id == current_user.organization_id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Line item not found")

    period = item.period
    old_amount = item.budgeted_amount

    update_data = updates.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)

    # Update period total if amount changed
    if "budgeted_amount" in update_data:
        period.total_budget = period.total_budget - old_amount + item.budgeted_amount

    db.commit()
    db.refresh(item)

    category = item.category

    return {
        "id": item.id,
        "organization_id": item.organization_id,
        "budget_period_id": item.budget_period_id,
        "category_id": item.category_id,
        "budgeted_amount": item.budgeted_amount,
        "actual_amount": item.actual_amount,
        "transaction_count": item.transaction_count,
        "variance_amount": item.variance_amount,
        "variance_percent": item.variance_percent,
        "status": item.status,
        "notes": item.notes,
        "last_calculated_at": item.last_calculated_at,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "category_name": category.name if category else None,
        "category_color": category.color if category else None,
        "category_icon": category.icon if category else None,
    }


@router.delete("/periods/{period_id}/line-items/{item_id}")
def delete_line_item(
    period_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a budget line item."""
    item = db.query(BudgetLineItem).filter(
        BudgetLineItem.id == item_id,
        BudgetLineItem.budget_period_id == period_id,
        BudgetLineItem.organization_id == current_user.organization_id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Line item not found")

    period = item.period
    period.total_budget -= item.budgeted_amount

    db.delete(item)
    db.commit()

    return {"message": "Line item deleted"}


# ============================================
# VARIANCE & REPORTING
# ============================================

def categorize_transaction(transaction: TellerTransaction, categories: List[BudgetCategory]) -> Optional[int]:
    """Match a transaction to a budget category."""
    tx_category = transaction.personal_finance_category or transaction.category or ""
    tx_name = (transaction.merchant_name or transaction.name or "").lower()

    for cat in categories:
        # Check category match (from bank provider)
        if cat.plaid_categories:
            plaid_cats = json.loads(cat.plaid_categories) if isinstance(cat.plaid_categories, str) else cat.plaid_categories
            for pc in plaid_cats:
                if pc.lower() in tx_category.lower():
                    return cat.id

        # Check merchant keyword match
        if cat.merchant_keywords:
            keywords = json.loads(cat.merchant_keywords) if isinstance(cat.merchant_keywords, str) else cat.merchant_keywords
            for keyword in keywords:
                if keyword.lower() in tx_name:
                    return cat.id

    # Return "Other" category if exists
    other_cat = next((c for c in categories if c.name.lower() == "other"), None)
    return other_cat.id if other_cat else None


@router.post("/periods/{period_id}/calculate-actuals")
def calculate_actuals(
    period_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Calculate actual spending from Teller transactions for a budget period."""
    period = db.query(BudgetPeriod).filter(
        BudgetPeriod.id == period_id,
        BudgetPeriod.organization_id == current_user.organization_id
    ).first()

    if not period:
        raise HTTPException(status_code=404, detail="Budget period not found")

    # Get all categories
    categories = db.query(BudgetCategory).filter(
        BudgetCategory.organization_id == current_user.organization_id,
        BudgetCategory.is_active == True
    ).all()

    # Get transactions for the period
    transactions = db.query(TellerTransaction).filter(
        TellerTransaction.organization_id == current_user.organization_id,
        TellerTransaction.date >= period.start_date,
        TellerTransaction.date <= period.end_date,
        TellerTransaction.is_excluded == False,
        TellerTransaction.amount > 0  # Only expenses (positive amounts are debits)
    ).all()

    # Categorize and sum
    category_totals: dict = {}
    category_counts: dict = {}

    for tx in transactions:
        cat_id = categorize_transaction(tx, categories)
        if cat_id:
            category_totals[cat_id] = category_totals.get(cat_id, 0) + abs(tx.amount)
            category_counts[cat_id] = category_counts.get(cat_id, 0) + 1

    # Update line items
    for item in period.line_items:
        actual = category_totals.get(item.category_id, 0)
        count = category_counts.get(item.category_id, 0)

        item.actual_amount = actual
        item.transaction_count = count
        item.variance_amount = item.budgeted_amount - actual
        item.variance_percent = ((item.budgeted_amount - actual) / item.budgeted_amount * 100) if item.budgeted_amount > 0 else 0

        # Determine status
        if actual <= item.budgeted_amount * 0.8:
            item.status = "on_track"
        elif actual <= item.budgeted_amount:
            item.status = "warning"
        else:
            item.status = "over"

        item.last_calculated_at = datetime.now(UTC)

    db.commit()

    return {
        "message": "Actuals calculated",
        "transactions_processed": len(transactions),
        "categories_updated": len(period.line_items)
    }


@router.get("/periods/{period_id}/variance-report", response_model=BudgetVarianceReport)
def get_variance_report(
    period_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get variance report for a budget period."""
    period = db.query(BudgetPeriod).filter(
        BudgetPeriod.id == period_id,
        BudgetPeriod.organization_id == current_user.organization_id
    ).first()

    if not period:
        raise HTTPException(status_code=404, detail="Budget period not found")

    today = date.today()
    days_total = (period.end_date - period.start_date).days + 1
    days_elapsed = min((today - period.start_date).days + 1, days_total)
    days_remaining = max(0, (period.end_date - today).days)
    percent_through = (days_elapsed / days_total) * 100 if days_total > 0 else 0

    total_budgeted = sum(item.budgeted_amount for item in period.line_items)
    total_actual = sum(item.actual_amount for item in period.line_items)
    total_variance = total_budgeted - total_actual
    variance_percent = (total_variance / total_budgeted * 100) if total_budgeted > 0 else 0

    # Overall status
    if total_actual <= total_budgeted * 0.8:
        status = "on_track"
    elif total_actual <= total_budgeted:
        status = "warning"
    else:
        status = "over"

    line_items = []
    for item in period.line_items:
        category = item.category
        line_items.append({
            "id": item.id,
            "organization_id": item.organization_id,
            "budget_period_id": item.budget_period_id,
            "category_id": item.category_id,
            "budgeted_amount": item.budgeted_amount,
            "actual_amount": item.actual_amount,
            "transaction_count": item.transaction_count,
            "variance_amount": item.variance_amount,
            "variance_percent": item.variance_percent,
            "status": item.status,
            "notes": item.notes,
            "last_calculated_at": item.last_calculated_at,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
            "category_name": category.name if category else None,
            "category_color": category.color if category else None,
            "category_icon": category.icon if category else None,
        })

    return {
        "period": {
            "id": period.id,
            "organization_id": period.organization_id,
            "period_type": period.period_type,
            "start_date": period.start_date,
            "end_date": period.end_date,
            "name": period.name,
            "notes": period.notes,
            "total_budget": period.total_budget,
            "is_active": period.is_active,
            "created_at": period.created_at,
            "updated_at": period.updated_at,
        },
        "total_budgeted": total_budgeted,
        "total_actual": total_actual,
        "total_variance": total_variance,
        "variance_percent": variance_percent,
        "status": status,
        "days_elapsed": days_elapsed,
        "days_remaining": days_remaining,
        "percent_through": percent_through,
        "line_items": line_items,
    }


@router.get("/periods/{period_id}/forecast", response_model=BudgetForecast)
def get_forecast(
    period_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get spending forecast for a budget period."""
    period = db.query(BudgetPeriod).filter(
        BudgetPeriod.id == period_id,
        BudgetPeriod.organization_id == current_user.organization_id
    ).first()

    if not period:
        raise HTTPException(status_code=404, detail="Budget period not found")

    today = date.today()
    days_total = (period.end_date - period.start_date).days + 1
    days_elapsed = min((today - period.start_date).days + 1, days_total)
    days_remaining = max(0, (period.end_date - today).days)
    percent_through = (days_elapsed / days_total) * 100 if days_total > 0 else 0

    total_budgeted = sum(item.budgeted_amount for item in period.line_items)
    total_actual = sum(item.actual_amount for item in period.line_items)

    # Calculate daily burn rate and projection
    daily_burn_rate = total_actual / days_elapsed if days_elapsed > 0 else 0
    projected_total = daily_burn_rate * days_total

    projected_variance = total_budgeted - projected_total

    # Determine risk level
    if projected_total <= total_budgeted:
        risk_level = "safe"
    elif projected_total <= total_budgeted * 1.1:
        risk_level = "warning"
    else:
        risk_level = "critical"

    # Find at-risk categories
    at_risk = []
    for item in period.line_items:
        if item.budgeted_amount > 0:
            item_daily_rate = item.actual_amount / days_elapsed if days_elapsed > 0 else 0
            item_projected = item_daily_rate * days_total
            if item_projected > item.budgeted_amount * 1.1:
                at_risk.append(item.category.name if item.category else f"Category {item.category_id}")

    return {
        "period": {
            "id": period.id,
            "organization_id": period.organization_id,
            "period_type": period.period_type,
            "start_date": period.start_date,
            "end_date": period.end_date,
            "name": period.name,
            "notes": period.notes,
            "total_budget": period.total_budget,
            "is_active": period.is_active,
            "created_at": period.created_at,
            "updated_at": period.updated_at,
        },
        "days_elapsed": days_elapsed,
        "days_remaining": days_remaining,
        "percent_through": percent_through,
        "daily_burn_rate": daily_burn_rate,
        "projected_total": projected_total,
        "projected_variance": projected_variance,
        "risk_level": risk_level,
        "at_risk_categories": at_risk,
    }


@router.get("/summary", response_model=BudgetSummary)
def get_budget_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get quick budget summary for dashboard."""
    today = date.today()

    period = db.query(BudgetPeriod).filter(
        BudgetPeriod.organization_id == current_user.organization_id,
        BudgetPeriod.start_date <= today,
        BudgetPeriod.end_date >= today,
        BudgetPeriod.is_active == True
    ).first()

    if not period:
        return {
            "current_period": None,
            "total_budgeted": 0,
            "total_spent": 0,
            "remaining": 0,
            "percent_spent": 0,
            "days_remaining": 0,
            "status": "no_budget",
            "top_categories": [],
        }

    days_remaining = max(0, (period.end_date - today).days)

    total_budgeted = sum(item.budgeted_amount for item in period.line_items)
    total_spent = sum(item.actual_amount for item in period.line_items)
    remaining = total_budgeted - total_spent
    percent_spent = (total_spent / total_budgeted * 100) if total_budgeted > 0 else 0

    if total_spent <= total_budgeted * 0.8:
        status = "on_track"
    elif total_spent <= total_budgeted:
        status = "warning"
    else:
        status = "over"

    # Top categories by spending
    top_categories = []
    sorted_items = sorted(period.line_items, key=lambda x: x.actual_amount, reverse=True)[:5]
    for item in sorted_items:
        if item.actual_amount > 0:
            top_categories.append({
                "name": item.category.name if item.category else "Unknown",
                "spent": item.actual_amount,
                "budget": item.budgeted_amount,
                "percent": (item.actual_amount / item.budgeted_amount * 100) if item.budgeted_amount > 0 else 0,
            })

    return {
        "current_period": {
            "id": period.id,
            "organization_id": period.organization_id,
            "period_type": period.period_type,
            "start_date": period.start_date,
            "end_date": period.end_date,
            "name": period.name,
            "notes": period.notes,
            "total_budget": period.total_budget,
            "is_active": period.is_active,
            "created_at": period.created_at,
            "updated_at": period.updated_at,
        },
        "total_budgeted": total_budgeted,
        "total_spent": total_spent,
        "remaining": remaining,
        "percent_spent": percent_spent,
        "days_remaining": days_remaining,
        "status": status,
        "top_categories": top_categories,
    }
