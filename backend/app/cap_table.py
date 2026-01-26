"""
Cap Table Management API

Provides endpoints for managing:
- Shareholders (founders, investors, employees, advisors)
- Share classes (common, preferred)
- Equity grants (issued shares)
- Stock options (ISO, NSO)
- SAFEs and Convertible Notes
- Funding rounds
- Cap table summary and dilution modeling
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date, datetime
from dateutil.relativedelta import relativedelta
import json

from .database import get_db
from .auth import get_current_user
from .models import (
    User, Shareholder, ShareClass, EquityGrant, StockOption,
    SafeNote, ConvertibleNote, FundingRound, Valuation409A
)
from .schemas import (
    ShareholderCreate, ShareholderUpdate, ShareholderResponse,
    ShareClassCreate, ShareClassUpdate, ShareClassResponse,
    EquityGrantCreate, EquityGrantUpdate, EquityGrantResponse,
    StockOptionCreate, StockOptionUpdate, StockOptionResponse,
    SafeNoteCreate, SafeNoteUpdate, SafeNoteResponse,
    ConvertibleNoteCreate, ConvertibleNoteUpdate, ConvertibleNoteResponse,
    FundingRoundCreate, FundingRoundUpdate, FundingRoundResponse,
    Valuation409ACreate, Valuation409AUpdate, Valuation409AResponse,
    CapTableSummary, DilutionScenario
)

router = APIRouter(prefix="/api/cap-table", tags=["cap-table"])


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def calculate_vested_shares(
    total_shares: int,
    vesting_schedule: str,
    vesting_start_date: Optional[date],
    cliff_months: int,
    vesting_period_months: int,
    custom_schedule: Optional[str] = None
) -> int:
    """Calculate vested shares as of today."""
    today = date.today()

    if vesting_schedule == "immediate":
        return total_shares

    if not vesting_start_date:
        return 0

    if vesting_schedule == "custom" and custom_schedule:
        # Custom schedule is JSON: [{"date": "2024-01-01", "shares": 1000}, ...]
        try:
            schedule = json.loads(custom_schedule)
            vested = 0
            for entry in schedule:
                vest_date = datetime.strptime(entry["date"], "%Y-%m-%d").date()
                if vest_date <= today:
                    vested += entry["shares"]
            return min(vested, total_shares)
        except (json.JSONDecodeError, KeyError):
            return 0

    # Standard vesting with cliff
    months_elapsed = (today.year - vesting_start_date.year) * 12 + (today.month - vesting_start_date.month)

    if months_elapsed < cliff_months:
        return 0

    if vesting_period_months <= 0:
        return total_shares

    # Linear vesting after cliff
    vesting_fraction = min(months_elapsed / vesting_period_months, 1.0)
    return int(total_shares * vesting_fraction)


def get_shareholder_totals(db: Session, shareholder_id: int, org_id: int) -> dict:
    """Get total shares and options for a shareholder."""
    # Total issued shares
    total_shares = db.query(func.sum(EquityGrant.shares - EquityGrant.cancelled_shares)).filter(
        EquityGrant.shareholder_id == shareholder_id,
        EquityGrant.organization_id == org_id,
        EquityGrant.status == "active"
    ).scalar() or 0

    # Total options (granted - exercised - cancelled)
    total_options = db.query(
        func.sum(StockOption.shares_granted - StockOption.shares_exercised - StockOption.shares_cancelled)
    ).filter(
        StockOption.shareholder_id == shareholder_id,
        StockOption.organization_id == org_id,
        StockOption.status == "active"
    ).scalar() or 0

    return {
        "total_shares": int(total_shares),
        "total_options": int(total_options)
    }


# ============================================================================
# SHAREHOLDERS
# ============================================================================

@router.get("/shareholders", response_model=List[ShareholderResponse])
def list_shareholders(
    shareholder_type: Optional[str] = None,
    include_inactive: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all shareholders."""
    query = db.query(Shareholder).filter(
        Shareholder.organization_id == current_user.organization_id
    )

    if not include_inactive:
        query = query.filter(Shareholder.is_active == True)

    if shareholder_type:
        query = query.filter(Shareholder.shareholder_type == shareholder_type)

    shareholders = query.order_by(Shareholder.name).all()

    # Calculate totals for each shareholder
    total_issued = db.query(func.sum(EquityGrant.shares - EquityGrant.cancelled_shares)).filter(
        EquityGrant.organization_id == current_user.organization_id,
        EquityGrant.status == "active"
    ).scalar() or 0

    total_options = db.query(
        func.sum(StockOption.shares_granted - StockOption.shares_exercised - StockOption.shares_cancelled)
    ).filter(
        StockOption.organization_id == current_user.organization_id,
        StockOption.status == "active"
    ).scalar() or 0

    fully_diluted = total_issued + total_options

    result = []
    for sh in shareholders:
        totals = get_shareholder_totals(db, sh.id, current_user.organization_id)
        ownership_pct = (totals["total_shares"] / total_issued * 100) if total_issued > 0 else 0
        fd_pct = ((totals["total_shares"] + totals["total_options"]) / fully_diluted * 100) if fully_diluted > 0 else 0

        result.append(ShareholderResponse(
            id=sh.id,
            name=sh.name,
            email=sh.email,
            shareholder_type=sh.shareholder_type,
            contact_id=sh.contact_id,
            title=sh.title,
            company=sh.company,
            phone=sh.phone,
            address=sh.address,
            notes=sh.notes,
            is_active=sh.is_active,
            created_at=sh.created_at,
            updated_at=sh.updated_at,
            total_shares=totals["total_shares"],
            total_options=totals["total_options"],
            ownership_percentage=round(ownership_pct, 2),
            fully_diluted_percentage=round(fd_pct, 2)
        ))

    return result


@router.post("/shareholders", response_model=ShareholderResponse, status_code=status.HTTP_201_CREATED)
def create_shareholder(
    data: ShareholderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new shareholder."""
    shareholder = Shareholder(
        organization_id=current_user.organization_id,
        **data.model_dump()
    )
    db.add(shareholder)
    db.commit()
    db.refresh(shareholder)

    return ShareholderResponse(
        **{k: v for k, v in shareholder.__dict__.items() if not k.startswith('_')},
        total_shares=0,
        total_options=0,
        ownership_percentage=0.0,
        fully_diluted_percentage=0.0
    )


@router.get("/shareholders/{shareholder_id}", response_model=ShareholderResponse)
def get_shareholder(
    shareholder_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific shareholder."""
    shareholder = db.query(Shareholder).filter(
        Shareholder.id == shareholder_id,
        Shareholder.organization_id == current_user.organization_id
    ).first()

    if not shareholder:
        raise HTTPException(status_code=404, detail="Shareholder not found")

    totals = get_shareholder_totals(db, shareholder.id, current_user.organization_id)

    return ShareholderResponse(
        **{k: v for k, v in shareholder.__dict__.items() if not k.startswith('_')},
        **totals,
        ownership_percentage=0.0,  # Would need full cap table calc
        fully_diluted_percentage=0.0
    )


@router.patch("/shareholders/{shareholder_id}", response_model=ShareholderResponse)
def update_shareholder(
    shareholder_id: int,
    data: ShareholderUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a shareholder."""
    shareholder = db.query(Shareholder).filter(
        Shareholder.id == shareholder_id,
        Shareholder.organization_id == current_user.organization_id
    ).first()

    if not shareholder:
        raise HTTPException(status_code=404, detail="Shareholder not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(shareholder, key, value)

    db.commit()
    db.refresh(shareholder)

    totals = get_shareholder_totals(db, shareholder.id, current_user.organization_id)

    return ShareholderResponse(
        **{k: v for k, v in shareholder.__dict__.items() if not k.startswith('_')},
        **totals,
        ownership_percentage=0.0,
        fully_diluted_percentage=0.0
    )


@router.delete("/shareholders/{shareholder_id}")
def delete_shareholder(
    shareholder_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a shareholder (soft delete by setting inactive)."""
    shareholder = db.query(Shareholder).filter(
        Shareholder.id == shareholder_id,
        Shareholder.organization_id == current_user.organization_id
    ).first()

    if not shareholder:
        raise HTTPException(status_code=404, detail="Shareholder not found")

    # Check if shareholder has any equity
    has_equity = db.query(EquityGrant).filter(
        EquityGrant.shareholder_id == shareholder_id,
        EquityGrant.status == "active"
    ).first()

    has_options = db.query(StockOption).filter(
        StockOption.shareholder_id == shareholder_id,
        StockOption.status == "active"
    ).first()

    if has_equity or has_options:
        # Soft delete
        shareholder.is_active = False
        db.commit()
        return {"status": "deactivated", "message": "Shareholder has active equity and was deactivated"}

    # Hard delete if no equity
    db.delete(shareholder)
    db.commit()
    return {"status": "deleted"}


# ============================================================================
# SHARE CLASSES
# ============================================================================

@router.get("/share-classes", response_model=List[ShareClassResponse])
def list_share_classes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all share classes."""
    classes = db.query(ShareClass).filter(
        ShareClass.organization_id == current_user.organization_id,
        ShareClass.is_active == True
    ).order_by(ShareClass.display_order, ShareClass.name).all()

    result = []
    for sc in classes:
        # Calculate issued shares
        issued = db.query(func.sum(EquityGrant.shares - EquityGrant.cancelled_shares)).filter(
            EquityGrant.share_class_id == sc.id,
            EquityGrant.status == "active"
        ).scalar() or 0

        # Calculate outstanding options
        options = db.query(
            func.sum(StockOption.shares_granted - StockOption.shares_exercised - StockOption.shares_cancelled)
        ).filter(
            StockOption.share_class_id == sc.id,
            StockOption.status == "active"
        ).scalar() or 0

        result.append(ShareClassResponse(
            **{k: v for k, v in sc.__dict__.items() if not k.startswith('_')},
            issued_shares=int(issued),
            outstanding_options=int(options)
        ))

    return result


@router.post("/share-classes", response_model=ShareClassResponse, status_code=status.HTTP_201_CREATED)
def create_share_class(
    data: ShareClassCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new share class."""
    share_class = ShareClass(
        organization_id=current_user.organization_id,
        **data.model_dump()
    )
    db.add(share_class)
    db.commit()
    db.refresh(share_class)

    return ShareClassResponse(
        **{k: v for k, v in share_class.__dict__.items() if not k.startswith('_')},
        issued_shares=0,
        outstanding_options=0
    )


@router.patch("/share-classes/{share_class_id}", response_model=ShareClassResponse)
def update_share_class(
    share_class_id: int,
    data: ShareClassUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a share class."""
    share_class = db.query(ShareClass).filter(
        ShareClass.id == share_class_id,
        ShareClass.organization_id == current_user.organization_id
    ).first()

    if not share_class:
        raise HTTPException(status_code=404, detail="Share class not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(share_class, key, value)

    db.commit()
    db.refresh(share_class)

    return ShareClassResponse(
        **{k: v for k, v in share_class.__dict__.items() if not k.startswith('_')},
        issued_shares=0,
        outstanding_options=0
    )


@router.delete("/share-classes/{share_class_id}")
def delete_share_class(
    share_class_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a share class (only if no shares issued)."""
    share_class = db.query(ShareClass).filter(
        ShareClass.id == share_class_id,
        ShareClass.organization_id == current_user.organization_id
    ).first()

    if not share_class:
        raise HTTPException(status_code=404, detail="Share class not found")

    # Check for issued shares
    has_grants = db.query(EquityGrant).filter(EquityGrant.share_class_id == share_class_id).first()
    has_options = db.query(StockOption).filter(StockOption.share_class_id == share_class_id).first()

    if has_grants or has_options:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete share class with issued shares or options"
        )

    db.delete(share_class)
    db.commit()
    return {"status": "deleted"}


# ============================================================================
# EQUITY GRANTS
# ============================================================================

@router.get("/equity-grants", response_model=List[EquityGrantResponse])
def list_equity_grants(
    shareholder_id: Optional[int] = None,
    share_class_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List equity grants."""
    query = db.query(EquityGrant).filter(
        EquityGrant.organization_id == current_user.organization_id
    )

    if shareholder_id:
        query = query.filter(EquityGrant.shareholder_id == shareholder_id)
    if share_class_id:
        query = query.filter(EquityGrant.share_class_id == share_class_id)

    grants = query.order_by(EquityGrant.grant_date.desc()).all()

    result = []
    for grant in grants:
        shareholder = db.query(Shareholder).get(grant.shareholder_id)
        share_class = db.query(ShareClass).get(grant.share_class_id)

        vested = calculate_vested_shares(
            grant.shares - grant.cancelled_shares,
            grant.vesting_schedule,
            grant.vesting_start_date,
            grant.cliff_months,
            grant.vesting_period_months,
            grant.custom_vesting_schedule
        )

        result.append(EquityGrantResponse(
            id=grant.id,
            shareholder_id=grant.shareholder_id,
            share_class_id=grant.share_class_id,
            shares=grant.shares,
            price_per_share=grant.price_per_share,
            grant_date=grant.grant_date,
            certificate_number=grant.certificate_number,
            vesting_schedule=grant.vesting_schedule,
            vesting_start_date=grant.vesting_start_date,
            vesting_end_date=grant.vesting_end_date,
            cliff_months=grant.cliff_months,
            vesting_period_months=grant.vesting_period_months,
            custom_vesting_schedule=grant.custom_vesting_schedule,
            has_repurchase_right=grant.has_repurchase_right,
            repurchase_price=grant.repurchase_price,
            filed_83b=grant.filed_83b,
            filed_83b_date=grant.filed_83b_date,
            notes=grant.notes,
            status=grant.status,
            cancelled_date=grant.cancelled_date,
            cancelled_shares=grant.cancelled_shares,
            created_at=grant.created_at,
            updated_at=grant.updated_at,
            shareholder_name=shareholder.name if shareholder else None,
            share_class_name=share_class.name if share_class else None,
            vested_shares=vested,
            unvested_shares=(grant.shares - grant.cancelled_shares) - vested
        ))

    return result


@router.post("/equity-grants", response_model=EquityGrantResponse, status_code=status.HTTP_201_CREATED)
def create_equity_grant(
    data: EquityGrantCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new equity grant."""
    # Validate shareholder
    shareholder = db.query(Shareholder).filter(
        Shareholder.id == data.shareholder_id,
        Shareholder.organization_id == current_user.organization_id
    ).first()
    if not shareholder:
        raise HTTPException(status_code=404, detail="Shareholder not found")

    # Validate share class
    share_class = db.query(ShareClass).filter(
        ShareClass.id == data.share_class_id,
        ShareClass.organization_id == current_user.organization_id
    ).first()
    if not share_class:
        raise HTTPException(status_code=404, detail="Share class not found")

    grant = EquityGrant(
        organization_id=current_user.organization_id,
        **data.model_dump()
    )
    db.add(grant)
    db.commit()
    db.refresh(grant)

    return EquityGrantResponse(
        **{k: v for k, v in grant.__dict__.items() if not k.startswith('_')},
        shareholder_name=shareholder.name,
        share_class_name=share_class.name,
        vested_shares=grant.shares if grant.vesting_schedule == "immediate" else 0,
        unvested_shares=0 if grant.vesting_schedule == "immediate" else grant.shares
    )


@router.patch("/equity-grants/{grant_id}", response_model=EquityGrantResponse)
def update_equity_grant(
    grant_id: int,
    data: EquityGrantUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an equity grant."""
    grant = db.query(EquityGrant).filter(
        EquityGrant.id == grant_id,
        EquityGrant.organization_id == current_user.organization_id
    ).first()

    if not grant:
        raise HTTPException(status_code=404, detail="Equity grant not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(grant, key, value)

    db.commit()
    db.refresh(grant)

    shareholder = db.query(Shareholder).get(grant.shareholder_id)
    share_class = db.query(ShareClass).get(grant.share_class_id)

    vested = calculate_vested_shares(
        grant.shares - grant.cancelled_shares,
        grant.vesting_schedule,
        grant.vesting_start_date,
        grant.cliff_months,
        grant.vesting_period_months,
        grant.custom_vesting_schedule
    )

    return EquityGrantResponse(
        **{k: v for k, v in grant.__dict__.items() if not k.startswith('_')},
        shareholder_name=shareholder.name if shareholder else None,
        share_class_name=share_class.name if share_class else None,
        vested_shares=vested,
        unvested_shares=(grant.shares - grant.cancelled_shares) - vested
    )


@router.delete("/equity-grants/{grant_id}")
def delete_equity_grant(
    grant_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an equity grant."""
    grant = db.query(EquityGrant).filter(
        EquityGrant.id == grant_id,
        EquityGrant.organization_id == current_user.organization_id
    ).first()

    if not grant:
        raise HTTPException(status_code=404, detail="Equity grant not found")

    db.delete(grant)
    db.commit()
    return {"status": "deleted"}


# ============================================================================
# STOCK OPTIONS
# ============================================================================

@router.get("/stock-options", response_model=List[StockOptionResponse])
def list_stock_options(
    shareholder_id: Optional[int] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List stock options."""
    query = db.query(StockOption).filter(
        StockOption.organization_id == current_user.organization_id
    )

    if shareholder_id:
        query = query.filter(StockOption.shareholder_id == shareholder_id)
    if status:
        query = query.filter(StockOption.status == status)

    options = query.order_by(StockOption.grant_date.desc()).all()

    result = []
    for opt in options:
        shareholder = db.query(Shareholder).get(opt.shareholder_id)
        share_class = db.query(ShareClass).get(opt.share_class_id)

        remaining = opt.shares_granted - opt.shares_exercised - opt.shares_cancelled
        vested = calculate_vested_shares(
            remaining,
            opt.vesting_schedule,
            opt.vesting_start_date,
            opt.cliff_months,
            opt.vesting_period_months,
            opt.custom_vesting_schedule
        )

        result.append(StockOptionResponse(
            id=opt.id,
            shareholder_id=opt.shareholder_id,
            share_class_id=opt.share_class_id,
            option_type=opt.option_type,
            shares_granted=opt.shares_granted,
            exercise_price=opt.exercise_price,
            grant_date=opt.grant_date,
            expiration_date=opt.expiration_date,
            vesting_schedule=opt.vesting_schedule,
            vesting_start_date=opt.vesting_start_date,
            cliff_months=opt.cliff_months,
            vesting_period_months=opt.vesting_period_months,
            custom_vesting_schedule=opt.custom_vesting_schedule,
            allows_early_exercise=opt.allows_early_exercise,
            notes=opt.notes,
            shares_exercised=opt.shares_exercised,
            shares_cancelled=opt.shares_cancelled,
            early_exercised_shares=opt.early_exercised_shares,
            status=opt.status,
            created_at=opt.created_at,
            updated_at=opt.updated_at,
            shareholder_name=shareholder.name if shareholder else None,
            share_class_name=share_class.name if share_class else None,
            vested_options=vested,
            unvested_options=remaining - vested,
            exercisable_options=vested - opt.shares_exercised
        ))

    return result


@router.post("/stock-options", response_model=StockOptionResponse, status_code=status.HTTP_201_CREATED)
def create_stock_option(
    data: StockOptionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new stock option grant."""
    # Validate shareholder
    shareholder = db.query(Shareholder).filter(
        Shareholder.id == data.shareholder_id,
        Shareholder.organization_id == current_user.organization_id
    ).first()
    if not shareholder:
        raise HTTPException(status_code=404, detail="Shareholder not found")

    # Validate share class
    share_class = db.query(ShareClass).filter(
        ShareClass.id == data.share_class_id,
        ShareClass.organization_id == current_user.organization_id
    ).first()
    if not share_class:
        raise HTTPException(status_code=404, detail="Share class not found")

    option = StockOption(
        organization_id=current_user.organization_id,
        **data.model_dump()
    )
    db.add(option)
    db.commit()
    db.refresh(option)

    return StockOptionResponse(
        **{k: v for k, v in option.__dict__.items() if not k.startswith('_')},
        shareholder_name=shareholder.name,
        share_class_name=share_class.name,
        vested_options=0,
        unvested_options=option.shares_granted,
        exercisable_options=0
    )


@router.patch("/stock-options/{option_id}", response_model=StockOptionResponse)
def update_stock_option(
    option_id: int,
    data: StockOptionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a stock option."""
    option = db.query(StockOption).filter(
        StockOption.id == option_id,
        StockOption.organization_id == current_user.organization_id
    ).first()

    if not option:
        raise HTTPException(status_code=404, detail="Stock option not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(option, key, value)

    db.commit()
    db.refresh(option)

    shareholder = db.query(Shareholder).get(option.shareholder_id)
    share_class = db.query(ShareClass).get(option.share_class_id)

    remaining = option.shares_granted - option.shares_exercised - option.shares_cancelled
    vested = calculate_vested_shares(
        remaining,
        option.vesting_schedule,
        option.vesting_start_date,
        option.cliff_months,
        option.vesting_period_months,
        option.custom_vesting_schedule
    )

    return StockOptionResponse(
        **{k: v for k, v in option.__dict__.items() if not k.startswith('_')},
        shareholder_name=shareholder.name if shareholder else None,
        share_class_name=share_class.name if share_class else None,
        vested_options=vested,
        unvested_options=remaining - vested,
        exercisable_options=vested - option.shares_exercised
    )


@router.post("/stock-options/{option_id}/exercise")
def exercise_options(
    option_id: int,
    shares_to_exercise: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Exercise stock options."""
    option = db.query(StockOption).filter(
        StockOption.id == option_id,
        StockOption.organization_id == current_user.organization_id
    ).first()

    if not option:
        raise HTTPException(status_code=404, detail="Stock option not found")

    remaining = option.shares_granted - option.shares_exercised - option.shares_cancelled
    vested = calculate_vested_shares(
        remaining,
        option.vesting_schedule,
        option.vesting_start_date,
        option.cliff_months,
        option.vesting_period_months,
        option.custom_vesting_schedule
    )
    exercisable = vested - option.shares_exercised

    if shares_to_exercise > exercisable and not option.allows_early_exercise:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot exercise {shares_to_exercise} shares. Only {exercisable} are exercisable."
        )

    # Create equity grant for exercised shares
    grant = EquityGrant(
        organization_id=current_user.organization_id,
        shareholder_id=option.shareholder_id,
        share_class_id=option.share_class_id,
        shares=shares_to_exercise,
        price_per_share=option.exercise_price,
        grant_date=date.today(),
        vesting_schedule="immediate",
        notes=f"Exercised from option grant #{option.id}"
    )
    db.add(grant)

    # Update option
    option.shares_exercised += shares_to_exercise
    if option.shares_exercised >= option.shares_granted - option.shares_cancelled:
        option.status = "exercised"

    db.commit()

    return {
        "status": "exercised",
        "shares_exercised": shares_to_exercise,
        "equity_grant_id": grant.id
    }


@router.delete("/stock-options/{option_id}")
def delete_stock_option(
    option_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a stock option."""
    option = db.query(StockOption).filter(
        StockOption.id == option_id,
        StockOption.organization_id == current_user.organization_id
    ).first()

    if not option:
        raise HTTPException(status_code=404, detail="Stock option not found")

    if option.shares_exercised > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete option with exercised shares. Cancel instead."
        )

    db.delete(option)
    db.commit()
    return {"status": "deleted"}


# ============================================================================
# SAFE NOTES
# ============================================================================

@router.get("/safes", response_model=List[SafeNoteResponse])
def list_safes(
    include_converted: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List SAFE notes."""
    query = db.query(SafeNote).filter(
        SafeNote.organization_id == current_user.organization_id
    )

    if not include_converted:
        query = query.filter(SafeNote.is_converted == False)

    safes = query.order_by(SafeNote.signed_date.desc()).all()

    result = []
    for safe in safes:
        shareholder = db.query(Shareholder).get(safe.shareholder_id)
        result.append(SafeNoteResponse(
            **{k: v for k, v in safe.__dict__.items() if not k.startswith('_')},
            shareholder_name=shareholder.name if shareholder else None
        ))

    return result


@router.post("/safes", response_model=SafeNoteResponse, status_code=status.HTTP_201_CREATED)
def create_safe(
    data: SafeNoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new SAFE note."""
    # Validate shareholder
    shareholder = db.query(Shareholder).filter(
        Shareholder.id == data.shareholder_id,
        Shareholder.organization_id == current_user.organization_id
    ).first()
    if not shareholder:
        raise HTTPException(status_code=404, detail="Shareholder not found")

    safe = SafeNote(
        organization_id=current_user.organization_id,
        **data.model_dump()
    )
    db.add(safe)
    db.commit()
    db.refresh(safe)

    return SafeNoteResponse(
        **{k: v for k, v in safe.__dict__.items() if not k.startswith('_')},
        shareholder_name=shareholder.name
    )


@router.patch("/safes/{safe_id}", response_model=SafeNoteResponse)
def update_safe(
    safe_id: int,
    data: SafeNoteUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a SAFE note."""
    safe = db.query(SafeNote).filter(
        SafeNote.id == safe_id,
        SafeNote.organization_id == current_user.organization_id
    ).first()

    if not safe:
        raise HTTPException(status_code=404, detail="SAFE not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(safe, key, value)

    db.commit()
    db.refresh(safe)

    shareholder = db.query(Shareholder).get(safe.shareholder_id)

    return SafeNoteResponse(
        **{k: v for k, v in safe.__dict__.items() if not k.startswith('_')},
        shareholder_name=shareholder.name if shareholder else None
    )


@router.delete("/safes/{safe_id}")
def delete_safe(
    safe_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a SAFE note."""
    safe = db.query(SafeNote).filter(
        SafeNote.id == safe_id,
        SafeNote.organization_id == current_user.organization_id
    ).first()

    if not safe:
        raise HTTPException(status_code=404, detail="SAFE not found")

    if safe.is_converted:
        raise HTTPException(status_code=400, detail="Cannot delete converted SAFE")

    db.delete(safe)
    db.commit()
    return {"status": "deleted"}


# ============================================================================
# CONVERTIBLE NOTES
# ============================================================================

@router.get("/convertibles", response_model=List[ConvertibleNoteResponse])
def list_convertibles(
    include_converted: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List convertible notes."""
    query = db.query(ConvertibleNote).filter(
        ConvertibleNote.organization_id == current_user.organization_id
    )

    if not include_converted:
        query = query.filter(ConvertibleNote.is_converted == False)

    notes = query.order_by(ConvertibleNote.issue_date.desc()).all()

    result = []
    for note in notes:
        shareholder = db.query(Shareholder).get(note.shareholder_id)

        # Calculate accrued interest
        days_elapsed = (date.today() - note.issue_date).days
        accrued = note.principal_amount * note.interest_rate * (days_elapsed / 365)

        result.append(ConvertibleNoteResponse(
            **{k: v for k, v in note.__dict__.items() if not k.startswith('_')},
            shareholder_name=shareholder.name if shareholder else None,
            accrued_interest=round(accrued, 2),
            total_owed=round(note.principal_amount + accrued, 2)
        ))

    return result


@router.post("/convertibles", response_model=ConvertibleNoteResponse, status_code=status.HTTP_201_CREATED)
def create_convertible(
    data: ConvertibleNoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new convertible note."""
    shareholder = db.query(Shareholder).filter(
        Shareholder.id == data.shareholder_id,
        Shareholder.organization_id == current_user.organization_id
    ).first()
    if not shareholder:
        raise HTTPException(status_code=404, detail="Shareholder not found")

    note = ConvertibleNote(
        organization_id=current_user.organization_id,
        **data.model_dump()
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    return ConvertibleNoteResponse(
        **{k: v for k, v in note.__dict__.items() if not k.startswith('_')},
        shareholder_name=shareholder.name,
        accrued_interest=0.0,
        total_owed=note.principal_amount
    )


@router.patch("/convertibles/{note_id}", response_model=ConvertibleNoteResponse)
def update_convertible(
    note_id: int,
    data: ConvertibleNoteUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a convertible note."""
    note = db.query(ConvertibleNote).filter(
        ConvertibleNote.id == note_id,
        ConvertibleNote.organization_id == current_user.organization_id
    ).first()

    if not note:
        raise HTTPException(status_code=404, detail="Convertible note not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(note, key, value)

    db.commit()
    db.refresh(note)

    shareholder = db.query(Shareholder).get(note.shareholder_id)
    days_elapsed = (date.today() - note.issue_date).days
    accrued = note.principal_amount * note.interest_rate * (days_elapsed / 365)

    return ConvertibleNoteResponse(
        **{k: v for k, v in note.__dict__.items() if not k.startswith('_')},
        shareholder_name=shareholder.name if shareholder else None,
        accrued_interest=round(accrued, 2),
        total_owed=round(note.principal_amount + accrued, 2)
    )


@router.delete("/convertibles/{note_id}")
def delete_convertible(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a convertible note."""
    note = db.query(ConvertibleNote).filter(
        ConvertibleNote.id == note_id,
        ConvertibleNote.organization_id == current_user.organization_id
    ).first()

    if not note:
        raise HTTPException(status_code=404, detail="Convertible note not found")

    if note.is_converted:
        raise HTTPException(status_code=400, detail="Cannot delete converted note")

    db.delete(note)
    db.commit()
    return {"status": "deleted"}


# ============================================================================
# FUNDING ROUNDS
# ============================================================================

@router.get("/funding-rounds", response_model=List[FundingRoundResponse])
def list_funding_rounds(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List funding rounds."""
    rounds = db.query(FundingRound).filter(
        FundingRound.organization_id == current_user.organization_id
    ).order_by(FundingRound.closed_date.desc().nullsfirst()).all()

    result = []
    for fr in rounds:
        lead = db.query(Shareholder).get(fr.lead_investor_id) if fr.lead_investor_id else None
        result.append(FundingRoundResponse(
            **{k: v for k, v in fr.__dict__.items() if not k.startswith('_')},
            lead_investor_name=lead.name if lead else None
        ))

    return result


@router.post("/funding-rounds", response_model=FundingRoundResponse, status_code=status.HTTP_201_CREATED)
def create_funding_round(
    data: FundingRoundCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new funding round."""
    fr = FundingRound(
        organization_id=current_user.organization_id,
        **data.model_dump()
    )
    db.add(fr)
    db.commit()
    db.refresh(fr)

    lead = db.query(Shareholder).get(fr.lead_investor_id) if fr.lead_investor_id else None

    return FundingRoundResponse(
        **{k: v for k, v in fr.__dict__.items() if not k.startswith('_')},
        lead_investor_name=lead.name if lead else None
    )


@router.patch("/funding-rounds/{round_id}", response_model=FundingRoundResponse)
def update_funding_round(
    round_id: int,
    data: FundingRoundUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a funding round."""
    fr = db.query(FundingRound).filter(
        FundingRound.id == round_id,
        FundingRound.organization_id == current_user.organization_id
    ).first()

    if not fr:
        raise HTTPException(status_code=404, detail="Funding round not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(fr, key, value)

    db.commit()
    db.refresh(fr)

    lead = db.query(Shareholder).get(fr.lead_investor_id) if fr.lead_investor_id else None

    return FundingRoundResponse(
        **{k: v for k, v in fr.__dict__.items() if not k.startswith('_')},
        lead_investor_name=lead.name if lead else None
    )


@router.delete("/funding-rounds/{round_id}")
def delete_funding_round(
    round_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a funding round."""
    fr = db.query(FundingRound).filter(
        FundingRound.id == round_id,
        FundingRound.organization_id == current_user.organization_id
    ).first()

    if not fr:
        raise HTTPException(status_code=404, detail="Funding round not found")

    db.delete(fr)
    db.commit()
    return {"status": "deleted"}


# ============================================================================
# CAP TABLE SUMMARY & MODELING
# ============================================================================

@router.get("/summary", response_model=CapTableSummary)
def get_cap_table_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get cap table summary with ownership breakdown."""
    org_id = current_user.organization_id

    # Total authorized shares across all classes
    total_authorized = db.query(func.sum(ShareClass.authorized_shares)).filter(
        ShareClass.organization_id == org_id,
        ShareClass.is_active == True
    ).scalar() or 0

    # Total issued shares
    total_issued = db.query(func.sum(EquityGrant.shares - EquityGrant.cancelled_shares)).filter(
        EquityGrant.organization_id == org_id,
        EquityGrant.status == "active"
    ).scalar() or 0

    # Total outstanding options
    total_options = db.query(
        func.sum(StockOption.shares_granted - StockOption.shares_exercised - StockOption.shares_cancelled)
    ).filter(
        StockOption.organization_id == org_id,
        StockOption.status == "active"
    ).scalar() or 0

    fully_diluted = total_issued + total_options

    # Ownership by type
    def get_ownership_by_type(shareholder_type: str) -> int:
        shareholders = db.query(Shareholder.id).filter(
            Shareholder.organization_id == org_id,
            Shareholder.shareholder_type == shareholder_type,
            Shareholder.is_active == True
        ).all()
        sh_ids = [s.id for s in shareholders]
        if not sh_ids:
            return 0

        shares = db.query(func.sum(EquityGrant.shares - EquityGrant.cancelled_shares)).filter(
            EquityGrant.shareholder_id.in_(sh_ids),
            EquityGrant.status == "active"
        ).scalar() or 0

        options = db.query(
            func.sum(StockOption.shares_granted - StockOption.shares_exercised - StockOption.shares_cancelled)
        ).filter(
            StockOption.shareholder_id.in_(sh_ids),
            StockOption.status == "active"
        ).scalar() or 0

        return int(shares + options)

    founders_total = get_ownership_by_type("founder")
    investors_total = get_ownership_by_type("investor")
    employees_total = get_ownership_by_type("employee")

    # Calculate percentages
    founders_pct = (founders_total / fully_diluted * 100) if fully_diluted > 0 else 0
    investors_pct = (investors_total / fully_diluted * 100) if fully_diluted > 0 else 0
    employees_pct = (employees_total / fully_diluted * 100) if fully_diluted > 0 else 0
    option_pool_pct = (total_options / fully_diluted * 100) if fully_diluted > 0 else 0

    # Latest valuation
    latest_round = db.query(FundingRound).filter(
        FundingRound.organization_id == org_id,
        FundingRound.status == "closed"
    ).order_by(FundingRound.closed_date.desc()).first()

    latest_pps = latest_round.price_per_share if latest_round else None
    implied_val = (latest_pps * fully_diluted) if latest_pps and fully_diluted else None

    # Total convertibles
    total_safe = db.query(func.sum(SafeNote.investment_amount)).filter(
        SafeNote.organization_id == org_id,
        SafeNote.is_converted == False
    ).scalar() or 0

    total_convertible = db.query(func.sum(ConvertibleNote.principal_amount)).filter(
        ConvertibleNote.organization_id == org_id,
        ConvertibleNote.is_converted == False
    ).scalar() or 0

    # Share class breakdown
    share_classes = db.query(ShareClass).filter(
        ShareClass.organization_id == org_id,
        ShareClass.is_active == True
    ).all()

    class_breakdown = []
    for sc in share_classes:
        issued = db.query(func.sum(EquityGrant.shares - EquityGrant.cancelled_shares)).filter(
            EquityGrant.share_class_id == sc.id,
            EquityGrant.status == "active"
        ).scalar() or 0

        class_breakdown.append({
            "id": sc.id,
            "name": sc.name,
            "class_type": sc.class_type,
            "authorized": sc.authorized_shares or 0,
            "issued": int(issued),
            "price_per_share": sc.price_per_share
        })

    # Top shareholders
    shareholders = db.query(Shareholder).filter(
        Shareholder.organization_id == org_id,
        Shareholder.is_active == True
    ).all()

    top_shareholders = []
    for sh in shareholders:
        totals = get_shareholder_totals(db, sh.id, org_id)
        total = totals["total_shares"] + totals["total_options"]
        if total > 0:
            top_shareholders.append({
                "id": sh.id,
                "name": sh.name,
                "type": sh.shareholder_type,
                "shares": totals["total_shares"],
                "options": totals["total_options"],
                "percentage": round((total / fully_diluted * 100) if fully_diluted > 0 else 0, 2)
            })

    # Sort by percentage descending
    top_shareholders.sort(key=lambda x: x["percentage"], reverse=True)

    return CapTableSummary(
        total_authorized_shares=int(total_authorized),
        total_issued_shares=int(total_issued),
        total_outstanding_options=int(total_options),
        total_reserved_options=0,  # Would need separate tracking
        fully_diluted_shares=int(fully_diluted),
        founders_percentage=round(founders_pct, 2),
        investors_percentage=round(investors_pct, 2),
        employees_percentage=round(employees_pct, 2),
        option_pool_percentage=round(option_pool_pct, 2),
        latest_price_per_share=latest_pps,
        implied_valuation=implied_val,
        total_safe_amount=float(total_safe),
        total_convertible_amount=float(total_convertible),
        share_class_breakdown=class_breakdown,
        top_shareholders=top_shareholders[:10]  # Top 10
    )


@router.post("/model-dilution", response_model=DilutionScenario)
def model_dilution(
    scenario: DilutionScenario,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Model dilution from a potential funding round."""
    org_id = current_user.organization_id

    # Get current cap table
    total_issued = db.query(func.sum(EquityGrant.shares - EquityGrant.cancelled_shares)).filter(
        EquityGrant.organization_id == org_id,
        EquityGrant.status == "active"
    ).scalar() or 0

    total_options = db.query(
        func.sum(StockOption.shares_granted - StockOption.shares_exercised - StockOption.shares_cancelled)
    ).filter(
        StockOption.organization_id == org_id,
        StockOption.status == "active"
    ).scalar() or 0

    current_fully_diluted = total_issued + total_options

    # Calculate new round
    post_money = scenario.pre_money_valuation + scenario.new_money
    price_per_share = scenario.pre_money_valuation / current_fully_diluted if current_fully_diluted > 0 else 0
    new_shares = int(scenario.new_money / price_per_share) if price_per_share > 0 else 0

    # Option pool increase (pre-money)
    option_pool_shares = int(current_fully_diluted * scenario.option_pool_increase) if scenario.option_pool_increase > 0 else 0

    # New fully diluted
    new_fully_diluted = current_fully_diluted + new_shares + option_pool_shares

    # Calculate dilution
    new_investor_pct = (new_shares / new_fully_diluted * 100) if new_fully_diluted > 0 else 0

    # Get founder ownership
    founder_ids = db.query(Shareholder.id).filter(
        Shareholder.organization_id == org_id,
        Shareholder.shareholder_type == "founder"
    ).all()
    founder_ids = [f.id for f in founder_ids]

    founder_shares = 0
    if founder_ids:
        founder_shares = db.query(func.sum(EquityGrant.shares - EquityGrant.cancelled_shares)).filter(
            EquityGrant.shareholder_id.in_(founder_ids),
            EquityGrant.status == "active"
        ).scalar() or 0

    old_founder_pct = (founder_shares / current_fully_diluted * 100) if current_fully_diluted > 0 else 0
    new_founder_pct = (founder_shares / new_fully_diluted * 100) if new_fully_diluted > 0 else 0
    founder_dilution = old_founder_pct - new_founder_pct

    # Get investor ownership (existing)
    investor_ids = db.query(Shareholder.id).filter(
        Shareholder.organization_id == org_id,
        Shareholder.shareholder_type == "investor"
    ).all()
    investor_ids = [i.id for i in investor_ids]

    investor_shares = 0
    if investor_ids:
        investor_shares = db.query(func.sum(EquityGrant.shares - EquityGrant.cancelled_shares)).filter(
            EquityGrant.shareholder_id.in_(investor_ids),
            EquityGrant.status == "active"
        ).scalar() or 0

    old_investor_pct = (investor_shares / current_fully_diluted * 100) if current_fully_diluted > 0 else 0
    new_investor_pct_existing = (investor_shares / new_fully_diluted * 100) if new_fully_diluted > 0 else 0
    investor_dilution = old_investor_pct - new_investor_pct_existing

    return DilutionScenario(
        new_money=scenario.new_money,
        pre_money_valuation=scenario.pre_money_valuation,
        option_pool_increase=scenario.option_pool_increase,
        post_money_valuation=post_money,
        new_shares_issued=new_shares,
        new_investor_percentage=round(new_investor_pct, 2),
        founder_dilution=round(founder_dilution, 2),
        existing_investor_dilution=round(investor_dilution, 2)
    )


# ============================================================================
# 409A VALUATIONS
# ============================================================================

@router.get("/valuations", response_model=List[Valuation409AResponse])
def list_valuations(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all 409A valuations."""
    org_id = current_user.organization_id
    query = db.query(Valuation409A).filter(Valuation409A.organization_id == org_id)

    if status:
        query = query.filter(Valuation409A.status == status)

    valuations = query.order_by(Valuation409A.effective_date.desc()).all()
    today = date.today()

    result = []
    for val in valuations:
        is_expired = val.expiration_date < today
        days_until = (val.expiration_date - today).days

        result.append({
            "id": val.id,
            "valuation_date": val.valuation_date,
            "effective_date": val.effective_date,
            "expiration_date": val.expiration_date,
            "fmv_per_share": val.fmv_per_share,
            "total_common_shares": val.total_common_shares,
            "implied_company_value": val.implied_company_value,
            "provider_name": val.provider_name,
            "provider_type": val.provider_type,
            "report_document_id": val.report_document_id,
            "status": val.status,
            "valuation_method": val.valuation_method,
            "discount_for_lack_of_marketability": val.discount_for_lack_of_marketability,
            "trigger_event": val.trigger_event,
            "notes": val.notes,
            "created_by_id": val.created_by_id,
            "created_at": val.created_at,
            "updated_at": val.updated_at,
            "is_expired": is_expired,
            "days_until_expiration": days_until,
            "created_by_name": val.created_by.full_name if val.created_by else None,
        })

    return result


@router.get("/valuations/current", response_model=Optional[Valuation409AResponse])
def get_current_valuation(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the current (most recent, non-expired, final) 409A valuation."""
    org_id = current_user.organization_id
    today = date.today()

    val = db.query(Valuation409A).filter(
        Valuation409A.organization_id == org_id,
        Valuation409A.status == "final",
        Valuation409A.effective_date <= today,
        Valuation409A.expiration_date >= today
    ).order_by(Valuation409A.effective_date.desc()).first()

    if not val:
        return None

    is_expired = val.expiration_date < today
    days_until = (val.expiration_date - today).days

    return {
        "id": val.id,
        "valuation_date": val.valuation_date,
        "effective_date": val.effective_date,
        "expiration_date": val.expiration_date,
        "fmv_per_share": val.fmv_per_share,
        "total_common_shares": val.total_common_shares,
        "implied_company_value": val.implied_company_value,
        "provider_name": val.provider_name,
        "provider_type": val.provider_type,
        "report_document_id": val.report_document_id,
        "status": val.status,
        "valuation_method": val.valuation_method,
        "discount_for_lack_of_marketability": val.discount_for_lack_of_marketability,
        "trigger_event": val.trigger_event,
        "notes": val.notes,
        "created_by_id": val.created_by_id,
        "created_at": val.created_at,
        "updated_at": val.updated_at,
        "is_expired": is_expired,
        "days_until_expiration": days_until,
        "created_by_name": val.created_by.full_name if val.created_by else None,
    }


@router.post("/valuations", response_model=Valuation409AResponse)
def create_valuation(
    valuation: Valuation409ACreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new 409A valuation."""
    org_id = current_user.organization_id

    # Calculate implied company value if not provided
    implied_value = valuation.implied_company_value
    if not implied_value and valuation.total_common_shares:
        implied_value = valuation.fmv_per_share * valuation.total_common_shares

    db_valuation = Valuation409A(
        organization_id=org_id,
        valuation_date=valuation.valuation_date,
        effective_date=valuation.effective_date,
        expiration_date=valuation.expiration_date,
        fmv_per_share=valuation.fmv_per_share,
        total_common_shares=valuation.total_common_shares,
        implied_company_value=implied_value,
        provider_name=valuation.provider_name,
        provider_type=valuation.provider_type,
        report_document_id=valuation.report_document_id,
        status=valuation.status,
        valuation_method=valuation.valuation_method,
        discount_for_lack_of_marketability=valuation.discount_for_lack_of_marketability,
        trigger_event=valuation.trigger_event,
        notes=valuation.notes,
        created_by_id=current_user.id,
    )
    db.add(db_valuation)
    db.commit()
    db.refresh(db_valuation)

    today = date.today()
    is_expired = db_valuation.expiration_date < today
    days_until = (db_valuation.expiration_date - today).days

    return {
        "id": db_valuation.id,
        "valuation_date": db_valuation.valuation_date,
        "effective_date": db_valuation.effective_date,
        "expiration_date": db_valuation.expiration_date,
        "fmv_per_share": db_valuation.fmv_per_share,
        "total_common_shares": db_valuation.total_common_shares,
        "implied_company_value": db_valuation.implied_company_value,
        "provider_name": db_valuation.provider_name,
        "provider_type": db_valuation.provider_type,
        "report_document_id": db_valuation.report_document_id,
        "status": db_valuation.status,
        "valuation_method": db_valuation.valuation_method,
        "discount_for_lack_of_marketability": db_valuation.discount_for_lack_of_marketability,
        "trigger_event": db_valuation.trigger_event,
        "notes": db_valuation.notes,
        "created_by_id": db_valuation.created_by_id,
        "created_at": db_valuation.created_at,
        "updated_at": db_valuation.updated_at,
        "is_expired": is_expired,
        "days_until_expiration": days_until,
        "created_by_name": current_user.full_name,
    }


@router.get("/valuations/{valuation_id}", response_model=Valuation409AResponse)
def get_valuation(
    valuation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific 409A valuation."""
    org_id = current_user.organization_id

    val = db.query(Valuation409A).filter(
        Valuation409A.id == valuation_id,
        Valuation409A.organization_id == org_id
    ).first()

    if not val:
        raise HTTPException(status_code=404, detail="Valuation not found")

    today = date.today()
    is_expired = val.expiration_date < today
    days_until = (val.expiration_date - today).days

    return {
        "id": val.id,
        "valuation_date": val.valuation_date,
        "effective_date": val.effective_date,
        "expiration_date": val.expiration_date,
        "fmv_per_share": val.fmv_per_share,
        "total_common_shares": val.total_common_shares,
        "implied_company_value": val.implied_company_value,
        "provider_name": val.provider_name,
        "provider_type": val.provider_type,
        "report_document_id": val.report_document_id,
        "status": val.status,
        "valuation_method": val.valuation_method,
        "discount_for_lack_of_marketability": val.discount_for_lack_of_marketability,
        "trigger_event": val.trigger_event,
        "notes": val.notes,
        "created_by_id": val.created_by_id,
        "created_at": val.created_at,
        "updated_at": val.updated_at,
        "is_expired": is_expired,
        "days_until_expiration": days_until,
        "created_by_name": val.created_by.full_name if val.created_by else None,
    }


@router.patch("/valuations/{valuation_id}", response_model=Valuation409AResponse)
def update_valuation(
    valuation_id: int,
    updates: Valuation409AUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a 409A valuation."""
    org_id = current_user.organization_id

    val = db.query(Valuation409A).filter(
        Valuation409A.id == valuation_id,
        Valuation409A.organization_id == org_id
    ).first()

    if not val:
        raise HTTPException(status_code=404, detail="Valuation not found")

    update_data = updates.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(val, key, value)

    # Recalculate implied value if FMV or shares changed
    if "fmv_per_share" in update_data or "total_common_shares" in update_data:
        if val.total_common_shares:
            val.implied_company_value = val.fmv_per_share * val.total_common_shares

    db.commit()
    db.refresh(val)

    today = date.today()
    is_expired = val.expiration_date < today
    days_until = (val.expiration_date - today).days

    return {
        "id": val.id,
        "valuation_date": val.valuation_date,
        "effective_date": val.effective_date,
        "expiration_date": val.expiration_date,
        "fmv_per_share": val.fmv_per_share,
        "total_common_shares": val.total_common_shares,
        "implied_company_value": val.implied_company_value,
        "provider_name": val.provider_name,
        "provider_type": val.provider_type,
        "report_document_id": val.report_document_id,
        "status": val.status,
        "valuation_method": val.valuation_method,
        "discount_for_lack_of_marketability": val.discount_for_lack_of_marketability,
        "trigger_event": val.trigger_event,
        "notes": val.notes,
        "created_by_id": val.created_by_id,
        "created_at": val.created_at,
        "updated_at": val.updated_at,
        "is_expired": is_expired,
        "days_until_expiration": days_until,
        "created_by_name": val.created_by.full_name if val.created_by else None,
    }


@router.delete("/valuations/{valuation_id}")
def delete_valuation(
    valuation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a 409A valuation (only drafts can be deleted)."""
    org_id = current_user.organization_id

    val = db.query(Valuation409A).filter(
        Valuation409A.id == valuation_id,
        Valuation409A.organization_id == org_id
    ).first()

    if not val:
        raise HTTPException(status_code=404, detail="Valuation not found")

    if val.status == "final":
        raise HTTPException(status_code=400, detail="Cannot delete finalized valuations. Mark as superseded instead.")

    db.delete(val)
    db.commit()

    return {"message": "Valuation deleted"}


@router.post("/valuations/{valuation_id}/finalize", response_model=Valuation409AResponse)
def finalize_valuation(
    valuation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Finalize a 409A valuation and supersede any previous ones."""
    org_id = current_user.organization_id

    val = db.query(Valuation409A).filter(
        Valuation409A.id == valuation_id,
        Valuation409A.organization_id == org_id
    ).first()

    if not val:
        raise HTTPException(status_code=404, detail="Valuation not found")

    if val.status == "final":
        raise HTTPException(status_code=400, detail="Valuation is already finalized")

    # Supersede any previous final valuations that overlap
    db.query(Valuation409A).filter(
        Valuation409A.organization_id == org_id,
        Valuation409A.status == "final",
        Valuation409A.id != valuation_id,
        Valuation409A.effective_date <= val.expiration_date,
        Valuation409A.expiration_date >= val.effective_date
    ).update({"status": "superseded"})

    val.status = "final"
    db.commit()
    db.refresh(val)

    today = date.today()
    is_expired = val.expiration_date < today
    days_until = (val.expiration_date - today).days

    return {
        "id": val.id,
        "valuation_date": val.valuation_date,
        "effective_date": val.effective_date,
        "expiration_date": val.expiration_date,
        "fmv_per_share": val.fmv_per_share,
        "total_common_shares": val.total_common_shares,
        "implied_company_value": val.implied_company_value,
        "provider_name": val.provider_name,
        "provider_type": val.provider_type,
        "report_document_id": val.report_document_id,
        "status": val.status,
        "valuation_method": val.valuation_method,
        "discount_for_lack_of_marketability": val.discount_for_lack_of_marketability,
        "trigger_event": val.trigger_event,
        "notes": val.notes,
        "created_by_id": val.created_by_id,
        "created_at": val.created_at,
        "updated_at": val.updated_at,
        "is_expired": is_expired,
        "days_until_expiration": days_until,
        "created_by_name": val.created_by.full_name if val.created_by else None,
    }
