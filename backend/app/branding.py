"""
Branding API routes for managing brand assets, colors, fonts, and guidelines.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, UTC, UTC
import os
import shutil
import uuid

from .database import get_db
from .models import (
    User, Organization, Business, BrandColor, BrandFont, BrandAsset, BrandGuideline,
    ColorType, FontUsage, BrandAssetType
)
from .auth import get_current_user
from pydantic import BaseModel

router = APIRouter()

# ============ Pydantic Schemas ============

class BrandColorCreate(BaseModel):
    color_type: str  # primary, secondary, accent, background, text, success, warning, error, neutral
    hex_value: str
    name: Optional[str] = None
    description: Optional[str] = None
    business_id: Optional[int] = None  # None = org-level, ID = business-specific

class BrandColorUpdate(BaseModel):
    color_type: Optional[str] = None
    hex_value: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None

class BrandColorResponse(BaseModel):
    id: int
    organization_id: int
    business_id: Optional[int]
    color_type: str
    hex_value: str
    name: Optional[str]
    description: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BrandFontCreate(BaseModel):
    font_family: str
    usage: str  # heading, body, accent, monospace
    font_weight: Optional[str] = "400"
    google_font_url: Optional[str] = None
    fallback_fonts: Optional[str] = None
    business_id: Optional[int] = None  # None = org-level, ID = business-specific

class BrandFontUpdate(BaseModel):
    font_family: Optional[str] = None
    usage: Optional[str] = None
    font_weight: Optional[str] = None
    google_font_url: Optional[str] = None
    fallback_fonts: Optional[str] = None

class BrandFontResponse(BaseModel):
    id: int
    organization_id: int
    business_id: Optional[int]
    font_family: str
    usage: str
    font_weight: Optional[str]
    google_font_url: Optional[str]
    fallback_fonts: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BrandAssetResponse(BaseModel):
    id: int
    organization_id: int
    business_id: Optional[int]
    asset_type: str
    name: str
    file_path: str
    file_size: Optional[int]
    mime_type: Optional[str]
    width: Optional[int]
    height: Optional[int]
    description: Optional[str]
    tags: Optional[str]
    is_primary: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BrandGuidelineCreate(BaseModel):
    company_name: Optional[str] = None
    tagline: Optional[str] = None
    mission_statement: Optional[str] = None
    voice_tone: Optional[str] = None
    voice_description: Optional[str] = None
    logo_min_size: Optional[str] = None
    logo_clear_space: Optional[str] = None
    color_usage_notes: Optional[str] = None
    typography_notes: Optional[str] = None
    dos_and_donts: Optional[str] = None
    order_index: Optional[int] = 0
    business_id: Optional[int] = None  # None = org-level, ID = business-specific

class BrandGuidelineUpdate(BaseModel):
    company_name: Optional[str] = None
    tagline: Optional[str] = None
    mission_statement: Optional[str] = None
    voice_tone: Optional[str] = None
    voice_description: Optional[str] = None
    logo_min_size: Optional[str] = None
    logo_clear_space: Optional[str] = None
    color_usage_notes: Optional[str] = None
    typography_notes: Optional[str] = None
    dos_and_donts: Optional[str] = None
    order_index: Optional[int] = None

class BrandGuidelineResponse(BaseModel):
    id: int
    organization_id: int
    business_id: Optional[int]
    company_name: Optional[str]
    tagline: Optional[str]
    mission_statement: Optional[str]
    voice_tone: Optional[str]
    voice_description: Optional[str]
    logo_min_size: Optional[str]
    logo_clear_space: Optional[str]
    color_usage_notes: Optional[str]
    typography_notes: Optional[str]
    dos_and_donts: Optional[str]
    order_index: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BrandKitResponse(BaseModel):
    """Complete brand kit with all assets"""
    colors: List[BrandColorResponse]
    fonts: List[BrandFontResponse]
    assets: List[BrandAssetResponse]
    guidelines: List[BrandGuidelineResponse]


# Upload directory for brand assets
BRAND_ASSETS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "brand_assets")
os.makedirs(BRAND_ASSETS_DIR, exist_ok=True)

# Allowed file extensions for brand assets
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif", ".ico", ".pdf"}


def get_user_organization(user: User, db: Session) -> Organization:
    """Get the user's organization or raise 403."""
    if not user.organization_id:
        raise HTTPException(status_code=403, detail="User does not belong to an organization")
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


# ============ Brand Colors ============

@router.get("/colors", response_model=List[BrandColorResponse])
def get_brand_colors(
    business_id: Optional[int] = None,
    businesses: Optional[str] = None,  # Comma-separated business IDs
    include_org_level: bool = True,
    unassigned_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get brand colors, optionally filtered by business.

    Args:
        business_id: Filter by specific business (None = org-level only)
        businesses: Comma-separated list of business IDs for multi-select filtering
        include_org_level: Include org-level colors when filtering by business
        unassigned_only: Return only colors with no business assignment
    """
    org = get_user_organization(current_user, db)
    query = db.query(BrandColor).filter(BrandColor.organization_id == org.id)

    # Parse multi-business filter
    filter_business_ids = []
    if businesses:
        try:
            filter_business_ids = [int(b.strip()) for b in businesses.split(",") if b.strip()]
        except ValueError:
            pass

    if unassigned_only:
        # Only items with no business assignment
        query = query.filter(BrandColor.business_id.is_(None))
    elif filter_business_ids:
        # Multi-business filter
        if include_org_level:
            query = query.filter(
                (BrandColor.business_id.in_(filter_business_ids)) | (BrandColor.business_id.is_(None))
            )
        else:
            query = query.filter(BrandColor.business_id.in_(filter_business_ids))
    elif business_id:
        # Verify business belongs to org
        business = db.query(Business).filter(
            Business.id == business_id,
            Business.organization_id == org.id
        ).first()
        if not business:
            raise HTTPException(status_code=404, detail="Business not found")

        if include_org_level:
            # Include both business-specific and org-level (null business_id)
            query = query.filter(
                (BrandColor.business_id == business_id) | (BrandColor.business_id.is_(None))
            )
        else:
            query = query.filter(BrandColor.business_id == business_id)
    # If no filter, return all colors (both org-level and business-specific)

    colors = query.all()
    return colors


@router.post("/colors", response_model=BrandColorResponse)
def create_brand_color(
    color: BrandColorCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new brand color."""
    org = get_user_organization(current_user, db)

    # Validate business_id if provided
    if color.business_id:
        business = db.query(Business).filter(
            Business.id == color.business_id,
            Business.organization_id == org.id
        ).first()
        if not business:
            raise HTTPException(status_code=404, detail="Business not found")

    # Validate hex value
    hex_value = color.hex_value.strip()
    if not hex_value.startswith("#"):
        hex_value = f"#{hex_value}"
    if len(hex_value) not in [4, 7, 9]:  # #RGB, #RRGGBB, #RRGGBBAA
        raise HTTPException(status_code=400, detail="Invalid hex color format")

    db_color = BrandColor(
        organization_id=org.id,
        business_id=color.business_id,
        color_type=color.color_type,
        hex_value=hex_value,
        name=color.name,
        description=color.description
    )
    db.add(db_color)
    db.commit()
    db.refresh(db_color)
    return db_color


@router.put("/colors/{color_id}", response_model=BrandColorResponse)
def update_brand_color(
    color_id: int,
    color: BrandColorUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a brand color."""
    org = get_user_organization(current_user, db)
    db_color = db.query(BrandColor).filter(
        BrandColor.id == color_id,
        BrandColor.organization_id == org.id
    ).first()

    if not db_color:
        raise HTTPException(status_code=404, detail="Color not found")

    update_data = color.model_dump(exclude_unset=True)
    if "hex_value" in update_data:
        hex_value = update_data["hex_value"].strip()
        if not hex_value.startswith("#"):
            hex_value = f"#{hex_value}"
        update_data["hex_value"] = hex_value

    for key, value in update_data.items():
        setattr(db_color, key, value)

    db.commit()
    db.refresh(db_color)
    return db_color


@router.delete("/colors/{color_id}")
def delete_brand_color(
    color_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a brand color."""
    org = get_user_organization(current_user, db)
    db_color = db.query(BrandColor).filter(
        BrandColor.id == color_id,
        BrandColor.organization_id == org.id
    ).first()

    if not db_color:
        raise HTTPException(status_code=404, detail="Color not found")

    db.delete(db_color)
    db.commit()
    return {"message": "Color deleted"}


# ============ Brand Fonts ============

@router.get("/fonts", response_model=List[BrandFontResponse])
def get_brand_fonts(
    business_id: Optional[int] = None,
    businesses: Optional[str] = None,  # Comma-separated business IDs
    include_org_level: bool = True,
    unassigned_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get brand fonts, optionally filtered by business."""
    org = get_user_organization(current_user, db)
    query = db.query(BrandFont).filter(BrandFont.organization_id == org.id)

    # Parse multi-business filter
    filter_business_ids = []
    if businesses:
        try:
            filter_business_ids = [int(b.strip()) for b in businesses.split(",") if b.strip()]
        except ValueError:
            pass

    if unassigned_only:
        query = query.filter(BrandFont.business_id.is_(None))
    elif filter_business_ids:
        if include_org_level:
            query = query.filter(
                (BrandFont.business_id.in_(filter_business_ids)) | (BrandFont.business_id.is_(None))
            )
        else:
            query = query.filter(BrandFont.business_id.in_(filter_business_ids))
    elif business_id:
        business = db.query(Business).filter(
            Business.id == business_id,
            Business.organization_id == org.id
        ).first()
        if not business:
            raise HTTPException(status_code=404, detail="Business not found")

        if include_org_level:
            query = query.filter(
                (BrandFont.business_id == business_id) | (BrandFont.business_id.is_(None))
            )
        else:
            query = query.filter(BrandFont.business_id == business_id)
    # If no filter, return all fonts

    fonts = query.all()
    return fonts


@router.post("/fonts", response_model=BrandFontResponse)
def create_brand_font(
    font: BrandFontCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new brand font."""
    org = get_user_organization(current_user, db)

    if font.business_id:
        business = db.query(Business).filter(
            Business.id == font.business_id,
            Business.organization_id == org.id
        ).first()
        if not business:
            raise HTTPException(status_code=404, detail="Business not found")

    db_font = BrandFont(
        organization_id=org.id,
        business_id=font.business_id,
        font_family=font.font_family,
        usage=font.usage,
        font_weight=font.font_weight,
        google_font_url=font.google_font_url,
        fallback_fonts=font.fallback_fonts
    )
    db.add(db_font)
    db.commit()
    db.refresh(db_font)
    return db_font


@router.put("/fonts/{font_id}", response_model=BrandFontResponse)
def update_brand_font(
    font_id: int,
    font: BrandFontUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a brand font."""
    org = get_user_organization(current_user, db)
    db_font = db.query(BrandFont).filter(
        BrandFont.id == font_id,
        BrandFont.organization_id == org.id
    ).first()

    if not db_font:
        raise HTTPException(status_code=404, detail="Font not found")

    for key, value in font.model_dump(exclude_unset=True).items():
        setattr(db_font, key, value)

    db.commit()
    db.refresh(db_font)
    return db_font


@router.delete("/fonts/{font_id}")
def delete_brand_font(
    font_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a brand font."""
    org = get_user_organization(current_user, db)
    db_font = db.query(BrandFont).filter(
        BrandFont.id == font_id,
        BrandFont.organization_id == org.id
    ).first()

    if not db_font:
        raise HTTPException(status_code=404, detail="Font not found")

    db.delete(db_font)
    db.commit()
    return {"message": "Font deleted"}


# ============ Brand Assets ============

@router.get("/assets", response_model=List[BrandAssetResponse])
def get_brand_assets(
    asset_type: Optional[str] = None,
    business_id: Optional[int] = None,
    businesses: Optional[str] = None,  # Comma-separated business IDs
    include_org_level: bool = True,
    unassigned_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all brand assets for the organization, optionally filtered by business."""
    org = get_user_organization(current_user, db)
    query = db.query(BrandAsset).filter(BrandAsset.organization_id == org.id)

    if asset_type:
        query = query.filter(BrandAsset.asset_type == asset_type)

    # Parse multi-business filter
    filter_business_ids = []
    if businesses:
        try:
            filter_business_ids = [int(b.strip()) for b in businesses.split(",") if b.strip()]
        except ValueError:
            pass

    if unassigned_only:
        query = query.filter(BrandAsset.business_id.is_(None))
    elif filter_business_ids:
        if include_org_level:
            query = query.filter(
                (BrandAsset.business_id.in_(filter_business_ids)) | (BrandAsset.business_id.is_(None))
            )
        else:
            query = query.filter(BrandAsset.business_id.in_(filter_business_ids))
    elif business_id:
        business = db.query(Business).filter(
            Business.id == business_id,
            Business.organization_id == org.id
        ).first()
        if not business:
            raise HTTPException(status_code=404, detail="Business not found")

        if include_org_level:
            query = query.filter(
                (BrandAsset.business_id == business_id) | (BrandAsset.business_id.is_(None))
            )
        else:
            query = query.filter(BrandAsset.business_id == business_id)
    # If no filter, return all assets

    return query.all()


@router.post("/assets", response_model=BrandAssetResponse)
async def upload_brand_asset(
    file: UploadFile = File(...),
    asset_type: str = Form(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    is_primary: Optional[str] = Form("false"),  # Accept string, convert manually
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a new brand asset."""
    # Convert is_primary string to boolean
    is_primary_bool = is_primary.lower() in ("true", "1", "yes") if is_primary else False

    org = get_user_organization(current_user, db)

    # Validate file extension
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Create organization directory
    org_dir = os.path.join(BRAND_ASSETS_DIR, str(org.id))
    os.makedirs(org_dir, exist_ok=True)

    # Generate unique filename
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(org_dir, unique_filename)

    # Save file
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # Get file size
    file_size = len(content)

    # If this is primary, unset other primary assets of same type
    if is_primary_bool:
        db.query(BrandAsset).filter(
            BrandAsset.organization_id == org.id,
            BrandAsset.asset_type == asset_type,
            BrandAsset.is_primary == True
        ).update({"is_primary": False})

    # Create database record
    db_asset = BrandAsset(
        organization_id=org.id,
        asset_type=asset_type,
        name=name,
        file_path=unique_filename,
        file_name=file.filename,  # Original filename
        file_size=file_size,
        mime_type=file.content_type,
        description=description,
        tags=tags,
        is_primary=is_primary_bool
    )
    db.add(db_asset)
    db.commit()
    db.refresh(db_asset)
    return db_asset


@router.get("/assets/{asset_id}/download")
def download_brand_asset(
    asset_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download a brand asset file."""
    from fastapi.responses import FileResponse

    org = get_user_organization(current_user, db)
    db_asset = db.query(BrandAsset).filter(
        BrandAsset.id == asset_id,
        BrandAsset.organization_id == org.id
    ).first()

    if not db_asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    file_path = os.path.join(BRAND_ASSETS_DIR, str(org.id), db_asset.file_path)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Asset file not found")

    return FileResponse(
        file_path,
        filename=f"{db_asset.name}{os.path.splitext(db_asset.file_path)[1]}",
        media_type=db_asset.mime_type
    )


@router.put("/assets/{asset_id}", response_model=BrandAssetResponse)
def update_brand_asset(
    asset_id: int,
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    is_primary: Optional[str] = Form(None),  # Accept string, convert manually
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update brand asset metadata."""
    org = get_user_organization(current_user, db)
    db_asset = db.query(BrandAsset).filter(
        BrandAsset.id == asset_id,
        BrandAsset.organization_id == org.id
    ).first()

    if not db_asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    if name is not None:
        db_asset.name = name
    if description is not None:
        db_asset.description = description
    if tags is not None:
        db_asset.tags = tags
    if is_primary is not None:
        is_primary_bool = is_primary.lower() in ("true", "1", "yes")
        if is_primary_bool:
            # Unset other primary assets of same type
            db.query(BrandAsset).filter(
                BrandAsset.organization_id == org.id,
                BrandAsset.asset_type == db_asset.asset_type,
                BrandAsset.is_primary == True,
                BrandAsset.id != asset_id
            ).update({"is_primary": False})
        db_asset.is_primary = is_primary_bool

    db.commit()
    db.refresh(db_asset)
    return db_asset


@router.delete("/assets/{asset_id}")
def delete_brand_asset(
    asset_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a brand asset."""
    org = get_user_organization(current_user, db)
    db_asset = db.query(BrandAsset).filter(
        BrandAsset.id == asset_id,
        BrandAsset.organization_id == org.id
    ).first()

    if not db_asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # Delete file
    file_path = os.path.join(BRAND_ASSETS_DIR, str(org.id), db_asset.file_path)
    if os.path.exists(file_path):
        os.remove(file_path)

    db.delete(db_asset)
    db.commit()
    return {"message": "Asset deleted"}


# ============ Brand Guidelines ============

@router.get("/guidelines", response_model=List[BrandGuidelineResponse])
def get_brand_guidelines(
    category: Optional[str] = None,
    business_id: Optional[int] = None,
    businesses: Optional[str] = None,  # Comma-separated business IDs
    include_org_level: bool = True,
    unassigned_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get brand guidelines, optionally filtered by business."""
    org = get_user_organization(current_user, db)
    query = db.query(BrandGuideline).filter(BrandGuideline.organization_id == org.id)

    if category:
        query = query.filter(BrandGuideline.category == category)

    # Parse multi-business filter
    filter_business_ids = []
    if businesses:
        try:
            filter_business_ids = [int(b.strip()) for b in businesses.split(",") if b.strip()]
        except ValueError:
            pass

    if unassigned_only:
        query = query.filter(BrandGuideline.business_id.is_(None))
    elif filter_business_ids:
        if include_org_level:
            query = query.filter(
                (BrandGuideline.business_id.in_(filter_business_ids)) | (BrandGuideline.business_id.is_(None))
            )
        else:
            query = query.filter(BrandGuideline.business_id.in_(filter_business_ids))
    elif business_id:
        business = db.query(Business).filter(
            Business.id == business_id,
            Business.organization_id == org.id
        ).first()
        if not business:
            raise HTTPException(status_code=404, detail="Business not found")

        if include_org_level:
            query = query.filter(
                (BrandGuideline.business_id == business_id) | (BrandGuideline.business_id.is_(None))
            )
        else:
            query = query.filter(BrandGuideline.business_id == business_id)
    # If no filter, return all guidelines

    return query.order_by(BrandGuideline.order_index).all()


@router.post("/guidelines", response_model=BrandGuidelineResponse)
def create_brand_guideline(
    guideline: BrandGuidelineCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new brand guideline."""
    org = get_user_organization(current_user, db)

    if guideline.business_id:
        business = db.query(Business).filter(
            Business.id == guideline.business_id,
            Business.organization_id == org.id
        ).first()
        if not business:
            raise HTTPException(status_code=404, detail="Business not found")

    db_guideline = BrandGuideline(
        organization_id=org.id,
        business_id=guideline.business_id,
        title=guideline.title,
        category=guideline.category,
        content=guideline.content,
        order_index=guideline.order_index or 0
    )
    db.add(db_guideline)
    db.commit()
    db.refresh(db_guideline)
    return db_guideline


@router.put("/guidelines/{guideline_id}", response_model=BrandGuidelineResponse)
def update_brand_guideline(
    guideline_id: int,
    guideline: BrandGuidelineUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a brand guideline."""
    org = get_user_organization(current_user, db)
    db_guideline = db.query(BrandGuideline).filter(
        BrandGuideline.id == guideline_id,
        BrandGuideline.organization_id == org.id
    ).first()

    if not db_guideline:
        raise HTTPException(status_code=404, detail="Guideline not found")

    for key, value in guideline.model_dump(exclude_unset=True).items():
        setattr(db_guideline, key, value)

    db.commit()
    db.refresh(db_guideline)
    return db_guideline


@router.delete("/guidelines/{guideline_id}")
def delete_brand_guideline(
    guideline_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a brand guideline."""
    org = get_user_organization(current_user, db)
    db_guideline = db.query(BrandGuideline).filter(
        BrandGuideline.id == guideline_id,
        BrandGuideline.organization_id == org.id
    ).first()

    if not db_guideline:
        raise HTTPException(status_code=404, detail="Guideline not found")

    db.delete(db_guideline)
    db.commit()
    return {"message": "Guideline deleted"}


# ============ Brand Kit ============

@router.get("/kit", response_model=BrandKitResponse)
def get_brand_kit(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the complete brand kit for export."""
    org = get_user_organization(current_user, db)

    colors = db.query(BrandColor).filter(BrandColor.organization_id == org.id).all()
    fonts = db.query(BrandFont).filter(BrandFont.organization_id == org.id).all()
    assets = db.query(BrandAsset).filter(BrandAsset.organization_id == org.id).all()
    guidelines = db.query(BrandGuideline).filter(
        BrandGuideline.organization_id == org.id
    ).order_by(BrandGuideline.order_index).all()

    return BrandKitResponse(
        colors=colors,
        fonts=fonts,
        assets=assets,
        guidelines=guidelines
    )


@router.post("/kit/export")
def export_brand_kit(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Export brand kit as JSON for designers."""
    import json
    from fastapi.responses import Response

    org = get_user_organization(current_user, db)

    colors = db.query(BrandColor).filter(BrandColor.organization_id == org.id).all()
    fonts = db.query(BrandFont).filter(BrandFont.organization_id == org.id).all()
    guidelines = db.query(BrandGuideline).filter(
        BrandGuideline.organization_id == org.id
    ).order_by(BrandGuideline.order_index).all()

    export_data = {
        "organization": org.name,
        "exported_at": datetime.now(UTC).isoformat(),
        "colors": {
            color.color_type: {
                "hex": color.hex_value,
                "name": color.name,
                "description": color.description
            } for color in colors
        },
        "fonts": {
            font.usage: {
                "family": font.font_family,
                "weight": font.font_weight,
                "google_url": font.google_font_url,
                "fallbacks": font.fallback_fonts
            } for font in fonts
        },
        "guidelines": [
            {
                "category": g.category,
                "title": g.title,
                "content": g.content
            } for g in guidelines
        ]
    }

    return Response(
        content=json.dumps(export_data, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=brand-kit-{org.slug or org.id}.json"}
    )
