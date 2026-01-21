from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from uuid import uuid4

# Lazy import for icalendar (optional dependency)
try:
    from icalendar import Calendar as ICalendar, Event as ICalEvent, Alarm as ICalAlarm
    ICALENDAR_AVAILABLE = True
except ImportError:
    ICALENDAR_AVAILABLE = False
    ICalendar = None
    ICalEvent = None
    ICalAlarm = None
import re
import secrets
import mimetypes
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List
import os
import shutil
import logging
import json

from .database import engine, get_db, Base
from .models import (
    Service, Document, Contact, Deadline, BusinessInfo, BusinessIdentifier,
    ChecklistProgress, User, VaultConfig, Credential, ProductOffered, ProductUsed, WebLink,
    TaskBoard, TaskColumn, Task, TaskComment, TimeEntry, TaskActivity, Metric,
    WebPresence, BankAccount, Organization, BrandColor, BrandFont, BrandAsset,
    BrandGuideline, EmailTemplate, MarketingCampaign, CampaignVersion,
    EmailAnalytics, SocialAnalytics, EmailIntegration, OAuthConnection, DocumentTemplate,
    AccountingConnection, Business, Quest, BusinessQuest, Achievement, BusinessAchievement,
    Challenge, ChallengeParticipant, Marketplace, ContactSubmission
)
from .auth import router as auth_router, get_current_user
from .oauth import router as oauth_router
from .stripe_billing import router as stripe_router
from .branding import router as branding_router
from .marketing import router as marketing_router
from .social_oauth import router as social_oauth_router
from .accounting_oauth import router as accounting_router
from .mailchimp_api import mailchimp_router
from .templates import router as templates_router
from .mfa import router as mfa_router
from .schemas import (
    ServiceCreate, ServiceUpdate, ServiceResponse,
    DocumentCreate, DocumentUpdate, DocumentResponse,
    ContactCreate, ContactUpdate, ContactResponse,
    DeadlineCreate, DeadlineUpdate, DeadlineResponse,
    DashboardStats,
    BusinessCreate, BusinessUpdate, BusinessResponse, BusinessWithChildren, BusinessSwitchRequest,
    BusinessInfoCreate, BusinessInfoUpdate, BusinessInfoResponse,
    BusinessIdentifierCreate, BusinessIdentifierUpdate, BusinessIdentifierResponse, BusinessIdentifierMasked,
    ChecklistProgressCreate, ChecklistProgressUpdate, ChecklistProgressResponse,
    VaultSetup, VaultUnlock, VaultStatus,
    CredentialCreate, CredentialUpdate, CredentialMasked, CredentialDecrypted, CustomField,
    ProductOfferedCreate, ProductOfferedUpdate, ProductOfferedResponse,
    ProductUsedCreate, ProductUsedUpdate, ProductUsedResponse,
    WebLinkCreate, WebLinkUpdate, WebLinkResponse,
    TaskBoardCreate, TaskBoardUpdate, TaskBoardResponse,
    TaskColumnCreate, TaskColumnUpdate, TaskColumnResponse, ColumnReorder,
    TaskCreate, TaskUpdate, TaskResponse, TaskAssign, TaskMove,
    TaskCommentCreate, TaskCommentUpdate, TaskCommentResponse,
    TimeEntryCreate, TimeEntryUpdate, TimeEntryResponse, TimerStart,
    TaskActivityResponse, UserBrief,
    MetricCreate, MetricUpdate, MetricResponse, MetricSummary,
    WebPresenceCreate, WebPresenceUpdate, WebPresenceResponse,
    BankAccountCreate, BankAccountUpdate, BankAccountResponse,
    QuestCreate, QuestResponse, BusinessQuestResponse, QuestClaimResponse,
    AchievementCreate, AchievementResponse, BusinessAchievementResponse, AchievementClaimResponse,
    LeaderboardEntry, LeaderboardResponse,
    ChallengeCreate, ChallengeResponse, ChallengeParticipantBrief, ChallengeAcceptRequest,
    ChallengeJoinByCodeRequest, ChallengeListResponse, ChallengeResultResponse,
    MarketplaceCreate, MarketplaceUpdate, MarketplaceResponse,
    ContactSubmissionCreate
)
from .vault import (
    generate_salt, derive_key, hash_master_password, verify_master_password,
    encrypt_value, decrypt_value, VaultSession,
    encrypt_identifier, decrypt_identifier, get_app_encryption_key
)
from .security_middleware import (
    SecurityHeadersMiddleware,
    RateLimitMiddleware,
    AuditLogMiddleware,
    RequestValidationMiddleware
)
from .security import verify_password

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create tables
Base.metadata.create_all(bind=engine)

# Auto-migrate: Add missing columns if they don't exist
try:
    from sqlalchemy import text, inspect
    inspector = inspect(engine)

    # Users table migrations
    user_columns = [col['name'] for col in inspector.get_columns('users')]
    user_migrations = [
        ('calendar_token', 'ALTER TABLE users ADD COLUMN calendar_token VARCHAR(64)'),
        ('mfa_enabled', 'ALTER TABLE users ADD COLUMN mfa_enabled BOOLEAN DEFAULT 0'),
        ('mfa_secret', 'ALTER TABLE users ADD COLUMN mfa_secret VARCHAR(64)'),
        ('mfa_backup_codes', 'ALTER TABLE users ADD COLUMN mfa_backup_codes TEXT'),
    ]

    with engine.connect() as conn:
        for col_name, sql in user_migrations:
            if col_name not in user_columns:
                conn.execute(text(sql))
                logger.info(f"Added {col_name} column to users table")
        conn.commit()

    # Contacts table migrations
    contact_columns = [col['name'] for col in inspector.get_columns('contacts')]
    contact_migrations = [
        ('secondary_email', 'ALTER TABLE contacts ADD COLUMN secondary_email VARCHAR(255)'),
        ('mobile_phone', 'ALTER TABLE contacts ADD COLUMN mobile_phone VARCHAR(50)'),
        ('city', 'ALTER TABLE contacts ADD COLUMN city VARCHAR(100)'),
        ('state', 'ALTER TABLE contacts ADD COLUMN state VARCHAR(100)'),
        ('country', 'ALTER TABLE contacts ADD COLUMN country VARCHAR(100)'),
        ('timezone', 'ALTER TABLE contacts ADD COLUMN timezone VARCHAR(50)'),
        ('linkedin_url', 'ALTER TABLE contacts ADD COLUMN linkedin_url VARCHAR(500)'),
        ('twitter_handle', 'ALTER TABLE contacts ADD COLUMN twitter_handle VARCHAR(100)'),
        ('birthday', 'ALTER TABLE contacts ADD COLUMN birthday DATE'),
        ('tags', 'ALTER TABLE contacts ADD COLUMN tags TEXT'),
    ]

    with engine.connect() as conn:
        for col_name, sql in contact_migrations:
            if col_name not in contact_columns:
                conn.execute(text(sql))
                logger.info(f"Added {col_name} column to contacts table")
        conn.commit()
except Exception as e:
    logger.warning(f"Migration check failed (may be OK on fresh install): {e}")

app = FastAPI(
    title="Made4Founders API",
    version="1.0.0",
    docs_url="/docs" if os.getenv("ENVIRONMENT") != "production" else None,
    redoc_url=None,
    openapi_url="/openapi.json" if os.getenv("ENVIRONMENT") != "production" else None
)

# ============ SECURITY MIDDLEWARE (Order matters - first added = last executed) ============

# 1. Security Headers - Always applied
app.add_middleware(SecurityHeadersMiddleware)

# 2. Rate Limiting - Protect against abuse
app.add_middleware(RateLimitMiddleware)

# 3. Request Validation - Block malicious requests
app.add_middleware(RequestValidationMiddleware)

# 4. Audit Logging - Track sensitive operations
app.add_middleware(AuditLogMiddleware)

# 5. CORS - Tightened configuration
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:3000,https://made4founders.com")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in CORS_ORIGINS.split(",")],
    allow_credentials=True,
    # Restricted methods - only what's needed
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    # Restricted headers - only what's needed
    allow_headers=[
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
        "X-Requested-With",
        "Cookie"
    ],
    expose_headers=[
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset"
    ],
    max_age=600,  # Cache preflight for 10 minutes
)

# Create uploads directory with restricted permissions
# Use absolute path in Docker, relative path for local development
if os.path.exists("/app"):
    UPLOAD_DIR = "/app/uploads"
else:
    UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
# NOTE: Static file mount removed for security - use /api/documents/{id}/download instead

# Include routers
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(oauth_router, prefix="/api/auth", tags=["oauth"])
app.include_router(stripe_router, prefix="/api/billing", tags=["billing"])
app.include_router(branding_router, prefix="/api/branding", tags=["branding"])
app.include_router(marketing_router, prefix="/api/marketing", tags=["marketing"])
app.include_router(mailchimp_router, prefix="/api/mailchimp", tags=["mailchimp"])
app.include_router(templates_router, prefix="/api/templates", tags=["templates"])
app.include_router(social_oauth_router, prefix="/api/social", tags=["social"])
app.include_router(accounting_router, prefix="/api/accounting", tags=["accounting"])
app.include_router(mfa_router, prefix="/api/mfa", tags=["mfa"])

# Startup validation
@app.on_event("startup")
async def startup_validation():
    """Validate security configuration on startup."""
    secret_key = os.getenv("SECRET_KEY", "")
    if not secret_key or secret_key == "made4founders-dev-secret-change-in-production":
        if os.getenv("ENVIRONMENT") == "production":
            logger.error("CRITICAL: Using default SECRET_KEY in production!")
        else:
            logger.warning("Using default SECRET_KEY - set SECRET_KEY env var for production")

    app_key = os.getenv("APP_ENCRYPTION_KEY", "")
    if not app_key and os.getenv("ENVIRONMENT") == "production":
        logger.warning("APP_ENCRYPTION_KEY not set - using derived key")

    logger.info("Made4Founders API started with security middleware enabled")


# ============ Dashboard ============
@app.get("/api/dashboard/stats", response_model=DashboardStats)
def get_dashboard_stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = datetime.utcnow()
    thirty_days = now + timedelta(days=30)
    org_id = current_user.organization_id

    return DashboardStats(
        total_services=db.query(Service).filter(Service.organization_id == org_id).count(),
        total_documents=db.query(Document).filter(Document.organization_id == org_id).count(),
        total_contacts=db.query(Contact).filter(Contact.organization_id == org_id).count(),
        upcoming_deadlines=db.query(Deadline).filter(
            Deadline.organization_id == org_id,
            Deadline.is_completed == False,
            Deadline.due_date >= now,
            Deadline.due_date <= thirty_days
        ).count(),
        expiring_documents=db.query(Document).filter(
            Document.organization_id == org_id,
            Document.expiration_date != None,
            Document.expiration_date <= thirty_days
        ).count(),
        overdue_deadlines=db.query(Deadline).filter(
            Deadline.organization_id == org_id,
            Deadline.is_completed == False,
            Deadline.due_date < now
        ).count()
    )


# ============ Businesses (Fractal Hierarchy) ============

def build_business_tree(businesses: List[Business], parent_id=None) -> List[dict]:
    """Build nested tree structure from flat list of businesses"""
    tree = []
    for biz in businesses:
        if biz.parent_id == parent_id:
            children = build_business_tree(businesses, biz.id)
            biz_dict = {
                "id": biz.id,
                "organization_id": biz.organization_id,
                "parent_id": biz.parent_id,
                "name": biz.name,
                "slug": biz.slug,
                "business_type": biz.business_type,
                "description": biz.description,
                "color": biz.color,
                "emoji": biz.emoji,
                "is_active": biz.is_active,
                "is_archived": biz.is_archived,
                "xp": biz.xp,
                "level": biz.level,
                "current_streak": biz.current_streak,
                "longest_streak": biz.longest_streak,
                "health_score": biz.health_score,
                "health_compliance": biz.health_compliance,
                "health_financial": biz.health_financial,
                "health_operations": biz.health_operations,
                "health_growth": biz.health_growth,
                "achievements": biz.achievements or [],
                "created_at": biz.created_at,
                "updated_at": biz.updated_at,
                "children": children
            }
            tree.append(biz_dict)
    return tree


@app.get("/api/businesses", response_model=List[BusinessResponse])
def get_businesses(
    include_archived: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all businesses for the organization (flat list)"""
    query = db.query(Business).filter(Business.organization_id == current_user.organization_id)
    if not include_archived:
        query = query.filter(Business.is_archived == False)
    return query.order_by(Business.parent_id.nullsfirst(), Business.name).all()


@app.get("/api/businesses/tree")
def get_businesses_tree(
    include_archived: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get businesses as nested tree structure"""
    query = db.query(Business).filter(Business.organization_id == current_user.organization_id)
    if not include_archived:
        query = query.filter(Business.is_archived == False)
    businesses = query.all()
    return build_business_tree(businesses)


@app.get("/api/businesses/current", response_model=BusinessResponse)
def get_current_business(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's current business context"""
    if not current_user.current_business_id:
        raise HTTPException(status_code=404, detail="No business selected")
    business = db.query(Business).filter(
        Business.id == current_user.current_business_id,
        Business.organization_id == current_user.organization_id
    ).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return business


@app.post("/api/businesses/switch")
def switch_business(
    request: BusinessSwitchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Switch user's current business context"""
    if request.business_id:
        # Verify business exists and belongs to user's org
        business = db.query(Business).filter(
            Business.id == request.business_id,
            Business.organization_id == current_user.organization_id
        ).first()
        if not business:
            raise HTTPException(status_code=404, detail="Business not found")

    current_user.current_business_id = request.business_id
    db.commit()
    return {"message": "Business context switched", "business_id": request.business_id}


@app.post("/api/businesses", response_model=BusinessResponse)
def create_business(
    business: BusinessCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new business/venture"""
    # Verify parent exists if specified
    if business.parent_id:
        parent = db.query(Business).filter(
            Business.id == business.parent_id,
            Business.organization_id == current_user.organization_id
        ).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent business not found")

    # Generate slug if not provided
    slug = business.slug
    if not slug:
        slug = re.sub(r'[^a-z0-9]+', '-', business.name.lower()).strip('-')

    db_business = Business(
        organization_id=current_user.organization_id,
        **business.model_dump(exclude={'slug'}),
        slug=slug
    )
    db.add(db_business)
    db.commit()
    db.refresh(db_business)
    return db_business


@app.get("/api/businesses/{business_id}", response_model=BusinessResponse)
def get_business(
    business_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific business"""
    business = db.query(Business).filter(
        Business.id == business_id,
        Business.organization_id == current_user.organization_id
    ).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return business


@app.put("/api/businesses/{business_id}", response_model=BusinessResponse)
def update_business(
    business_id: int,
    business_update: BusinessUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a business"""
    business = db.query(Business).filter(
        Business.id == business_id,
        Business.organization_id == current_user.organization_id
    ).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    # Verify new parent if being changed
    if business_update.parent_id is not None and business_update.parent_id != business.parent_id:
        if business_update.parent_id:
            parent = db.query(Business).filter(
                Business.id == business_update.parent_id,
                Business.organization_id == current_user.organization_id
            ).first()
            if not parent:
                raise HTTPException(status_code=404, detail="Parent business not found")
            # Prevent circular reference
            if parent.id == business.id:
                raise HTTPException(status_code=400, detail="Cannot set self as parent")

    update_data = business_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(business, key, value)

    db.commit()
    db.refresh(business)
    return business


@app.delete("/api/businesses/{business_id}")
def delete_business(
    business_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a business (soft delete by archiving, or hard delete if no children)"""
    business = db.query(Business).filter(
        Business.id == business_id,
        Business.organization_id == current_user.organization_id
    ).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    # Check for children
    children = db.query(Business).filter(Business.parent_id == business_id).first()
    if children:
        # Soft delete (archive) if has children
        business.is_archived = True
        db.commit()
        return {"message": "Business archived (has children)", "archived": True}

    # Hard delete if no children
    db.delete(business)
    db.commit()
    return {"message": "Business deleted"}


# ============ XP Helper Functions ============

def _award_xp(db: Session, business_id: int, xp_amount: int, organization_id: int, user: User = None) -> dict | None:
    """
    Internal helper to award XP to a business.
    Returns XP stats or None if business not found or gamification disabled.

    Respects gamification toggle:
    - Business.gamification_enabled must be True
    - If user provided, User.gamification_enabled must also be True
    """
    if not business_id or xp_amount <= 0:
        return None

    business = db.query(Business).filter(
        Business.id == business_id,
        Business.organization_id == organization_id
    ).first()

    if not business:
        return None

    # Check gamification toggle - skip if disabled
    if not business.gamification_enabled:
        return None

    # Check user preference if provided
    if user and not user.gamification_enabled:
        return None

    business.xp += xp_amount

    # Level up logic (every 500 * level^1.5 XP)
    xp_for_level = lambda lvl: int(500 * (lvl ** 1.5))
    while business.xp >= xp_for_level(business.level):
        business.level += 1

    # Update streak
    from datetime import date as date_type
    today = date_type.today()
    if business.last_activity_date:
        days_diff = (today - business.last_activity_date).days
        if days_diff == 1:
            business.current_streak += 1
            if business.current_streak > business.longest_streak:
                business.longest_streak = business.current_streak
        elif days_diff > 1:
            business.current_streak = 1
    else:
        business.current_streak = 1

    business.last_activity_date = today

    db.commit()

    # Update achievement progress for XP-based achievements
    # (These need to be updated after XP changes)
    _update_achievement_progress_internal(db, business_id, "xp_total", absolute_value=business.xp)
    _update_achievement_progress_internal(db, business_id, "level_reach", absolute_value=business.level)
    _update_achievement_progress_internal(db, business_id, "streak_days", absolute_value=business.current_streak)

    return {
        "xp": business.xp,
        "level": business.level,
        "current_streak": business.current_streak,
        "longest_streak": business.longest_streak,
        "xp_awarded": xp_amount
    }


def _update_achievement_progress_internal(db: Session, business_id: int, action_type: str, increment: int = 1, absolute_value: int = None):
    """
    Internal helper to update achievement progress.
    Called from _award_xp and action-specific locations.
    """
    # Find all achievements matching this action type that aren't yet unlocked
    business_achievements = db.query(BusinessAchievement).join(Achievement).filter(
        BusinessAchievement.business_id == business_id,
        BusinessAchievement.is_unlocked == False,
        Achievement.requirement_type == action_type
    ).all()

    for ba in business_achievements:
        if absolute_value is not None:
            ba.current_count = absolute_value
        else:
            ba.current_count += increment

        if ba.current_count >= ba.target_count:
            ba.is_unlocked = True
            ba.unlocked_at = datetime.utcnow()


def _calculate_task_xp(task, completed_early: bool = False) -> int:
    """
    Calculate XP reward for completing a task.

    XP Breakdown:
    - Base completion: +10 XP
    - High priority: +5 XP bonus
    - Urgent priority: +10 XP bonus
    - Early completion (before due date): +5 XP bonus
    """
    xp = 10  # Base XP

    # Priority bonuses
    if task.priority == "high":
        xp += 5
    elif task.priority == "urgent":
        xp += 10

    # Early completion bonus
    if completed_early:
        xp += 5

    return xp


# XP values for various actions
XP_CHECKLIST_COMPLETE = 15  # Checklist items are foundational
XP_METRIC_ENTRY = 5         # Keeping metrics updated
XP_DOCUMENT_UPLOAD = 10     # Adding documentation
XP_CONTACT_CREATED = 5      # Building network


# ============ Quest System ============

# Default quest templates - seeded on first request
DEFAULT_QUESTS = [
    # Daily quests
    {
        "slug": "complete-1-task",
        "name": "Task Starter",
        "description": "Complete 1 task today",
        "quest_type": "daily",
        "category": "tasks",
        "target_count": 1,
        "action_type": "task_complete",
        "xp_reward": 15,
        "icon": "✓",
        "difficulty": "easy",
        "min_level": 1
    },
    {
        "slug": "complete-3-tasks",
        "name": "Task Master",
        "description": "Complete 3 tasks today",
        "quest_type": "daily",
        "category": "tasks",
        "target_count": 3,
        "action_type": "task_complete",
        "xp_reward": 30,
        "icon": "✓✓✓",
        "difficulty": "medium",
        "min_level": 1
    },
    {
        "slug": "log-metric",
        "name": "Data Driven",
        "description": "Log a business metric",
        "quest_type": "daily",
        "category": "metrics",
        "target_count": 1,
        "action_type": "metric_create",
        "xp_reward": 20,
        "icon": "📊",
        "difficulty": "easy",
        "min_level": 1
    },
    {
        "slug": "add-document",
        "name": "Documenter",
        "description": "Upload a document",
        "quest_type": "daily",
        "category": "documents",
        "target_count": 1,
        "action_type": "document_upload",
        "xp_reward": 20,
        "icon": "📄",
        "difficulty": "easy",
        "min_level": 1
    },
    {
        "slug": "complete-checklist",
        "name": "Compliance Hero",
        "description": "Complete a checklist item",
        "quest_type": "daily",
        "category": "checklist",
        "target_count": 1,
        "action_type": "checklist_complete",
        "xp_reward": 25,
        "icon": "📋",
        "difficulty": "medium",
        "min_level": 1
    },
    {
        "slug": "add-contact",
        "name": "Networker",
        "description": "Add a new contact",
        "quest_type": "daily",
        "category": "contacts",
        "target_count": 1,
        "action_type": "contact_create",
        "xp_reward": 15,
        "icon": "👤",
        "difficulty": "easy",
        "min_level": 1
    },
    # Weekly quests
    {
        "slug": "weekly-5-tasks",
        "name": "Weekly Warrior",
        "description": "Complete 5 tasks this week",
        "quest_type": "weekly",
        "category": "tasks",
        "target_count": 5,
        "action_type": "task_complete",
        "xp_reward": 75,
        "icon": "🏆",
        "difficulty": "medium",
        "min_level": 2
    },
    {
        "slug": "weekly-10-tasks",
        "name": "Productivity Champion",
        "description": "Complete 10 tasks this week",
        "quest_type": "weekly",
        "category": "tasks",
        "target_count": 10,
        "action_type": "task_complete",
        "xp_reward": 150,
        "icon": "👑",
        "difficulty": "hard",
        "min_level": 3
    },
    {
        "slug": "weekly-3-metrics",
        "name": "Analytics Pro",
        "description": "Log 3 metrics this week",
        "quest_type": "weekly",
        "category": "metrics",
        "target_count": 3,
        "action_type": "metric_create",
        "xp_reward": 50,
        "icon": "📈",
        "difficulty": "medium",
        "min_level": 2
    },
    # Achievement quests (one-time)
    {
        "slug": "first-task",
        "name": "First Steps",
        "description": "Complete your first task",
        "quest_type": "achievement",
        "category": "tasks",
        "target_count": 1,
        "action_type": "task_complete",
        "xp_reward": 50,
        "icon": "🎯",
        "difficulty": "easy",
        "min_level": 1
    },
    {
        "slug": "streak-7",
        "name": "Week Warrior",
        "description": "Maintain a 7-day activity streak",
        "quest_type": "achievement",
        "category": "streak",
        "target_count": 7,
        "action_type": "streak_days",
        "xp_reward": 100,
        "icon": "🔥",
        "difficulty": "medium",
        "min_level": 1
    },
    {
        "slug": "streak-30",
        "name": "Monthly Master",
        "description": "Maintain a 30-day activity streak",
        "quest_type": "achievement",
        "category": "streak",
        "target_count": 30,
        "action_type": "streak_days",
        "xp_reward": 500,
        "icon": "🌟",
        "difficulty": "hard",
        "min_level": 1
    },
]


# Default achievement definitions
DEFAULT_ACHIEVEMENTS = [
    # Task achievements
    {
        "slug": "first-task",
        "name": "First Steps",
        "description": "Complete your very first task",
        "category": "tasks",
        "rarity": "common",
        "requirement_type": "task_complete",
        "requirement_count": 1,
        "xp_reward": 50,
        "icon": "🎯",
        "badge_color": "gray",
        "sort_order": 1
    },
    {
        "slug": "task-10",
        "name": "Getting Things Done",
        "description": "Complete 10 tasks",
        "category": "tasks",
        "rarity": "common",
        "requirement_type": "task_complete",
        "requirement_count": 10,
        "xp_reward": 100,
        "icon": "✅",
        "badge_color": "green",
        "sort_order": 2
    },
    {
        "slug": "task-50",
        "name": "Task Champion",
        "description": "Complete 50 tasks",
        "category": "tasks",
        "rarity": "uncommon",
        "requirement_type": "task_complete",
        "requirement_count": 50,
        "xp_reward": 250,
        "icon": "🏅",
        "badge_color": "blue",
        "sort_order": 3
    },
    {
        "slug": "task-100",
        "name": "Century Club",
        "description": "Complete 100 tasks",
        "category": "tasks",
        "rarity": "rare",
        "requirement_type": "task_complete",
        "requirement_count": 100,
        "xp_reward": 500,
        "icon": "💯",
        "badge_color": "purple",
        "sort_order": 4
    },
    {
        "slug": "task-500",
        "name": "Legendary Achiever",
        "description": "Complete 500 tasks",
        "category": "tasks",
        "rarity": "legendary",
        "requirement_type": "task_complete",
        "requirement_count": 500,
        "xp_reward": 2000,
        "icon": "👑",
        "badge_color": "gold",
        "sort_order": 5
    },
    # Streak achievements
    {
        "slug": "streak-3",
        "name": "Warming Up",
        "description": "Maintain a 3-day activity streak",
        "category": "streaks",
        "rarity": "common",
        "requirement_type": "streak_days",
        "requirement_count": 3,
        "xp_reward": 50,
        "icon": "🔥",
        "badge_color": "orange",
        "sort_order": 10
    },
    {
        "slug": "streak-7",
        "name": "Week Warrior",
        "description": "Maintain a 7-day activity streak",
        "category": "streaks",
        "rarity": "uncommon",
        "requirement_type": "streak_days",
        "requirement_count": 7,
        "xp_reward": 150,
        "icon": "🔥",
        "badge_color": "orange",
        "sort_order": 11
    },
    {
        "slug": "streak-14",
        "name": "Fortnight Focus",
        "description": "Maintain a 14-day activity streak",
        "category": "streaks",
        "rarity": "rare",
        "requirement_type": "streak_days",
        "requirement_count": 14,
        "xp_reward": 300,
        "icon": "🔥",
        "badge_color": "red",
        "sort_order": 12
    },
    {
        "slug": "streak-30",
        "name": "Monthly Master",
        "description": "Maintain a 30-day activity streak",
        "category": "streaks",
        "rarity": "epic",
        "requirement_type": "streak_days",
        "requirement_count": 30,
        "xp_reward": 750,
        "icon": "🌟",
        "badge_color": "purple",
        "sort_order": 13
    },
    {
        "slug": "streak-100",
        "name": "Consistency Legend",
        "description": "Maintain a 100-day activity streak",
        "category": "streaks",
        "rarity": "legendary",
        "requirement_type": "streak_days",
        "requirement_count": 100,
        "xp_reward": 2500,
        "icon": "💫",
        "badge_color": "gold",
        "sort_order": 14
    },
    # Document achievements
    {
        "slug": "first-document",
        "name": "Paperwork Started",
        "description": "Upload your first document",
        "category": "documents",
        "rarity": "common",
        "requirement_type": "document_upload",
        "requirement_count": 1,
        "xp_reward": 50,
        "icon": "📄",
        "badge_color": "gray",
        "sort_order": 20
    },
    {
        "slug": "document-10",
        "name": "Document Collector",
        "description": "Upload 10 documents",
        "category": "documents",
        "rarity": "uncommon",
        "requirement_type": "document_upload",
        "requirement_count": 10,
        "xp_reward": 150,
        "icon": "📁",
        "badge_color": "blue",
        "sort_order": 21
    },
    # Checklist achievements
    {
        "slug": "checklist-10",
        "name": "Compliance Starter",
        "description": "Complete 10 checklist items",
        "category": "checklist",
        "rarity": "common",
        "requirement_type": "checklist_complete",
        "requirement_count": 10,
        "xp_reward": 150,
        "icon": "📋",
        "badge_color": "green",
        "sort_order": 30
    },
    {
        "slug": "checklist-50",
        "name": "Compliance Expert",
        "description": "Complete 50 checklist items",
        "category": "checklist",
        "rarity": "rare",
        "requirement_type": "checklist_complete",
        "requirement_count": 50,
        "xp_reward": 500,
        "icon": "✔️",
        "badge_color": "purple",
        "sort_order": 31
    },
    # Contact achievements
    {
        "slug": "first-contact",
        "name": "Making Connections",
        "description": "Add your first contact",
        "category": "contacts",
        "rarity": "common",
        "requirement_type": "contact_create",
        "requirement_count": 1,
        "xp_reward": 50,
        "icon": "👤",
        "badge_color": "gray",
        "sort_order": 40
    },
    {
        "slug": "contact-25",
        "name": "Network Builder",
        "description": "Add 25 contacts",
        "category": "contacts",
        "rarity": "uncommon",
        "requirement_type": "contact_create",
        "requirement_count": 25,
        "xp_reward": 200,
        "icon": "👥",
        "badge_color": "blue",
        "sort_order": 41
    },
    # Quest achievements
    {
        "slug": "quest-10",
        "name": "Quest Seeker",
        "description": "Complete 10 quests",
        "category": "quests",
        "rarity": "uncommon",
        "requirement_type": "quest_complete",
        "requirement_count": 10,
        "xp_reward": 200,
        "icon": "⚔️",
        "badge_color": "blue",
        "sort_order": 50
    },
    {
        "slug": "quest-50",
        "name": "Quest Master",
        "description": "Complete 50 quests",
        "category": "quests",
        "rarity": "rare",
        "requirement_type": "quest_complete",
        "requirement_count": 50,
        "xp_reward": 500,
        "icon": "🗡️",
        "badge_color": "purple",
        "sort_order": 51
    },
    # Milestone achievements
    {
        "slug": "level-5",
        "name": "Rising Star",
        "description": "Reach level 5",
        "category": "milestones",
        "rarity": "uncommon",
        "requirement_type": "level_reach",
        "requirement_count": 5,
        "xp_reward": 250,
        "icon": "⭐",
        "badge_color": "blue",
        "sort_order": 60
    },
    {
        "slug": "level-10",
        "name": "Established",
        "description": "Reach level 10",
        "category": "milestones",
        "rarity": "rare",
        "requirement_type": "level_reach",
        "requirement_count": 10,
        "xp_reward": 500,
        "icon": "🌟",
        "badge_color": "purple",
        "sort_order": 61
    },
    {
        "slug": "level-25",
        "name": "Expert Founder",
        "description": "Reach level 25",
        "category": "milestones",
        "rarity": "epic",
        "requirement_type": "level_reach",
        "requirement_count": 25,
        "xp_reward": 1500,
        "icon": "💎",
        "badge_color": "purple",
        "sort_order": 62
    },
    {
        "slug": "xp-1000",
        "name": "XP Collector",
        "description": "Earn 1,000 total XP",
        "category": "milestones",
        "rarity": "common",
        "requirement_type": "xp_total",
        "requirement_count": 1000,
        "xp_reward": 100,
        "icon": "💰",
        "badge_color": "green",
        "sort_order": 70
    },
    {
        "slug": "xp-10000",
        "name": "XP Master",
        "description": "Earn 10,000 total XP",
        "category": "milestones",
        "rarity": "rare",
        "requirement_type": "xp_total",
        "requirement_count": 10000,
        "xp_reward": 500,
        "icon": "💎",
        "badge_color": "purple",
        "sort_order": 71
    },
]


def _seed_default_achievements(db: Session):
    """Seed default achievement templates if they don't exist."""
    for achievement_data in DEFAULT_ACHIEVEMENTS:
        existing = db.query(Achievement).filter(Achievement.slug == achievement_data["slug"]).first()
        if not existing:
            achievement = Achievement(**achievement_data)
            db.add(achievement)
    db.commit()


def _seed_default_quests(db: Session):
    """Seed default quest templates if they don't exist."""
    for quest_data in DEFAULT_QUESTS:
        existing = db.query(Quest).filter(Quest.slug == quest_data["slug"]).first()
        if not existing:
            quest = Quest(**quest_data)
            db.add(quest)
    db.commit()


def _get_daily_quests_for_business(db: Session, business: Business, count: int = 3) -> List[BusinessQuest]:
    """
    Get or generate daily quests for a business.
    Returns existing quests if already generated today, otherwise generates new ones.
    """
    from datetime import date as date_type
    today = date_type.today()

    # Check if we already have today's daily quests
    existing_daily = db.query(BusinessQuest).join(Quest).filter(
        BusinessQuest.business_id == business.id,
        BusinessQuest.assigned_date == today,
        Quest.quest_type == "daily"
    ).all()

    if existing_daily:
        return existing_daily

    # Generate new daily quests
    # Get available daily quests for this business level
    available_quests = db.query(Quest).filter(
        Quest.quest_type == "daily",
        Quest.is_active == True,
        Quest.min_level <= business.level
    ).all()

    if not available_quests:
        return []

    # Randomly select quests (or all if fewer than count)
    import random
    selected = random.sample(available_quests, min(count, len(available_quests)))

    # Calculate end of day for expiration
    end_of_day = datetime.combine(today, datetime.max.time())

    new_quests = []
    for quest in selected:
        bq = BusinessQuest(
            business_id=business.id,
            quest_id=quest.id,
            target_count=quest.target_count,
            xp_reward=quest.xp_reward,
            assigned_date=today,
            expires_at=end_of_day
        )
        db.add(bq)
        new_quests.append(bq)

    db.commit()
    for bq in new_quests:
        db.refresh(bq)

    return new_quests


def _get_weekly_quests_for_business(db: Session, business: Business, count: int = 2) -> List[BusinessQuest]:
    """
    Get or generate weekly quests for a business.
    """
    from datetime import date as date_type
    today = date_type.today()
    # Get start of week (Monday)
    start_of_week = today - timedelta(days=today.weekday())

    # Check for existing weekly quests this week
    existing_weekly = db.query(BusinessQuest).join(Quest).filter(
        BusinessQuest.business_id == business.id,
        BusinessQuest.assigned_date >= start_of_week,
        Quest.quest_type == "weekly"
    ).all()

    if existing_weekly:
        return existing_weekly

    # Generate new weekly quests
    available_quests = db.query(Quest).filter(
        Quest.quest_type == "weekly",
        Quest.is_active == True,
        Quest.min_level <= business.level
    ).all()

    if not available_quests:
        return []

    import random
    selected = random.sample(available_quests, min(count, len(available_quests)))

    # End of week (Sunday night)
    end_of_week = datetime.combine(start_of_week + timedelta(days=6), datetime.max.time())

    new_quests = []
    for quest in selected:
        bq = BusinessQuest(
            business_id=business.id,
            quest_id=quest.id,
            target_count=quest.target_count,
            xp_reward=quest.xp_reward,
            assigned_date=today,
            expires_at=end_of_week
        )
        db.add(bq)
        new_quests.append(bq)

    db.commit()
    for bq in new_quests:
        db.refresh(bq)

    return new_quests


def _update_quest_progress(db: Session, business_id: int, action_type: str, increment: int = 1):
    """
    Update progress on all active quests matching the action type.
    Called when an action is performed (task completed, metric logged, etc.)
    """
    from datetime import date as date_type
    today = date_type.today()

    # Find all uncompleted quests for this business matching the action type
    active_quests = db.query(BusinessQuest).join(Quest).filter(
        BusinessQuest.business_id == business_id,
        BusinessQuest.is_completed == False,
        Quest.action_type == action_type,
        # Not expired
        (BusinessQuest.expires_at == None) | (BusinessQuest.expires_at > datetime.utcnow())
    ).all()

    for bq in active_quests:
        bq.current_count += increment

        # Check if quest is now complete
        if bq.current_count >= bq.target_count:
            bq.is_completed = True
            bq.completed_at = datetime.utcnow()


# Quest API Endpoints

@app.get("/api/quests/templates", response_model=List[QuestResponse])
def get_quest_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all available quest templates (admin use)."""
    # Seed defaults if needed
    _seed_default_quests(db)
    return db.query(Quest).filter(Quest.is_active == True).all()


@app.get("/api/businesses/{business_id}/quests", response_model=List[BusinessQuestResponse])
def get_business_quests(
    business_id: int,
    include_completed: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all quests for a business.
    Automatically generates daily/weekly quests if not already generated.
    """
    # Verify business belongs to user's org
    business = db.query(Business).filter(
        Business.id == business_id,
        Business.organization_id == current_user.organization_id
    ).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    # Check if gamification is enabled
    if not business.gamification_enabled:
        return []

    if not current_user.gamification_enabled:
        return []

    # Seed quest templates if needed
    _seed_default_quests(db)

    # Get/generate daily and weekly quests
    _get_daily_quests_for_business(db, business)
    _get_weekly_quests_for_business(db, business)

    # Build query
    query = db.query(BusinessQuest).filter(BusinessQuest.business_id == business_id)

    if not include_completed:
        query = query.filter(
            (BusinessQuest.is_claimed == False) |
            (BusinessQuest.completed_at > datetime.utcnow() - timedelta(hours=24))
        )

    # Filter out expired uncompleted quests
    query = query.filter(
        (BusinessQuest.expires_at == None) |
        (BusinessQuest.expires_at > datetime.utcnow()) |
        (BusinessQuest.is_completed == True)
    )

    return query.order_by(BusinessQuest.assigned_date.desc()).all()


@app.post("/api/businesses/{business_id}/quests/{quest_id}/claim", response_model=QuestClaimResponse)
def claim_quest_reward(
    business_id: int,
    quest_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Claim the XP reward for a completed quest."""
    # Verify business
    business = db.query(Business).filter(
        Business.id == business_id,
        Business.organization_id == current_user.organization_id
    ).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    # Find the business quest
    bq = db.query(BusinessQuest).filter(
        BusinessQuest.id == quest_id,
        BusinessQuest.business_id == business_id
    ).first()
    if not bq:
        raise HTTPException(status_code=404, detail="Quest not found")

    # Check if already claimed
    if bq.is_claimed:
        raise HTTPException(status_code=400, detail="Quest already claimed")

    # Check if completed
    if not bq.is_completed:
        raise HTTPException(status_code=400, detail="Quest not yet completed")

    # Award XP
    bq.is_claimed = True
    bq.claimed_at = datetime.utcnow()

    result = _award_xp(db, business_id, bq.xp_reward, current_user.organization_id, current_user)

    # Update achievement progress for quest completion
    _update_achievement_progress_internal(db, business_id, "quest_complete")

    db.commit()

    if result:
        return QuestClaimResponse(
            success=True,
            xp_awarded=bq.xp_reward,
            new_xp=result["xp"],
            new_level=result["level"],
            message=f"Claimed {bq.xp_reward} XP!"
        )
    else:
        # Gamification was disabled, but still mark as claimed
        return QuestClaimResponse(
            success=True,
            xp_awarded=0,
            new_xp=business.xp,
            new_level=business.level,
            message="Quest completed (gamification disabled)"
        )


@app.post("/api/businesses/{business_id}/xp")
def add_business_xp(
    business_id: int,
    xp_amount: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add XP to a business (used by gamification system)"""
    result = _award_xp(db, business_id, xp_amount, current_user.organization_id)
    if not result:
        raise HTTPException(status_code=404, detail="Business not found")

    db.commit()
    return result


# ============ Achievements ============

def _get_or_create_business_achievements(db: Session, business: Business):
    """
    Ensure all achievements exist for a business.
    Creates BusinessAchievement entries for any missing achievements.
    """
    # Seed default achievements if needed
    _seed_default_achievements(db)

    # Get all active achievements
    all_achievements = db.query(Achievement).filter(Achievement.is_active == True).all()

    # Get existing business achievements
    existing = db.query(BusinessAchievement).filter(
        BusinessAchievement.business_id == business.id
    ).all()
    existing_ids = {ba.achievement_id for ba in existing}

    # Create missing business achievements
    for achievement in all_achievements:
        if achievement.id not in existing_ids:
            ba = BusinessAchievement(
                business_id=business.id,
                achievement_id=achievement.id,
                current_count=0,
                target_count=achievement.requirement_count,
                xp_reward=achievement.xp_reward,
                is_unlocked=False
            )
            db.add(ba)

    db.commit()


def _update_achievement_progress(db: Session, business_id: int, action_type: str, increment: int = 1, absolute_value: int = None):
    """
    Update progress on achievements based on action type.
    Uses absolute_value for things like streak/level/xp that have a current value rather than increment.
    """
    # Find all achievements matching this action type that aren't yet unlocked
    business_achievements = db.query(BusinessAchievement).join(Achievement).filter(
        BusinessAchievement.business_id == business_id,
        BusinessAchievement.is_unlocked == False,
        Achievement.requirement_type == action_type
    ).all()

    for ba in business_achievements:
        if absolute_value is not None:
            # For things like streaks, level, XP - use the absolute value
            ba.current_count = absolute_value
        else:
            # For countable things - increment
            ba.current_count += increment

        # Check if achievement is now complete
        if ba.current_count >= ba.target_count:
            ba.is_unlocked = True
            ba.unlocked_at = datetime.utcnow()

    db.commit()


@app.get("/api/achievements", response_model=List[AchievementResponse])
def get_achievements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all available achievement templates."""
    _seed_default_achievements(db)
    return db.query(Achievement).filter(Achievement.is_active == True).order_by(Achievement.sort_order).all()


@app.get("/api/businesses/{business_id}/achievements", response_model=List[BusinessAchievementResponse])
def get_business_achievements(
    business_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all achievements for a business with progress."""
    # Verify business belongs to user's org
    business = db.query(Business).filter(
        Business.id == business_id,
        Business.organization_id == current_user.organization_id
    ).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    # Check if gamification is enabled
    if not business.gamification_enabled:
        return []

    if not current_user.gamification_enabled:
        return []

    # Ensure all achievements exist for this business
    _get_or_create_business_achievements(db, business)

    # Get all business achievements with their achievement data
    return db.query(BusinessAchievement).filter(
        BusinessAchievement.business_id == business_id
    ).order_by(
        BusinessAchievement.is_unlocked.desc(),
        Achievement.sort_order
    ).all()


@app.post("/api/businesses/{business_id}/achievements/{achievement_id}/claim", response_model=AchievementClaimResponse)
def claim_achievement_reward(
    business_id: int,
    achievement_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Claim the XP reward for an unlocked achievement."""
    # Verify business
    business = db.query(Business).filter(
        Business.id == business_id,
        Business.organization_id == current_user.organization_id
    ).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    # Find the business achievement
    ba = db.query(BusinessAchievement).filter(
        BusinessAchievement.id == achievement_id,
        BusinessAchievement.business_id == business_id
    ).first()
    if not ba:
        raise HTTPException(status_code=404, detail="Achievement not found")

    # Check if already claimed
    if ba.xp_claimed:
        raise HTTPException(status_code=400, detail="Achievement reward already claimed")

    # Check if unlocked
    if not ba.is_unlocked:
        raise HTTPException(status_code=400, detail="Achievement not yet unlocked")

    # Award XP
    ba.xp_claimed = True

    result = _award_xp(db, business_id, ba.xp_reward, current_user.organization_id, current_user)

    db.commit()

    achievement = db.query(Achievement).filter(Achievement.id == ba.achievement_id).first()

    if result:
        return AchievementClaimResponse(
            success=True,
            xp_awarded=ba.xp_reward,
            new_xp=result["xp"],
            new_level=result["level"],
            message=f"Achievement '{achievement.name}' claimed! +{ba.xp_reward} XP"
        )
    else:
        return AchievementClaimResponse(
            success=True,
            xp_awarded=0,
            new_xp=business.xp,
            new_level=business.level,
            message="Achievement unlocked (gamification disabled)"
        )


# ============ Leaderboard ============

@app.get("/api/leaderboard", response_model=LeaderboardResponse)
def get_leaderboard(
    limit: int = 25,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the global leaderboard of businesses ranked by XP.
    Only includes businesses with gamification enabled.
    """
    # Query top businesses by XP
    businesses = db.query(Business, Organization).join(
        Organization, Business.organization_id == Organization.id
    ).filter(
        Business.gamification_enabled == True,
        Business.is_active == True,
        Business.is_archived == False
    ).order_by(
        Business.xp.desc()
    ).limit(limit).all()

    entries = []
    for rank, (business, org) in enumerate(businesses, 1):
        # Count unlocked achievements for this business
        achievements_count = db.query(BusinessAchievement).filter(
            BusinessAchievement.business_id == business.id,
            BusinessAchievement.is_unlocked == True
        ).count()

        entries.append(LeaderboardEntry(
            rank=rank,
            business_id=business.id,
            business_name=business.name,
            business_emoji=business.emoji,
            business_color=business.color,
            organization_name=org.name,
            xp=business.xp,
            level=business.level,
            current_streak=business.current_streak,
            longest_streak=business.longest_streak,
            achievements_count=achievements_count
        ))

    # Find current user's rank if not in top results
    user_rank = None
    if current_user.current_business_id:
        user_business = db.query(Business).filter(
            Business.id == current_user.current_business_id
        ).first()
        if user_business and user_business.gamification_enabled:
            # Count how many businesses have more XP
            higher_xp_count = db.query(Business).filter(
                Business.gamification_enabled == True,
                Business.is_active == True,
                Business.is_archived == False,
                Business.xp > user_business.xp
            ).count()
            user_rank = higher_xp_count + 1

    total_count = db.query(Business).filter(
        Business.gamification_enabled == True,
        Business.is_active == True,
        Business.is_archived == False
    ).count()

    return LeaderboardResponse(
        entries=entries,
        total_count=total_count,
        user_rank=user_rank
    )


# ============ Challenge System ============

import secrets
import string

# Challenge type to action mapping (for progress tracking)
CHALLENGE_ACTION_MAP = {
    "task_sprint": "task_complete",
    "xp_race": "xp_earned",
    "streak_showdown": "streak_days",
    "quest_champion": "quest_complete",
    "checklist_blitz": "checklist_complete",
    "document_dash": "document_upload",
    "contact_collector": "contact_create",
}

# Duration to timedelta mapping
DURATION_MAP = {
    "3_days": timedelta(days=3),
    "1_week": timedelta(days=7),
    "2_weeks": timedelta(days=14),
    "1_month": timedelta(days=30),
}

# Titles that can be earned
CHALLENGE_TITLES = {
    "first_win": {"name": "Challenger", "description": "Win your first challenge", "wins_required": 1},
    "five_wins": {"name": "Competitor", "description": "Win 5 challenges", "wins_required": 5},
    "ten_wins": {"name": "Champion", "description": "Win 10 challenges", "wins_required": 10},
    "twenty_five_wins": {"name": "Grand Champion", "description": "Win 25 challenges", "wins_required": 25},
    "streak_3": {"name": "Hot Streak", "description": "Win 3 challenges in a row", "streak_required": 3},
    "streak_5": {"name": "Unstoppable", "description": "Win 5 challenges in a row", "streak_required": 5},
    "streak_10": {"name": "Legendary", "description": "Win 10 challenges in a row", "streak_required": 10},
}


def _generate_invite_code(length: int = 8) -> str:
    """Generate a unique invite code."""
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))


def _get_current_count_for_challenge_type(db: Session, business_id: int, challenge_type: str) -> int:
    """Get the current count for a specific challenge type."""
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        return 0

    if challenge_type == "xp_race":
        return business.xp
    elif challenge_type == "streak_showdown":
        return business.current_streak
    elif challenge_type == "task_sprint":
        # Count completed tasks
        return db.query(Task).filter(
            Task.business_id == business_id,
            Task.status == "done"
        ).count()
    elif challenge_type == "quest_champion":
        # Count claimed quests
        return db.query(BusinessQuest).filter(
            BusinessQuest.business_id == business_id,
            BusinessQuest.is_claimed == True
        ).count()
    elif challenge_type == "checklist_blitz":
        return db.query(ChecklistProgress).filter(
            ChecklistProgress.business_id == business_id,
            ChecklistProgress.is_completed == True
        ).count()
    elif challenge_type == "document_dash":
        return db.query(Document).filter(Document.business_id == business_id).count()
    elif challenge_type == "contact_collector":
        return db.query(Contact).filter(Contact.business_id == business_id).count()

    return 0


def _calculate_handicap(level1: int, level2: int) -> tuple[int, int]:
    """
    Calculate handicap percentages based on level difference.
    Higher level player gets 0%, lower level gets boost.
    Returns (handicap1, handicap2)
    """
    if level1 == level2:
        return (0, 0)

    level_diff = abs(level1 - level2)
    # 5% per level difference, max 50%
    handicap = min(level_diff * 5, 50)

    if level1 > level2:
        return (0, handicap)  # Player 2 gets handicap
    else:
        return (handicap, 0)  # Player 1 gets handicap


def _update_challenge_progress(db: Session, business_id: int, action_type: str, increment: int = 1, absolute_value: int = None):
    """Update progress for all active challenges this business is in."""
    # Find active challenge participations for this business
    participations = db.query(ChallengeParticipant).join(Challenge).filter(
        ChallengeParticipant.business_id == business_id,
        ChallengeParticipant.has_accepted == True,
        Challenge.status == "active"
    ).all()

    for participation in participations:
        challenge = participation.challenge
        challenge_action = CHALLENGE_ACTION_MAP.get(challenge.challenge_type)

        if challenge_action == action_type:
            if absolute_value is not None:
                participation.current_count = absolute_value
            else:
                participation.current_count += increment

            participation.progress = participation.current_count - participation.starting_count
            # Apply handicap
            participation.adjusted_progress = int(
                participation.progress * (1 + participation.handicap_percent / 100)
            )

            # Check if target reached (if target_count set)
            if challenge.target_count and participation.adjusted_progress >= challenge.target_count:
                _complete_challenge(db, challenge, participation.business_id)

    db.commit()


def _complete_challenge(db: Session, challenge: Challenge, winner_id: int = None):
    """Complete a challenge and determine winner."""
    if challenge.status == "completed":
        return

    # Get all participants
    participants = db.query(ChallengeParticipant).filter(
        ChallengeParticipant.challenge_id == challenge.id,
        ChallengeParticipant.has_accepted == True
    ).all()

    if not participants:
        challenge.status = "cancelled"
        db.commit()
        return

    # Sort by adjusted progress (descending)
    participants.sort(key=lambda p: p.adjusted_progress, reverse=True)

    # Assign ranks
    for rank, participant in enumerate(participants, 1):
        participant.final_rank = rank

    # Determine winner (highest adjusted progress, or provided winner_id for target-based)
    if winner_id:
        challenge.winner_id = winner_id
    else:
        if participants[0].adjusted_progress > 0:
            # Check for tie
            if len(participants) > 1 and participants[0].adjusted_progress == participants[1].adjusted_progress:
                challenge.winner_id = None  # Tie
            else:
                challenge.winner_id = participants[0].business_id
        else:
            challenge.winner_id = None  # No one made progress

    challenge.status = "completed"
    challenge.completed_at = datetime.utcnow()

    # Distribute XP
    total_wagered = sum(p.xp_wagered for p in participants)

    for participant in participants:
        business = db.query(Business).filter(Business.id == participant.business_id).first()
        if not business:
            continue

        if challenge.winner_id == participant.business_id:
            # Winner gets: their wager back + opponent's wager + bonus
            participant.xp_won = total_wagered + challenge.winner_bonus_xp
            participant.xp_lost = 0
            business.xp += participant.xp_won

            # Update win stats
            business.challenge_wins += 1
            business.challenge_win_streak += 1
            if business.challenge_win_streak > business.best_challenge_win_streak:
                business.best_challenge_win_streak = business.challenge_win_streak

            # Check for new titles
            _check_and_award_titles(db, business)

        elif challenge.winner_id is None:
            # Draw - everyone gets their wager back
            participant.xp_won = participant.xp_wagered
            participant.xp_lost = 0
            business.xp += participant.xp_wagered  # Return wager
            business.challenge_draws += 1
            business.challenge_win_streak = 0  # Reset streak on draw

        else:
            # Loser loses their wager
            participant.xp_won = 0
            participant.xp_lost = participant.xp_wagered
            business.challenge_losses += 1
            business.challenge_win_streak = 0  # Reset streak

    db.commit()


def _check_and_award_titles(db: Session, business: Business):
    """Check if business earned any new titles."""
    current_titles = business.titles or []

    for title_id, title_info in CHALLENGE_TITLES.items():
        if title_id in current_titles:
            continue

        if "wins_required" in title_info and business.challenge_wins >= title_info["wins_required"]:
            current_titles.append(title_id)
        elif "streak_required" in title_info and business.challenge_win_streak >= title_info["streak_required"]:
            current_titles.append(title_id)

    business.titles = current_titles


def _build_challenge_response(
    db: Session,
    challenge: Challenge,
    current_business_id: int = None
) -> ChallengeResponse:
    """Build a full challenge response with participant info."""
    participants_brief = []

    for p in challenge.participants:
        business = db.query(Business).filter(Business.id == p.business_id).first()
        if business:
            participants_brief.append(ChallengeParticipantBrief(
                id=p.id,
                business_id=p.business_id,
                business_name=business.name,
                business_emoji=business.emoji,
                business_color=business.color,
                business_level=business.level,
                is_creator=p.is_creator,
                has_accepted=p.has_accepted,
                progress=p.progress,
                adjusted_progress=p.adjusted_progress,
                handicap_percent=p.handicap_percent,
                xp_wagered=p.xp_wagered,
                final_rank=p.final_rank,
                xp_won=p.xp_won,
                xp_lost=p.xp_lost,
            ))

    # Calculate time remaining
    time_remaining = None
    if challenge.ends_at and challenge.status == "active":
        delta = challenge.ends_at - datetime.utcnow()
        if delta.total_seconds() > 0:
            days = delta.days
            hours = delta.seconds // 3600
            minutes = (delta.seconds % 3600) // 60
            if days > 0:
                time_remaining = f"{days}d {hours}h"
            elif hours > 0:
                time_remaining = f"{hours}h {minutes}m"
            else:
                time_remaining = f"{minutes}m"

    # Find current user's progress and opponent's progress
    your_progress = None
    opponent_progress = None
    if current_business_id:
        for p in participants_brief:
            if p.business_id == current_business_id:
                your_progress = p.adjusted_progress
            else:
                opponent_progress = p.adjusted_progress

    return ChallengeResponse(
        id=challenge.id,
        name=challenge.name,
        description=challenge.description,
        challenge_type=challenge.challenge_type,
        invite_code=challenge.invite_code,
        is_public=challenge.is_public,
        duration=challenge.duration,
        status=challenge.status,
        starts_at=challenge.starts_at,
        ends_at=challenge.ends_at,
        target_count=challenge.target_count,
        xp_wager=challenge.xp_wager,
        winner_bonus_xp=challenge.winner_bonus_xp,
        handicap_enabled=challenge.handicap_enabled,
        created_by_id=challenge.created_by_id,
        winner_id=challenge.winner_id,
        participant_count=challenge.participant_count,
        max_participants=challenge.max_participants,
        created_at=challenge.created_at,
        completed_at=challenge.completed_at,
        participants=participants_brief,
        time_remaining=time_remaining,
        your_progress=your_progress,
        opponent_progress=opponent_progress,
    )


@app.post("/api/challenges", response_model=ChallengeResponse)
def create_challenge(
    challenge_data: ChallengeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new challenge."""
    if not current_user.current_business_id:
        raise HTTPException(status_code=400, detail="No business selected")

    business = db.query(Business).filter(
        Business.id == current_user.current_business_id,
        Business.organization_id == current_user.organization_id
    ).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    if not business.gamification_enabled:
        raise HTTPException(status_code=400, detail="Gamification is disabled for this business")

    # Validate wager against available XP
    if challenge_data.xp_wager > business.xp:
        raise HTTPException(status_code=400, detail=f"Insufficient XP. You have {business.xp} XP")

    # Generate unique invite code
    invite_code = _generate_invite_code()
    while db.query(Challenge).filter(Challenge.invite_code == invite_code).first():
        invite_code = _generate_invite_code()

    # Create challenge
    challenge = Challenge(
        name=challenge_data.name,
        description=challenge_data.description,
        challenge_type=challenge_data.challenge_type,
        invite_code=invite_code,
        duration=challenge_data.duration,
        target_count=challenge_data.target_count,
        xp_wager=challenge_data.xp_wager,
        winner_bonus_xp=100 + (challenge_data.xp_wager // 2),  # Bonus scales with wager
        handicap_enabled=challenge_data.handicap_enabled,
        is_public=challenge_data.is_public,
        max_participants=challenge_data.max_participants,
        created_by_id=business.id,
        status="pending",
    )
    db.add(challenge)
    db.flush()  # Get the ID

    # Add creator as first participant
    starting_count = _get_current_count_for_challenge_type(db, business.id, challenge_data.challenge_type)
    creator_participant = ChallengeParticipant(
        challenge_id=challenge.id,
        business_id=business.id,
        is_creator=True,
        has_accepted=True,
        accepted_at=datetime.utcnow(),
        starting_count=starting_count,
        current_count=starting_count,
        xp_wagered=challenge_data.xp_wager,
    )
    db.add(creator_participant)

    # Deduct wagered XP from creator
    if challenge_data.xp_wager > 0:
        business.xp -= challenge_data.xp_wager

    challenge.participant_count = 1
    db.commit()
    db.refresh(challenge)

    return _build_challenge_response(db, challenge, business.id)


@app.get("/api/challenges", response_model=ChallengeListResponse)
def get_challenges(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all challenges for the current business."""
    if not current_user.current_business_id:
        return ChallengeListResponse(active=[], pending=[], completed=[], invitations=[])

    business_id = current_user.current_business_id

    # Check for expired challenges and complete them
    expired_challenges = db.query(Challenge).filter(
        Challenge.status == "active",
        Challenge.ends_at < datetime.utcnow()
    ).all()
    for challenge in expired_challenges:
        _complete_challenge(db, challenge)

    # Get challenges where this business is a participant
    my_participations = db.query(ChallengeParticipant).filter(
        ChallengeParticipant.business_id == business_id
    ).all()
    my_challenge_ids = [p.challenge_id for p in my_participations]

    active = []
    pending = []
    completed = []
    invitations = []

    for participation in my_participations:
        challenge = db.query(Challenge).filter(Challenge.id == participation.challenge_id).first()
        if not challenge:
            continue

        response = _build_challenge_response(db, challenge, business_id)

        if challenge.status == "active":
            active.append(response)
        elif challenge.status == "pending":
            if participation.has_accepted:
                pending.append(response)
            else:
                invitations.append(response)
        elif challenge.status == "completed":
            completed.append(response)

    # Sort: active by end time, completed by completion time
    active.sort(key=lambda c: c.ends_at or datetime.max)
    completed.sort(key=lambda c: c.completed_at or datetime.min, reverse=True)

    return ChallengeListResponse(
        active=active,
        pending=pending,
        completed=completed[:20],  # Limit completed to recent 20
        invitations=invitations,
    )


@app.get("/api/challenges/public", response_model=List[ChallengeResponse])
def get_public_challenges(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get public challenges that can be joined."""
    challenges = db.query(Challenge).filter(
        Challenge.is_public == True,
        Challenge.status == "pending",
        Challenge.participant_count < Challenge.max_participants
    ).order_by(Challenge.created_at.desc()).limit(20).all()

    business_id = current_user.current_business_id
    return [_build_challenge_response(db, c, business_id) for c in challenges]


@app.get("/api/challenges/{challenge_id}", response_model=ChallengeResponse)
def get_challenge(
    challenge_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific challenge."""
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    # Check if user is a participant or challenge is public
    is_participant = db.query(ChallengeParticipant).filter(
        ChallengeParticipant.challenge_id == challenge_id,
        ChallengeParticipant.business_id == current_user.current_business_id
    ).first()

    if not is_participant and not challenge.is_public:
        raise HTTPException(status_code=403, detail="Not authorized to view this challenge")

    return _build_challenge_response(db, challenge, current_user.current_business_id)


@app.post("/api/challenges/join", response_model=ChallengeResponse)
def join_challenge_by_code(
    request: ChallengeJoinByCodeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Join a challenge using invite code."""
    if not current_user.current_business_id:
        raise HTTPException(status_code=400, detail="No business selected")

    business = db.query(Business).filter(
        Business.id == current_user.current_business_id,
        Business.organization_id == current_user.organization_id
    ).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    if not business.gamification_enabled:
        raise HTTPException(status_code=400, detail="Gamification is disabled")

    # Find challenge by invite code
    challenge = db.query(Challenge).filter(
        Challenge.invite_code == request.invite_code.upper()
    ).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    if challenge.status != "pending":
        raise HTTPException(status_code=400, detail="This challenge is no longer accepting participants")

    if challenge.participant_count >= challenge.max_participants:
        raise HTTPException(status_code=400, detail="Challenge is full")

    # Check if already participating
    existing = db.query(ChallengeParticipant).filter(
        ChallengeParticipant.challenge_id == challenge.id,
        ChallengeParticipant.business_id == business.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already participating in this challenge")

    # Validate wager
    if request.xp_wager > business.xp:
        raise HTTPException(status_code=400, detail=f"Insufficient XP. You have {business.xp} XP")

    # Calculate handicap
    creator = db.query(ChallengeParticipant).filter(
        ChallengeParticipant.challenge_id == challenge.id,
        ChallengeParticipant.is_creator == True
    ).first()
    creator_business = db.query(Business).filter(Business.id == creator.business_id).first()

    handicap1, handicap2 = (0, 0)
    if challenge.handicap_enabled and creator_business:
        handicap1, handicap2 = _calculate_handicap(creator_business.level, business.level)
        creator.handicap_percent = handicap1

    # Add participant
    starting_count = _get_current_count_for_challenge_type(db, business.id, challenge.challenge_type)
    participant = ChallengeParticipant(
        challenge_id=challenge.id,
        business_id=business.id,
        is_creator=False,
        has_accepted=True,
        accepted_at=datetime.utcnow(),
        starting_count=starting_count,
        current_count=starting_count,
        xp_wagered=request.xp_wager,
        handicap_percent=handicap2,
    )
    db.add(participant)

    # Deduct wagered XP
    if request.xp_wager > 0:
        business.xp -= request.xp_wager

    challenge.participant_count += 1

    # If challenge is now full, start it
    if challenge.participant_count >= challenge.max_participants:
        challenge.status = "active"
        challenge.starts_at = datetime.utcnow()
        challenge.ends_at = datetime.utcnow() + DURATION_MAP.get(challenge.duration, timedelta(days=7))

    db.commit()
    db.refresh(challenge)

    return _build_challenge_response(db, challenge, business.id)


@app.post("/api/challenges/{challenge_id}/accept", response_model=ChallengeResponse)
def accept_challenge(
    challenge_id: int,
    request: ChallengeAcceptRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Accept a challenge invitation."""
    if not current_user.current_business_id:
        raise HTTPException(status_code=400, detail="No business selected")

    business = db.query(Business).filter(
        Business.id == current_user.current_business_id
    ).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    participation = db.query(ChallengeParticipant).filter(
        ChallengeParticipant.challenge_id == challenge_id,
        ChallengeParticipant.business_id == business.id
    ).first()
    if not participation:
        raise HTTPException(status_code=403, detail="Not invited to this challenge")

    if participation.has_accepted:
        raise HTTPException(status_code=400, detail="Already accepted")

    # Validate wager
    if request.xp_wager > business.xp:
        raise HTTPException(status_code=400, detail=f"Insufficient XP. You have {business.xp} XP")

    participation.has_accepted = True
    participation.accepted_at = datetime.utcnow()
    participation.xp_wagered = request.xp_wager
    participation.starting_count = _get_current_count_for_challenge_type(db, business.id, challenge.challenge_type)
    participation.current_count = participation.starting_count

    # Deduct wagered XP
    if request.xp_wager > 0:
        business.xp -= request.xp_wager

    # Check if all participants have accepted
    all_accepted = db.query(ChallengeParticipant).filter(
        ChallengeParticipant.challenge_id == challenge_id,
        ChallengeParticipant.has_accepted == False
    ).count() == 0

    if all_accepted and challenge.participant_count >= 2:
        challenge.status = "active"
        challenge.starts_at = datetime.utcnow()
        challenge.ends_at = datetime.utcnow() + DURATION_MAP.get(challenge.duration, timedelta(days=7))

    db.commit()
    db.refresh(challenge)

    return _build_challenge_response(db, challenge, business.id)


@app.post("/api/challenges/{challenge_id}/decline")
def decline_challenge(
    challenge_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Decline a challenge invitation."""
    if not current_user.current_business_id:
        raise HTTPException(status_code=400, detail="No business selected")

    participation = db.query(ChallengeParticipant).filter(
        ChallengeParticipant.challenge_id == challenge_id,
        ChallengeParticipant.business_id == current_user.current_business_id
    ).first()
    if not participation:
        raise HTTPException(status_code=404, detail="Not invited to this challenge")

    if participation.has_accepted:
        raise HTTPException(status_code=400, detail="Already accepted - cannot decline")

    participation.declined_at = datetime.utcnow()
    db.delete(participation)

    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if challenge:
        challenge.participant_count -= 1

    db.commit()

    return {"success": True, "message": "Challenge declined"}


@app.delete("/api/challenges/{challenge_id}")
def cancel_challenge(
    challenge_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel a challenge (creator only, pending challenges only)."""
    if not current_user.current_business_id:
        raise HTTPException(status_code=400, detail="No business selected")

    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    if challenge.created_by_id != current_user.current_business_id:
        raise HTTPException(status_code=403, detail="Only the creator can cancel this challenge")

    if challenge.status != "pending":
        raise HTTPException(status_code=400, detail="Can only cancel pending challenges")

    # Refund all wagered XP
    for participant in challenge.participants:
        if participant.xp_wagered > 0:
            business = db.query(Business).filter(Business.id == participant.business_id).first()
            if business:
                business.xp += participant.xp_wagered

    challenge.status = "cancelled"
    db.commit()

    return {"success": True, "message": "Challenge cancelled and XP refunded"}


@app.get("/api/challenges/{challenge_id}/progress")
def get_challenge_progress(
    challenge_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get live progress for a challenge (for real-time updates)."""
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    # Update progress for all participants
    for participant in challenge.participants:
        if participant.has_accepted:
            current = _get_current_count_for_challenge_type(db, participant.business_id, challenge.challenge_type)
            participant.current_count = current
            participant.progress = current - participant.starting_count
            participant.adjusted_progress = int(
                participant.progress * (1 + participant.handicap_percent / 100)
            )

    db.commit()

    return _build_challenge_response(db, challenge, current_user.current_business_id)


# ============ Services ============
@app.get("/api/services", response_model=List[ServiceResponse])
def get_services(category: str = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Service).filter(Service.organization_id == current_user.organization_id)
    if category:
        query = query.filter(Service.category == category)
    return query.order_by(Service.is_favorite.desc(), Service.name).all()


@app.post("/api/services", response_model=ServiceResponse)
def create_service(service: ServiceCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_service = Service(**service.model_dump(), organization_id=current_user.organization_id)
    db.add(db_service)
    db.commit()
    db.refresh(db_service)
    return db_service


@app.get("/api/services/{service_id}", response_model=ServiceResponse)
def get_service(service_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return service


@app.patch("/api/services/{service_id}", response_model=ServiceResponse)
def update_service(service_id: int, service: ServiceUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_service = db.query(Service).filter(Service.id == service_id).first()
    if not db_service:
        raise HTTPException(status_code=404, detail="Service not found")

    for key, value in service.model_dump(exclude_unset=True).items():
        setattr(db_service, key, value)

    db.commit()
    db.refresh(db_service)
    return db_service


@app.delete("/api/services/{service_id}")
def delete_service(service_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    db.delete(service)
    db.commit()
    return {"ok": True}


@app.post("/api/services/{service_id}/visit")
def record_service_visit(service_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    service.last_visited = datetime.utcnow()
    db.commit()
    return {"ok": True}


# ============ Documents ============

def check_file_exists(file_path: str) -> bool:
    """Check if a document's file exists on disk."""
    if not file_path:
        return False

    storage_name = file_path
    if storage_name.startswith('/uploads/'):
        storage_name = storage_name[9:]
    elif storage_name.startswith('uploads/'):
        storage_name = storage_name[8:]

    storage_name = os.path.basename(storage_name)
    if not storage_name:
        return False

    full_path = os.path.join(UPLOAD_DIR, storage_name)
    return os.path.isfile(full_path)


@app.get("/api/documents")
def get_documents(category: str = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Document).filter(Document.organization_id == current_user.organization_id)
    if category:
        query = query.filter(Document.category == category)
    documents = query.order_by(Document.created_at.desc()).all()

    # Add file_exists status to each document
    result = []
    for doc in documents:
        doc_dict = {
            "id": doc.id,
            "name": doc.name,
            "category": doc.category,
            "file_path": doc.file_path,
            "external_url": doc.external_url,
            "description": doc.description,
            "expiration_date": doc.expiration_date,
            "tags": doc.tags,
            "created_at": doc.created_at,
            "updated_at": doc.updated_at,
            "file_exists": check_file_exists(doc.file_path) if doc.file_path else False
        }
        result.append(doc_dict)

    return result


@app.post("/api/documents", response_model=DocumentResponse)
def create_document(document: DocumentCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_document = Document(**document.model_dump())
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    return db_document


# Allowed file extensions for upload (whitelist)
ALLOWED_EXTENSIONS = {'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg', '.gif', '.txt', '.csv', '.rtf'}
# Dangerous extensions that should never be served
DANGEROUS_EXTENSIONS = {'.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js', '.jar', '.msi', '.dll', '.scr', '.com', '.pif'}


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal and injection attacks."""
    # Remove path separators and null bytes
    filename = filename.replace('/', '').replace('\\', '').replace('\x00', '')
    # Remove any leading dots to prevent hidden files
    filename = filename.lstrip('.')
    # Only allow alphanumeric, dots, underscores, hyphens
    filename = re.sub(r'[^\w\.\-]', '_', filename)
    # Limit length
    if len(filename) > 200:
        name, ext = os.path.splitext(filename)
        filename = name[:200-len(ext)] + ext
    return filename or 'document'


def validate_file_extension(filename: str) -> bool:
    """Check if file extension is allowed."""
    ext = os.path.splitext(filename)[1].lower()
    if ext in DANGEROUS_EXTENSIONS:
        return False
    if ext not in ALLOWED_EXTENSIONS:
        return False
    return True


def detect_document_category(filename: str) -> str:
    """
    Smart detection of document category based on filename keywords.
    Returns the most likely category or 'other' if no match.
    """
    name_lower = filename.lower()

    # Formation documents - legal entity setup
    formation_keywords = [
        'articles of incorporation', 'certificate of incorporation', 'articles of organization',
        'bylaws', 'by-laws', 'by laws', 'operating agreement', 'partnership agreement',
        'stock certificate', 'share certificate', 'share ledger', 'stock ledger',
        'corporate resolution', 'board resolution', 'organizational minutes',
        'initial minutes', 'incorporator', 'registered agent', 'formation',
        'certificate of good standing', 'ein confirmation', 'ss-4', 'capital contribution',
        'membership certificate', 'llc agreement', 'shareholder agreement',
    ]

    # Tax documents
    tax_keywords = [
        'tax return', 'w-9', 'w-2', 'w-4', '1099', '1040', '1065', '1120',
        'schedule c', 'schedule k', 'quarterly tax', 'estimated tax', 'tax receipt',
        'irs', 'state tax', 'sales tax', 'payroll tax',
    ]

    # Insurance documents
    insurance_keywords = [
        'insurance', 'policy', 'certificate of insurance', 'coi', 'liability',
        'workers comp', 'general liability', 'professional liability', 'e&o',
        'd&o', 'cyber insurance', 'coverage',
    ]

    # Contracts
    contract_keywords = [
        'contract', 'agreement', 'sow', 'statement of work', 'msa',
        'master service', 'vendor agreement', 'client agreement', 'nda',
        'non-disclosure', 'confidentiality', 'employment agreement',
    ]

    # Licenses
    license_keywords = [
        'license', 'permit', 'registration', 'certificate of authority',
        'business license', 'professional license', 'dba', 'fictitious name',
    ]

    # Financial
    financial_keywords = [
        'invoice', 'receipt', 'bank statement', 'financial statement',
        'balance sheet', 'income statement', 'p&l', 'profit and loss',
        'budget', 'forecast', 'cap table', 'valuation',
    ]

    # Check each category
    for keyword in formation_keywords:
        if keyword in name_lower:
            return 'formation'

    for keyword in tax_keywords:
        if keyword in name_lower:
            return 'tax'

    for keyword in insurance_keywords:
        if keyword in name_lower:
            return 'insurance'

    for keyword in contract_keywords:
        if keyword in name_lower:
            return 'contracts'

    for keyword in license_keywords:
        if keyword in name_lower:
            return 'licenses'

    for keyword in financial_keywords:
        if keyword in name_lower:
            return 'financial'

    return 'other'


@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    business_id: int = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Secure file upload with validation.
    - Auth required
    - File extension whitelist
    - Filename sanitization
    - Unique storage name to prevent overwrites
    - Smart category detection based on filename
    """
    # Require editor or admin
    if current_user.role not in ["admin", "editor"]:
        raise HTTPException(status_code=403, detail="Editor access required")

    # Validate file extension
    if not validate_file_extension(file.filename):
        raise HTTPException(status_code=400, detail="File type not allowed")

    # Sanitize and create unique filename
    safe_name = sanitize_filename(file.filename)
    unique_id = secrets.token_hex(8)
    name_part, ext = os.path.splitext(safe_name)
    storage_name = f"{unique_id}_{name_part}{ext}"

    # Save file
    file_path = os.path.join(UPLOAD_DIR, storage_name)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Determine business_id: use provided, fall back to user's current business
    doc_business_id = business_id or current_user.current_business_id

    # Smart category detection based on filename
    detected_category = detect_document_category(file.filename)

    # Create document record (store original name for display, storage name for retrieval)
    db_document = Document(
        name=file.filename,
        file_path=storage_name,  # Now stores just the filename, not a URL path
        category=detected_category,
        organization_id=current_user.organization_id,
        business_id=doc_business_id
    )
    db.add(db_document)
    db.commit()
    db.refresh(db_document)

    # Award XP for uploading a document
    if doc_business_id:
        _award_xp(db, doc_business_id, XP_DOCUMENT_UPLOAD, current_user.organization_id)
        # Update quest and achievement progress
        _update_quest_progress(db, doc_business_id, "document_upload")
        _update_achievement_progress_internal(db, doc_business_id, "document_upload")
        db.commit()

    logger.info(f"User {current_user.email} uploaded document {db_document.id}: {safe_name}")

    return db_document


@app.get("/api/documents/{document_id}/download")
async def download_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    x_verify_password: str = Header(None)
):
    """
    Secure file download endpoint.

    Security features:
    - Authentication required
    - Forces download (Content-Disposition: attachment)
    - Path traversal protection
    - File existence validation
    - Audit logging
    - Password verification for sensitive documents
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if not document.file_path:
        raise HTTPException(status_code=404, detail="No file attached to this document")

    # Check if document is sensitive and requires password
    if document.is_sensitive:
        if not x_verify_password:
            raise HTTPException(status_code=401, detail="Password required for sensitive documents")
        if not verify_password(x_verify_password, current_user.password_hash):
            logger.warning(f"Invalid password attempt for sensitive document {document_id} by {current_user.email}")
            raise HTTPException(status_code=401, detail="Invalid password")

    # Extract just the filename (handle legacy paths that might have /uploads/ prefix)
    storage_name = document.file_path
    if storage_name.startswith('/uploads/'):
        storage_name = storage_name[9:]  # Remove /uploads/ prefix
    elif storage_name.startswith('uploads/'):
        storage_name = storage_name[8:]  # Remove uploads/ prefix

    # Get just the basename to prevent any path traversal
    storage_name = os.path.basename(storage_name)

    # Prevent path traversal - after basename, should have no path separators
    if '..' in storage_name or not storage_name:
        logger.warning(f"Path traversal attempt by {current_user.email}: {document.file_path}")
        raise HTTPException(status_code=400, detail="Invalid file path")

    # Construct full path
    full_path = os.path.join(UPLOAD_DIR, storage_name)

    # Verify file exists
    if not os.path.isfile(full_path):
        logger.warning(f"File not found for document {document_id}: {full_path}")
        raise HTTPException(status_code=404, detail="File not found on server")

    # Verify the resolved path is within UPLOAD_DIR (defense in depth)
    real_path = os.path.realpath(full_path)
    real_upload_dir = os.path.realpath(UPLOAD_DIR)
    if not real_path.startswith(real_upload_dir + os.sep) and real_path != real_upload_dir:
        logger.warning(f"Path escape attempt by {current_user.email}: {storage_name}")
        raise HTTPException(status_code=400, detail="Invalid file path")

    # Determine safe filename for download
    download_name = sanitize_filename(document.name)
    if not download_name:
        download_name = storage_name

    # Get MIME type
    mime_type, _ = mimetypes.guess_type(download_name)
    if not mime_type:
        mime_type = "application/octet-stream"

    # Log download
    logger.info(f"User {current_user.email} downloaded document {document_id}: {download_name}")

    # Return file with security headers
    response = FileResponse(
        path=full_path,
        filename=download_name,
        media_type=mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="{download_name}"',
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Pragma": "no-cache"
        }
    )

    return response


@app.post("/api/documents/{document_id}/reupload")
async def reupload_document_file(
    document_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Re-upload a file for an existing document (when original file is missing).
    """
    # Require editor or admin
    if current_user.role not in ["admin", "editor"]:
        raise HTTPException(status_code=403, detail="Editor access required")

    # Get existing document
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Validate file extension
    if not validate_file_extension(file.filename):
        raise HTTPException(status_code=400, detail="File type not allowed")

    # Delete old file if it exists
    if document.file_path:
        old_storage_name = document.file_path
        if old_storage_name.startswith('/uploads/'):
            old_storage_name = old_storage_name[9:]
        elif old_storage_name.startswith('uploads/'):
            old_storage_name = old_storage_name[8:]
        old_storage_name = os.path.basename(old_storage_name)
        if old_storage_name:
            old_path = os.path.join(UPLOAD_DIR, old_storage_name)
            if os.path.isfile(old_path):
                try:
                    os.remove(old_path)
                except Exception as e:
                    logger.warning(f"Failed to delete old file {old_path}: {e}")

    # Sanitize and create unique filename
    safe_name = sanitize_filename(file.filename)
    unique_id = secrets.token_hex(8)
    name_part, ext = os.path.splitext(safe_name)
    storage_name = f"{unique_id}_{name_part}{ext}"

    # Save new file
    file_path = os.path.join(UPLOAD_DIR, storage_name)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Update document record
    document.file_path = storage_name
    db.commit()
    db.refresh(document)

    logger.info(f"User {current_user.email} re-uploaded file for document {document_id}")

    return {
        "id": document.id,
        "name": document.name,
        "file_path": document.file_path,
        "file_exists": True
    }


@app.get("/api/documents/{document_id}", response_model=DocumentResponse)
def get_document(document_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@app.patch("/api/documents/{document_id}", response_model=DocumentResponse)
def update_document(document_id: int, document: DocumentUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_document = db.query(Document).filter(Document.id == document_id).first()
    if not db_document:
        raise HTTPException(status_code=404, detail="Document not found")

    for key, value in document.model_dump(exclude_unset=True).items():
        setattr(db_document, key, value)

    db.commit()
    db.refresh(db_document)
    return db_document


@app.delete("/api/documents/{document_id}")
def delete_document(document_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(document)
    db.commit()
    return {"ok": True}


@app.post("/api/documents/recategorize")
def recategorize_documents(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Admin-only: Re-categorize all documents using smart detection.
    Only affects documents in the current user's organization.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    documents = db.query(Document).filter(
        Document.organization_id == current_user.organization_id
    ).all()

    updated = []
    for doc in documents:
        old_category = doc.category
        new_category = detect_document_category(doc.name)
        if old_category != new_category:
            doc.category = new_category
            updated.append({
                "id": doc.id,
                "name": doc.name,
                "old_category": old_category,
                "new_category": new_category
            })

    db.commit()

    return {
        "total_documents": len(documents),
        "updated_count": len(updated),
        "updated": updated
    }


# ============ Contacts ============
@app.get("/api/contacts", response_model=List[ContactResponse])
def get_contacts(contact_type: str = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Contact).filter(Contact.organization_id == current_user.organization_id)
    if contact_type:
        query = query.filter(Contact.contact_type == contact_type)
    return query.order_by(Contact.name).all()


@app.post("/api/contacts", response_model=ContactResponse)
def create_contact(contact: ContactCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_contact = Contact(**contact.model_dump(), organization_id=current_user.organization_id)
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)

    # Award XP for creating a contact
    business_id = db_contact.business_id or current_user.current_business_id
    if business_id:
        _award_xp(db, business_id, XP_CONTACT_CREATED, current_user.organization_id)
        # Update quest and achievement progress
        _update_quest_progress(db, business_id, "contact_create")
        _update_achievement_progress_internal(db, business_id, "contact_create")
        db.commit()

    return db_contact


@app.get("/api/contacts/{contact_id}", response_model=ContactResponse)
def get_contact(contact_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


@app.patch("/api/contacts/{contact_id}", response_model=ContactResponse)
def update_contact(contact_id: int, contact: ContactUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not db_contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    for key, value in contact.model_dump(exclude_unset=True).items():
        setattr(db_contact, key, value)

    db.commit()
    db.refresh(db_contact)
    return db_contact


@app.delete("/api/contacts/{contact_id}")
def delete_contact(contact_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(contact)
    db.commit()
    return {"ok": True}


# ============ Deadlines ============
@app.get("/api/deadlines", response_model=List[DeadlineResponse])
def get_deadlines(
    deadline_type: str = None,
    include_completed: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Deadline).filter(Deadline.organization_id == current_user.organization_id)
    if deadline_type:
        query = query.filter(Deadline.deadline_type == deadline_type)
    if not include_completed:
        query = query.filter(Deadline.is_completed == False)
    return query.order_by(Deadline.due_date).all()


@app.post("/api/deadlines", response_model=DeadlineResponse)
def create_deadline(deadline: DeadlineCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_deadline = Deadline(**deadline.model_dump(), organization_id=current_user.organization_id)
    db.add(db_deadline)
    db.commit()
    db.refresh(db_deadline)
    return db_deadline


@app.get("/api/deadlines/{deadline_id}", response_model=DeadlineResponse)
def get_deadline(deadline_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    deadline = db.query(Deadline).filter(Deadline.id == deadline_id).first()
    if not deadline:
        raise HTTPException(status_code=404, detail="Deadline not found")
    return deadline


@app.patch("/api/deadlines/{deadline_id}", response_model=DeadlineResponse)
def update_deadline(deadline_id: int, deadline: DeadlineUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_deadline = db.query(Deadline).filter(Deadline.id == deadline_id).first()
    if not db_deadline:
        raise HTTPException(status_code=404, detail="Deadline not found")

    update_data = deadline.model_dump(exclude_unset=True)

    # If marking as completed, set completed_at
    if update_data.get("is_completed") and not db_deadline.is_completed:
        update_data["completed_at"] = datetime.utcnow()

    for key, value in update_data.items():
        setattr(db_deadline, key, value)

    db.commit()
    db.refresh(db_deadline)
    return db_deadline


@app.delete("/api/deadlines/{deadline_id}")
def delete_deadline(deadline_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    deadline = db.query(Deadline).filter(Deadline.id == deadline_id).first()
    if not deadline:
        raise HTTPException(status_code=404, detail="Deadline not found")
    db.delete(deadline)
    db.commit()
    return {"ok": True}


@app.post("/api/deadlines/{deadline_id}/complete")
def complete_deadline(deadline_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    deadline = db.query(Deadline).filter(Deadline.id == deadline_id).first()
    if not deadline:
        raise HTTPException(status_code=404, detail="Deadline not found")

    deadline.is_completed = True
    deadline.completed_at = datetime.utcnow()

    # If recurring, create next deadline
    if deadline.is_recurring and deadline.recurrence_months:
        next_deadline = Deadline(
            title=deadline.title,
            description=deadline.description,
            deadline_type=deadline.deadline_type,
            due_date=deadline.due_date + timedelta(days=30 * deadline.recurrence_months),
            reminder_days=deadline.reminder_days,
            is_recurring=True,
            recurrence_months=deadline.recurrence_months,
            related_service_id=deadline.related_service_id,
            related_document_id=deadline.related_document_id
        )
        db.add(next_deadline)

    db.commit()
    return {"ok": True}


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "made4founders"}


# ============ Daily Brief ============
@app.get("/api/daily-brief")
def get_daily_brief(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    The Daily Brief - everything a founder needs to know today.
    Categorized by urgency: overdue, today, this_week, heads_up
    """
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    week_end = today_start + timedelta(days=7)
    month_end = today_start + timedelta(days=30)
    ninety_days_ago = now - timedelta(days=90)

    # Get business info for personalization
    business_info = db.query(BusinessInfo).first()
    company_name = business_info.legal_name or business_info.dba_name if business_info else None

    # OVERDUE - Past due, needs immediate attention
    overdue_deadlines = db.query(Deadline).filter(
        Deadline.is_completed == False,
        Deadline.due_date < today_start
    ).order_by(Deadline.due_date).all()

    expired_documents = db.query(Document).filter(
        Document.expiration_date != None,
        Document.expiration_date < today_start
    ).order_by(Document.expiration_date).all()

    # TODAY - Due today
    today_deadlines = db.query(Deadline).filter(
        Deadline.is_completed == False,
        Deadline.due_date >= today_start,
        Deadline.due_date < today_end
    ).order_by(Deadline.due_date).all()

    # THIS WEEK - Due in next 7 days (excluding today)
    week_deadlines = db.query(Deadline).filter(
        Deadline.is_completed == False,
        Deadline.due_date >= today_end,
        Deadline.due_date < week_end
    ).order_by(Deadline.due_date).all()

    expiring_this_week = db.query(Document).filter(
        Document.expiration_date != None,
        Document.expiration_date >= today_start,
        Document.expiration_date < week_end
    ).order_by(Document.expiration_date).all()

    # HEADS UP - Coming in next 30 days (excluding this week)
    upcoming_deadlines = db.query(Deadline).filter(
        Deadline.is_completed == False,
        Deadline.due_date >= week_end,
        Deadline.due_date < month_end
    ).order_by(Deadline.due_date).all()

    expiring_soon = db.query(Document).filter(
        Document.expiration_date != None,
        Document.expiration_date >= week_end,
        Document.expiration_date < month_end
    ).order_by(Document.expiration_date).all()

    # CONTACTS NEEDING ATTENTION - Not contacted in 90+ days
    stale_contacts = db.query(Contact).filter(
        (Contact.last_contacted == None) | (Contact.last_contacted < ninety_days_ago)
    ).order_by(Contact.last_contacted.nullsfirst()).limit(5).all()

    # TASKS - Get tasks with due dates
    overdue_tasks = db.query(Task).filter(
        Task.status != "done",
        Task.due_date != None,
        Task.due_date < today_start
    ).order_by(Task.due_date).all()

    today_tasks = db.query(Task).filter(
        Task.status != "done",
        Task.due_date != None,
        Task.due_date >= today_start,
        Task.due_date < today_end
    ).order_by(Task.due_date).all()

    week_tasks = db.query(Task).filter(
        Task.status != "done",
        Task.due_date != None,
        Task.due_date >= today_end,
        Task.due_date < week_end
    ).order_by(Task.due_date).all()

    upcoming_tasks = db.query(Task).filter(
        Task.status != "done",
        Task.due_date != None,
        Task.due_date >= week_end,
        Task.due_date < month_end
    ).order_by(Task.due_date).all()

    # Format response
    def format_deadline(d):
        days_until = (d.due_date.date() - now.date()).days
        return {
            "id": d.id,
            "type": "deadline",
            "title": d.title,
            "description": d.description,
            "deadline_type": d.deadline_type,
            "due_date": d.due_date.isoformat(),
            "days_until": days_until,
            "is_recurring": d.is_recurring,
        }

    def format_document(d):
        days_until = (d.expiration_date.date() - now.date()).days if d.expiration_date else None
        return {
            "id": d.id,
            "type": "document",
            "title": f"{d.name} expires",
            "description": d.description,
            "category": d.category,
            "expiration_date": d.expiration_date.isoformat() if d.expiration_date else None,
            "days_until": days_until,
        }

    def format_contact(c):
        days_since = (now.date() - c.last_contacted.date()).days if c.last_contacted else None
        return {
            "id": c.id,
            "type": "contact",
            "name": c.name,
            "title": c.title,
            "company": c.company,
            "contact_type": c.contact_type,
            "email": c.email,
            "phone": c.phone,
            "last_contacted": c.last_contacted.isoformat() if c.last_contacted else None,
            "days_since_contact": days_since,
            "responsibilities": c.responsibilities,
        }

    def format_task(t):
        days_until = (t.due_date.date() - now.date()).days if t.due_date else None
        assigned_to_name = None
        if t.assigned_to:
            assigned_to_name = t.assigned_to.email.split('@')[0]  # Use email prefix as display name
        return {
            "id": t.id,
            "type": "task",
            "title": t.title,
            "description": t.description,
            "status": t.status,
            "priority": t.priority,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "days_until": days_until,
            "assigned_to": assigned_to_name,
        }

    # Build the brief
    overdue = [format_deadline(d) for d in overdue_deadlines] + [format_document(d) for d in expired_documents] + [format_task(t) for t in overdue_tasks]
    today = [format_deadline(d) for d in today_deadlines] + [format_task(t) for t in today_tasks]
    this_week = [format_deadline(d) for d in week_deadlines] + [format_document(d) for d in expiring_this_week] + [format_task(t) for t in week_tasks]
    heads_up = [format_deadline(d) for d in upcoming_deadlines] + [format_document(d) for d in expiring_soon] + [format_task(t) for t in upcoming_tasks]
    contacts_attention = [format_contact(c) for c in stale_contacts]

    return {
        "generated_at": now.isoformat(),
        "company_name": company_name,
        "summary": {
            "overdue_count": len(overdue),
            "today_count": len(today),
            "this_week_count": len(this_week),
            "heads_up_count": len(heads_up),
            "contacts_needing_attention": len(contacts_attention),
        },
        "overdue": sorted(overdue, key=lambda x: x.get("due_date") or x.get("expiration_date") or ""),
        "today": today,
        "this_week": sorted(this_week, key=lambda x: x.get("due_date") or x.get("expiration_date") or ""),
        "heads_up": sorted(heads_up, key=lambda x: x.get("due_date") or x.get("expiration_date") or ""),
        "contacts_attention": contacts_attention,
    }


# ============ Business Info ============
@app.get("/api/business-info", response_model=BusinessInfoResponse)
def get_business_info(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    info = db.query(BusinessInfo).first()
    if not info:
        # Create default record if none exists
        info = BusinessInfo()
        db.add(info)
        db.commit()
        db.refresh(info)
    return info


@app.put("/api/business-info", response_model=BusinessInfoResponse)
def update_business_info(info: BusinessInfoUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_info = db.query(BusinessInfo).first()
    if not db_info:
        db_info = BusinessInfo()
        db.add(db_info)

    for key, value in info.model_dump(exclude_unset=True).items():
        setattr(db_info, key, value)

    db.commit()
    db.refresh(db_info)
    return db_info


# ============ Business Identifiers (ENCRYPTED) ============

# Get application encryption key for identifiers
_app_encryption_key = None

def get_identifier_encryption_key() -> bytes:
    """Get or cache the application encryption key."""
    global _app_encryption_key
    if _app_encryption_key is None:
        _app_encryption_key = get_app_encryption_key()
    return _app_encryption_key


def decrypt_identifier_value(encrypted_value: str) -> str:
    """Decrypt a stored identifier value."""
    if not encrypted_value:
        return ""
    try:
        key = get_identifier_encryption_key()
        return decrypt_identifier(encrypted_value, key)
    except Exception:
        # If decryption fails, assume it's a legacy unencrypted value
        return encrypted_value


def encrypt_identifier_value(value: str) -> str:
    """Encrypt an identifier value for storage."""
    if not value:
        return ""
    key = get_identifier_encryption_key()
    return encrypt_identifier(value, key)


def mask_identifier(value: str, identifier_type: str) -> str:
    """Mask sensitive identifier values, showing only last few characters"""
    if not value:
        return ""
    # Decrypt if needed
    decrypted = decrypt_identifier_value(value)
    if not decrypted:
        return ""

    if identifier_type == "ein":
        # EIN format: XX-XXXXXXX, show last 4: XX-XXX1234
        if len(decrypted) >= 4:
            return "XX-XXX" + decrypted[-4:]
        return "X" * len(decrypted)
    elif identifier_type == "duns":
        # D-U-N-S format: XX-XXX-XXXX, show last 4
        if len(decrypted) >= 4:
            return "XX-XXX-" + decrypted[-4:]
        return "X" * len(decrypted)
    else:
        # Generic masking - show last 4 if long enough
        if len(decrypted) > 4:
            return "X" * (len(decrypted) - 4) + decrypted[-4:]
        return "X" * len(decrypted)


@app.get("/api/business-identifiers", response_model=List[BusinessIdentifierMasked])
def get_business_identifiers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all identifiers with masked values (requires auth)."""
    identifiers = db.query(BusinessIdentifier).filter(
        BusinessIdentifier.organization_id == current_user.organization_id
    ).order_by(BusinessIdentifier.identifier_type).all()
    masked_list = []
    for ident in identifiers:
        masked_list.append(BusinessIdentifierMasked(
            id=ident.id,
            identifier_type=ident.identifier_type,
            label=ident.label,
            masked_value=mask_identifier(ident.value, ident.identifier_type),
            issuing_authority=ident.issuing_authority,
            issue_date=ident.issue_date,
            expiration_date=ident.expiration_date,
            notes=ident.notes,
            related_document_id=ident.related_document_id,
            created_at=ident.created_at,
            updated_at=ident.updated_at
        ))
    return masked_list


@app.get("/api/business-identifiers/{identifier_id}", response_model=BusinessIdentifierResponse)
def get_business_identifier(
    identifier_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get full (decrypted) identifier - requires authentication."""
    ident = db.query(BusinessIdentifier).filter(BusinessIdentifier.id == identifier_id).first()
    if not ident:
        raise HTTPException(status_code=404, detail="Identifier not found")

    # Decrypt the value for response
    decrypted_value = decrypt_identifier_value(ident.value)

    # Log access to sensitive data
    logger.info(f"User {current_user.email} accessed identifier {identifier_id}")

    return BusinessIdentifierResponse(
        id=ident.id,
        identifier_type=ident.identifier_type,
        label=ident.label,
        value=decrypted_value,
        issuing_authority=ident.issuing_authority,
        issue_date=ident.issue_date,
        expiration_date=ident.expiration_date,
        notes=ident.notes,
        related_document_id=ident.related_document_id,
        created_at=ident.created_at,
        updated_at=ident.updated_at
    )


@app.get("/api/business-identifiers/{identifier_id}/value")
def get_business_identifier_value(
    identifier_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get just the decrypted value for copying (requires auth)."""
    ident = db.query(BusinessIdentifier).filter(BusinessIdentifier.id == identifier_id).first()
    if not ident:
        raise HTTPException(status_code=404, detail="Identifier not found")

    decrypted_value = decrypt_identifier_value(ident.value)
    logger.info(f"User {current_user.email} copied identifier {identifier_id}")

    return {"value": decrypted_value}


@app.post("/api/business-identifiers", response_model=BusinessIdentifierResponse)
def create_business_identifier(
    identifier: BusinessIdentifierCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new identifier (value will be encrypted)."""
    # Require editor or admin
    if current_user.role not in ["admin", "editor"]:
        raise HTTPException(status_code=403, detail="Editor access required")

    # Encrypt the value before storing
    identifier_data = identifier.model_dump()
    identifier_data["value"] = encrypt_identifier_value(identifier_data["value"])

    db_ident = BusinessIdentifier(**identifier_data)
    db.add(db_ident)
    db.commit()
    db.refresh(db_ident)

    logger.info(f"User {current_user.email} created identifier {db_ident.id}")

    # Return with decrypted value
    return BusinessIdentifierResponse(
        id=db_ident.id,
        identifier_type=db_ident.identifier_type,
        label=db_ident.label,
        value=decrypt_identifier_value(db_ident.value),
        issuing_authority=db_ident.issuing_authority,
        issue_date=db_ident.issue_date,
        expiration_date=db_ident.expiration_date,
        notes=db_ident.notes,
        related_document_id=db_ident.related_document_id,
        created_at=db_ident.created_at,
        updated_at=db_ident.updated_at
    )


@app.patch("/api/business-identifiers/{identifier_id}", response_model=BusinessIdentifierResponse)
def update_business_identifier(
    identifier_id: int,
    identifier: BusinessIdentifierUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an identifier (value will be encrypted if changed)."""
    # Require editor or admin
    if current_user.role not in ["admin", "editor"]:
        raise HTTPException(status_code=403, detail="Editor access required")

    db_ident = db.query(BusinessIdentifier).filter(BusinessIdentifier.id == identifier_id).first()
    if not db_ident:
        raise HTTPException(status_code=404, detail="Identifier not found")

    update_data = identifier.model_dump(exclude_unset=True)

    # Encrypt the value if it's being updated
    if "value" in update_data and update_data["value"]:
        update_data["value"] = encrypt_identifier_value(update_data["value"])

    for key, value in update_data.items():
        setattr(db_ident, key, value)

    db.commit()
    db.refresh(db_ident)

    logger.info(f"User {current_user.email} updated identifier {identifier_id}")

    # Return with decrypted value
    return BusinessIdentifierResponse(
        id=db_ident.id,
        identifier_type=db_ident.identifier_type,
        label=db_ident.label,
        value=decrypt_identifier_value(db_ident.value),
        issuing_authority=db_ident.issuing_authority,
        issue_date=db_ident.issue_date,
        expiration_date=db_ident.expiration_date,
        notes=db_ident.notes,
        related_document_id=db_ident.related_document_id,
        created_at=db_ident.created_at,
        updated_at=db_ident.updated_at
    )


@app.delete("/api/business-identifiers/{identifier_id}")
def delete_business_identifier(
    identifier_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an identifier (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    ident = db.query(BusinessIdentifier).filter(BusinessIdentifier.id == identifier_id).first()
    if not ident:
        raise HTTPException(status_code=404, detail="Identifier not found")

    db.delete(ident)
    db.commit()

    logger.info(f"User {current_user.email} deleted identifier {identifier_id}")

    return {"ok": True}


# ============ Checklist Progress ============
@app.get("/api/checklist", response_model=List[ChecklistProgressResponse])
def get_checklist_progress(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(ChecklistProgress).filter(ChecklistProgress.organization_id == current_user.organization_id).all()


@app.get("/api/checklist/bulk")
def get_checklist_progress_bulk(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all checklist items as a dict keyed by item_id"""
    items = db.query(ChecklistProgress).filter(ChecklistProgress.organization_id == current_user.organization_id).all()
    return {"items": {item.item_id: ChecklistProgressResponse.model_validate(item).model_dump() for item in items}}


@app.get("/api/checklist/{item_id}", response_model=ChecklistProgressResponse)
def get_checklist_item(item_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(ChecklistProgress).filter(ChecklistProgress.item_id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    return item


@app.post("/api/checklist", response_model=ChecklistProgressResponse)
def create_or_update_checklist_item(progress: ChecklistProgressCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Check if item already exists
    existing = db.query(ChecklistProgress).filter(ChecklistProgress.item_id == progress.item_id).first()

    if existing:
        # Update existing
        was_completed = existing.is_completed
        for key, value in progress.model_dump(exclude_unset=True).items():
            setattr(existing, key, value)
        if progress.is_completed and not existing.completed_at:
            existing.completed_at = datetime.utcnow()
            # Award XP for newly completing checklist item
            if not was_completed and existing.business_id:
                _award_xp(db, existing.business_id, XP_CHECKLIST_COMPLETE, current_user.organization_id)
                # Update quest and achievement progress
                _update_quest_progress(db, existing.business_id, "checklist_complete")
                _update_achievement_progress_internal(db, existing.business_id, "checklist_complete")
        elif not progress.is_completed:
            existing.completed_at = None
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # Create new
        db_item = ChecklistProgress(**progress.model_dump())
        if progress.is_completed:
            db_item.completed_at = datetime.utcnow()
        db.add(db_item)
        db.commit()
        db.refresh(db_item)
        # Award XP for completing checklist item on creation
        if progress.is_completed and db_item.business_id:
            _award_xp(db, db_item.business_id, XP_CHECKLIST_COMPLETE, current_user.organization_id)
            # Update quest and achievement progress
            _update_quest_progress(db, db_item.business_id, "checklist_complete")
            _update_achievement_progress_internal(db, db_item.business_id, "checklist_complete")
            db.commit()
        return db_item


@app.patch("/api/checklist/{item_id}", response_model=ChecklistProgressResponse)
def update_checklist_item(item_id: str, progress: ChecklistProgressUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_item = db.query(ChecklistProgress).filter(ChecklistProgress.item_id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Checklist item not found")

    update_data = progress.model_dump(exclude_unset=True)
    was_completed = db_item.is_completed

    if update_data.get("is_completed") and not db_item.is_completed:
        update_data["completed_at"] = datetime.utcnow()
    elif update_data.get("is_completed") is False:
        update_data["completed_at"] = None

    for key, value in update_data.items():
        setattr(db_item, key, value)

    # Award XP for newly completing checklist item
    if update_data.get("is_completed") and not was_completed and db_item.business_id:
        _award_xp(db, db_item.business_id, XP_CHECKLIST_COMPLETE, current_user.organization_id)
        # Update quest and achievement progress
        _update_quest_progress(db, db_item.business_id, "checklist_complete")
        _update_achievement_progress_internal(db, db_item.business_id, "checklist_complete")

    db.commit()
    db.refresh(db_item)
    return db_item


@app.delete("/api/checklist/{item_id}")
def delete_checklist_item(item_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(ChecklistProgress).filter(ChecklistProgress.item_id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


# ============ Credential Vault ============
# Simple session ID for demo - in production, derive from JWT token
def get_session_id():
    """Get session ID for vault operations. Using a fixed ID for single-user mode."""
    return "default-session"


@app.get("/api/vault/status", response_model=VaultStatus)
def get_vault_status(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Check if vault is set up and unlocked."""
    config = db.query(VaultConfig).first()
    session_id = get_session_id()
    return VaultStatus(
        is_setup=config is not None,
        is_unlocked=VaultSession.is_unlocked(session_id)
    )


@app.post("/api/vault/setup", response_model=VaultStatus)
def setup_vault(setup: VaultSetup, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Set up the vault with a master password."""
    existing = db.query(VaultConfig).first()
    if existing:
        raise HTTPException(status_code=400, detail="Vault already set up")

    if len(setup.master_password) < 8:
        raise HTTPException(status_code=400, detail="Master password must be at least 8 characters")

    # Create vault config
    salt = generate_salt()
    password_hash = hash_master_password(setup.master_password)

    config = VaultConfig(
        master_password_hash=password_hash,
        salt=salt
    )
    db.add(config)
    db.commit()

    # Auto-unlock after setup
    session_id = get_session_id()
    key = derive_key(setup.master_password, salt)
    VaultSession.unlock(session_id, key)

    return VaultStatus(is_setup=True, is_unlocked=True)


@app.post("/api/vault/unlock", response_model=VaultStatus)
def unlock_vault(unlock: VaultUnlock, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Unlock the vault with the master password."""
    config = db.query(VaultConfig).first()
    if not config:
        raise HTTPException(status_code=400, detail="Vault not set up")

    if not verify_master_password(unlock.master_password, config.master_password_hash):
        raise HTTPException(status_code=401, detail="Invalid master password")

    session_id = get_session_id()
    key = derive_key(unlock.master_password, config.salt)
    VaultSession.unlock(session_id, key)

    return VaultStatus(is_setup=True, is_unlocked=True)


@app.post("/api/vault/lock", response_model=VaultStatus)
def lock_vault(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Lock the vault."""
    session_id = get_session_id()
    VaultSession.lock(session_id)
    config = db.query(VaultConfig).first()
    return VaultStatus(is_setup=config is not None, is_unlocked=False)


@app.delete("/api/vault/reset")
def reset_vault(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Reset the vault - deletes all credentials and master password. USE WITH CAUTION."""
    # Lock first
    session_id = get_session_id()
    VaultSession.lock(session_id)

    # Delete all credentials
    db.query(Credential).delete()

    # Delete vault config
    db.query(VaultConfig).delete()

    db.commit()
    return {"ok": True, "message": "Vault has been reset"}


# ============ Credentials ============
def require_vault_unlocked():
    """Dependency to ensure vault is unlocked."""
    session_id = get_session_id()
    if not VaultSession.is_unlocked(session_id):
        raise HTTPException(status_code=403, detail="Vault is locked")
    return VaultSession.get_key(session_id)


@app.get("/api/credentials", response_model=List[CredentialMasked])
def get_credentials(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all credentials (masked - doesn't require unlock)."""
    credentials = db.query(Credential).filter(
        Credential.organization_id == current_user.organization_id
    ).order_by(Credential.name).all()
    result = []
    for c in credentials:
        # Count custom fields if present
        custom_field_count = 0
        if c.encrypted_custom_fields:
            # We can't decrypt here, but we can store the count unencrypted for display
            # For now, we'll just indicate presence (count requires decrypt)
            custom_field_count = 0  # Will be counted when unlocked
        result.append(CredentialMasked(
            id=c.id,
            name=c.name,
            service_url=c.service_url,
            category=c.category,
            icon=c.icon,
            related_service_id=c.related_service_id,
            has_username=bool(c.encrypted_username),
            has_password=bool(c.encrypted_password),
            has_notes=bool(c.encrypted_notes),
            has_totp=bool(c.encrypted_totp_secret),
            has_purpose=bool(c.encrypted_purpose),
            has_custom_fields=bool(c.encrypted_custom_fields),
            custom_field_count=custom_field_count,
            created_at=c.created_at,
            updated_at=c.updated_at
        ))
    return result


@app.get("/api/credentials/{credential_id}", response_model=CredentialDecrypted)
def get_credential(credential_id: int, key: bytes = Depends(require_vault_unlocked), db: Session = Depends(get_db)):
    """Get a single credential with decrypted values (requires unlock)."""
    credential = db.query(Credential).filter(Credential.id == credential_id).first()
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")

    # Decrypt custom fields if present
    custom_fields = None
    if credential.encrypted_custom_fields:
        try:
            decrypted_json = decrypt_value(credential.encrypted_custom_fields, key)
            custom_fields_data = json.loads(decrypted_json)
            custom_fields = [CustomField(**cf) for cf in custom_fields_data]
        except Exception:
            custom_fields = None

    return CredentialDecrypted(
        id=credential.id,
        name=credential.name,
        service_url=credential.service_url,
        category=credential.category,
        icon=credential.icon,
        related_service_id=credential.related_service_id,
        username=decrypt_value(credential.encrypted_username, key) if credential.encrypted_username else None,
        password=decrypt_value(credential.encrypted_password, key) if credential.encrypted_password else None,
        notes=decrypt_value(credential.encrypted_notes, key) if credential.encrypted_notes else None,
        totp_secret=decrypt_value(credential.encrypted_totp_secret, key) if credential.encrypted_totp_secret else None,
        purpose=decrypt_value(credential.encrypted_purpose, key) if credential.encrypted_purpose else None,
        custom_fields=custom_fields,
        created_at=credential.created_at,
        updated_at=credential.updated_at
    )


@app.post("/api/credentials", response_model=CredentialMasked)
def create_credential(credential: CredentialCreate, current_user: User = Depends(get_current_user), key: bytes = Depends(require_vault_unlocked), db: Session = Depends(get_db)):
    """Create a new credential (requires unlock)."""
    # Encrypt custom fields if present
    encrypted_custom_fields = None
    if credential.custom_fields:
        custom_fields_json = json.dumps([cf.model_dump() for cf in credential.custom_fields])
        encrypted_custom_fields = encrypt_value(custom_fields_json, key)

    db_credential = Credential(
        organization_id=current_user.organization_id,
        name=credential.name,
        service_url=credential.service_url,
        category=credential.category,
        icon=credential.icon,
        related_service_id=credential.related_service_id,
        encrypted_username=encrypt_value(credential.username, key) if credential.username else None,
        encrypted_password=encrypt_value(credential.password, key) if credential.password else None,
        encrypted_notes=encrypt_value(credential.notes, key) if credential.notes else None,
        encrypted_totp_secret=encrypt_value(credential.totp_secret, key) if credential.totp_secret else None,
        encrypted_purpose=encrypt_value(credential.purpose, key) if credential.purpose else None,
        encrypted_custom_fields=encrypted_custom_fields
    )
    db.add(db_credential)
    db.commit()
    db.refresh(db_credential)

    return CredentialMasked(
        id=db_credential.id,
        name=db_credential.name,
        service_url=db_credential.service_url,
        category=db_credential.category,
        icon=db_credential.icon,
        related_service_id=db_credential.related_service_id,
        has_username=bool(db_credential.encrypted_username),
        has_password=bool(db_credential.encrypted_password),
        has_notes=bool(db_credential.encrypted_notes),
        has_totp=bool(db_credential.encrypted_totp_secret),
        has_purpose=bool(db_credential.encrypted_purpose),
        has_custom_fields=bool(db_credential.encrypted_custom_fields),
        custom_field_count=len(credential.custom_fields) if credential.custom_fields else 0,
        created_at=db_credential.created_at,
        updated_at=db_credential.updated_at
    )


@app.patch("/api/credentials/{credential_id}", response_model=CredentialMasked)
def update_credential(credential_id: int, credential: CredentialUpdate, key: bytes = Depends(require_vault_unlocked), db: Session = Depends(get_db)):
    """Update a credential (requires unlock)."""
    db_credential = db.query(Credential).filter(Credential.id == credential_id).first()
    if not db_credential:
        raise HTTPException(status_code=404, detail="Credential not found")

    update_data = credential.model_dump(exclude_unset=True)

    # Handle non-encrypted fields
    for field in ['name', 'service_url', 'category', 'icon', 'related_service_id']:
        if field in update_data:
            setattr(db_credential, field, update_data[field])

    # Handle encrypted fields
    if 'username' in update_data:
        db_credential.encrypted_username = encrypt_value(update_data['username'], key) if update_data['username'] else None
    if 'password' in update_data:
        db_credential.encrypted_password = encrypt_value(update_data['password'], key) if update_data['password'] else None
    if 'notes' in update_data:
        db_credential.encrypted_notes = encrypt_value(update_data['notes'], key) if update_data['notes'] else None
    if 'totp_secret' in update_data:
        db_credential.encrypted_totp_secret = encrypt_value(update_data['totp_secret'], key) if update_data['totp_secret'] else None
    if 'purpose' in update_data:
        db_credential.encrypted_purpose = encrypt_value(update_data['purpose'], key) if update_data['purpose'] else None
    if 'custom_fields' in update_data:
        if update_data['custom_fields']:
            # custom_fields are already dicts after model_dump()
            custom_fields_json = json.dumps(update_data['custom_fields'])
            db_credential.encrypted_custom_fields = encrypt_value(custom_fields_json, key)
        else:
            db_credential.encrypted_custom_fields = None

    db.commit()
    db.refresh(db_credential)

    # Count custom fields for response
    custom_field_count = 0
    if credential.custom_fields is not None:
        custom_field_count = len(credential.custom_fields)

    return CredentialMasked(
        id=db_credential.id,
        name=db_credential.name,
        service_url=db_credential.service_url,
        category=db_credential.category,
        icon=db_credential.icon,
        related_service_id=db_credential.related_service_id,
        has_username=bool(db_credential.encrypted_username),
        has_password=bool(db_credential.encrypted_password),
        has_notes=bool(db_credential.encrypted_notes),
        has_totp=bool(db_credential.encrypted_totp_secret),
        has_purpose=bool(db_credential.encrypted_purpose),
        has_custom_fields=bool(db_credential.encrypted_custom_fields),
        custom_field_count=custom_field_count,
        created_at=db_credential.created_at,
        updated_at=db_credential.updated_at
    )


@app.delete("/api/credentials/{credential_id}")
def delete_credential(credential_id: int, key: bytes = Depends(require_vault_unlocked), db: Session = Depends(get_db)):
    """Delete a credential (requires unlock)."""
    credential = db.query(Credential).filter(Credential.id == credential_id).first()
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")
    db.delete(credential)
    db.commit()
    return {"ok": True}


@app.get("/api/credentials/{credential_id}/copy/{field}")
def copy_credential_field(credential_id: int, field: str, index: int = None, key: bytes = Depends(require_vault_unlocked), db: Session = Depends(get_db)):
    """Get a single decrypted field for copying (requires unlock).

    For custom fields, use field='custom' and provide index query param.
    """
    valid_fields = ['username', 'password', 'notes', 'totp_secret', 'purpose', 'custom']
    if field not in valid_fields:
        raise HTTPException(status_code=400, detail="Invalid field")

    credential = db.query(Credential).filter(Credential.id == credential_id).first()
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")

    # Handle custom field
    if field == 'custom':
        if index is None:
            raise HTTPException(status_code=400, detail="Index required for custom fields")
        if not credential.encrypted_custom_fields:
            return {"value": None}
        try:
            decrypted_json = decrypt_value(credential.encrypted_custom_fields, key)
            custom_fields = json.loads(decrypted_json)
            if index < 0 or index >= len(custom_fields):
                raise HTTPException(status_code=400, detail="Invalid custom field index")
            return {"value": custom_fields[index].get('value')}
        except (json.JSONDecodeError, IndexError):
            return {"value": None}

    encrypted_field = f"encrypted_{field}"
    encrypted_value = getattr(credential, encrypted_field)

    if not encrypted_value:
        return {"value": None}

    return {"value": decrypt_value(encrypted_value, key)}


# ============ Products Offered ============
@app.get("/api/products-offered", response_model=List[ProductOfferedResponse])
def get_products_offered(category: str = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(ProductOffered).filter(ProductOffered.organization_id == current_user.organization_id)
    if category:
        query = query.filter(ProductOffered.category == category)
    return query.order_by(ProductOffered.name).all()


@app.post("/api/products-offered", response_model=ProductOfferedResponse)
def create_product_offered(product: ProductOfferedCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_product = ProductOffered(**product.model_dump(), organization_id=current_user.organization_id)
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


@app.get("/api/products-offered/{product_id}", response_model=ProductOfferedResponse)
def get_product_offered(product_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    product = db.query(ProductOffered).filter(ProductOffered.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@app.patch("/api/products-offered/{product_id}", response_model=ProductOfferedResponse)
def update_product_offered(product_id: int, product: ProductOfferedUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_product = db.query(ProductOffered).filter(ProductOffered.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    for key, value in product.model_dump(exclude_unset=True).items():
        setattr(db_product, key, value)

    db.commit()
    db.refresh(db_product)
    return db_product


@app.delete("/api/products-offered/{product_id}")
def delete_product_offered(product_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    product = db.query(ProductOffered).filter(ProductOffered.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
    return {"ok": True}


# ============ Marketplaces ============
@app.get("/api/marketplaces", response_model=List[MarketplaceResponse])
def get_marketplaces(category: str = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Marketplace).filter(Marketplace.organization_id == current_user.organization_id)
    if category:
        query = query.filter(Marketplace.category == category)
    return query.order_by(Marketplace.name).all()


@app.post("/api/marketplaces", response_model=MarketplaceResponse)
def create_marketplace(marketplace: MarketplaceCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_marketplace = Marketplace(**marketplace.model_dump(), organization_id=current_user.organization_id)
    db.add(db_marketplace)
    db.commit()
    db.refresh(db_marketplace)
    return db_marketplace


@app.get("/api/marketplaces/{marketplace_id}", response_model=MarketplaceResponse)
def get_marketplace(marketplace_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    marketplace = db.query(Marketplace).filter(Marketplace.id == marketplace_id).first()
    if not marketplace:
        raise HTTPException(status_code=404, detail="Marketplace not found")
    return marketplace


@app.patch("/api/marketplaces/{marketplace_id}", response_model=MarketplaceResponse)
def update_marketplace(marketplace_id: int, marketplace: MarketplaceUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_marketplace = db.query(Marketplace).filter(Marketplace.id == marketplace_id).first()
    if not db_marketplace:
        raise HTTPException(status_code=404, detail="Marketplace not found")

    for key, value in marketplace.model_dump(exclude_unset=True).items():
        setattr(db_marketplace, key, value)

    db.commit()
    db.refresh(db_marketplace)
    return db_marketplace


@app.delete("/api/marketplaces/{marketplace_id}")
def delete_marketplace(marketplace_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    marketplace = db.query(Marketplace).filter(Marketplace.id == marketplace_id).first()
    if not marketplace:
        raise HTTPException(status_code=404, detail="Marketplace not found")
    db.delete(marketplace)
    db.commit()
    return {"ok": True}


# ============ Products Used ============
@app.get("/api/products-used", response_model=List[ProductUsedResponse])
def get_products_used(category: str = None, is_paid: bool = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(ProductUsed).filter(ProductUsed.organization_id == current_user.organization_id)
    if category:
        query = query.filter(ProductUsed.category == category)
    if is_paid is not None:
        query = query.filter(ProductUsed.is_paid == is_paid)
    return query.order_by(ProductUsed.name).all()


@app.post("/api/products-used", response_model=ProductUsedResponse)
def create_product_used(product: ProductUsedCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_product = ProductUsed(**product.model_dump(), organization_id=current_user.organization_id)
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


@app.get("/api/products-used/{product_id}", response_model=ProductUsedResponse)
def get_product_used(product_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    product = db.query(ProductUsed).filter(ProductUsed.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@app.patch("/api/products-used/{product_id}", response_model=ProductUsedResponse)
def update_product_used(product_id: int, product: ProductUsedUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_product = db.query(ProductUsed).filter(ProductUsed.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    for key, value in product.model_dump(exclude_unset=True).items():
        setattr(db_product, key, value)

    db.commit()
    db.refresh(db_product)
    return db_product


@app.delete("/api/products-used/{product_id}")
def delete_product_used(product_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    product = db.query(ProductUsed).filter(ProductUsed.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
    return {"ok": True}


# ============ Web Links ============
@app.get("/api/web-links", response_model=List[WebLinkResponse])
def get_web_links(category: str = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(WebLink).filter(WebLink.organization_id == current_user.organization_id)
    if category:
        query = query.filter(WebLink.category == category)
    return query.order_by(WebLink.is_favorite.desc(), WebLink.title).all()


@app.post("/api/web-links", response_model=WebLinkResponse)
def create_web_link(link: WebLinkCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_link = WebLink(**link.model_dump(), organization_id=current_user.organization_id)
    db.add(db_link)
    db.commit()
    db.refresh(db_link)
    return db_link


@app.get("/api/web-links/{link_id}", response_model=WebLinkResponse)
def get_web_link(link_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    link = db.query(WebLink).filter(WebLink.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Web link not found")
    return link


@app.patch("/api/web-links/{link_id}", response_model=WebLinkResponse)
def update_web_link(link_id: int, link: WebLinkUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_link = db.query(WebLink).filter(WebLink.id == link_id).first()
    if not db_link:
        raise HTTPException(status_code=404, detail="Web link not found")

    for key, value in link.model_dump(exclude_unset=True).items():
        setattr(db_link, key, value)

    db.commit()
    db.refresh(db_link)
    return db_link


@app.delete("/api/web-links/{link_id}")
def delete_web_link(link_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    link = db.query(WebLink).filter(WebLink.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Web link not found")
    db.delete(link)
    db.commit()
    return {"ok": True}


@app.post("/api/web-links/{link_id}/visit")
def record_web_link_visit(link_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    link = db.query(WebLink).filter(WebLink.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Web link not found")
    link.last_visited = datetime.utcnow()
    db.commit()
    return {"ok": True}


# ============ Task Management - Auth Helpers ============

def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Require admin role for certain operations."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def get_editor_or_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require editor or admin role."""
    if current_user.role not in ["admin", "editor"]:
        raise HTTPException(status_code=403, detail="Editor access required")
    return current_user


# ============ Task Boards ============

@app.get("/api/boards", response_model=List[TaskBoardResponse])
def get_boards(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all boards for user's organization."""
    boards = db.query(TaskBoard).filter(
        TaskBoard.organization_id == current_user.organization_id
    ).order_by(TaskBoard.is_default.desc(), TaskBoard.name).all()

    # If no boards exist, create a default one for this organization
    if not boards:
        default_board = TaskBoard(
            name="Main Board",
            description="Default task board",
            is_default=True,
            created_by_id=current_user.id,
            organization_id=current_user.organization_id
        )
        db.add(default_board)
        db.commit()
        db.refresh(default_board)

        # Create default columns
        default_columns = [
            ("Backlog", "backlog", 0, "#6b7280"),
            ("To Do", "todo", 1, "#3b82f6"),
            ("In Progress", "in_progress", 2, "#f59e0b"),
            ("Done", "done", 3, "#10b981"),
        ]
        for name, status, pos, color in default_columns:
            col = TaskColumn(board_id=default_board.id, name=name, status=status, position=pos, color=color)
            db.add(col)
        db.commit()
        db.refresh(default_board)
        boards = [default_board]

    return boards


@app.post("/api/boards", response_model=TaskBoardResponse)
def create_board(
    board: TaskBoardCreate,
    current_user: User = Depends(get_editor_or_admin),
    db: Session = Depends(get_db)
):
    """Create a new board (editor/admin only)."""
    db_board = TaskBoard(**board.model_dump(), created_by_id=current_user.id, organization_id=current_user.organization_id)
    db.add(db_board)
    db.commit()
    db.refresh(db_board)

    # Create default columns
    default_columns = [
        ("Backlog", "backlog", 0, "#6b7280"),
        ("To Do", "todo", 1, "#3b82f6"),
        ("In Progress", "in_progress", 2, "#f59e0b"),
        ("Done", "done", 3, "#10b981"),
    ]
    for name, status, pos, color in default_columns:
        col = TaskColumn(board_id=db_board.id, name=name, status=status, position=pos, color=color)
        db.add(col)
    db.commit()
    db.refresh(db_board)
    return db_board


@app.get("/api/boards/{board_id}", response_model=TaskBoardResponse)
def get_board(board_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    board = db.query(TaskBoard).filter(TaskBoard.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


@app.patch("/api/boards/{board_id}", response_model=TaskBoardResponse)
def update_board(
    board_id: int,
    board: TaskBoardUpdate,
    current_user: User = Depends(get_editor_or_admin),
    db: Session = Depends(get_db)
):
    db_board = db.query(TaskBoard).filter(TaskBoard.id == board_id).first()
    if not db_board:
        raise HTTPException(status_code=404, detail="Board not found")
    for key, value in board.model_dump(exclude_unset=True).items():
        setattr(db_board, key, value)
    db.commit()
    db.refresh(db_board)
    return db_board


@app.delete("/api/boards/{board_id}")
def delete_board(
    board_id: int,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Delete board (admin only)."""
    board = db.query(TaskBoard).filter(TaskBoard.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    db.delete(board)
    db.commit()
    return {"ok": True}


# ============ Task Columns ============

@app.post("/api/columns", response_model=TaskColumnResponse)
def create_column(
    column: TaskColumnCreate,
    current_user: User = Depends(get_editor_or_admin),
    db: Session = Depends(get_db)
):
    # Get max position for this board
    max_pos = db.query(TaskColumn).filter(TaskColumn.board_id == column.board_id).count()
    db_column = TaskColumn(**column.model_dump())
    if column.position is None:
        db_column.position = max_pos
    db.add(db_column)
    db.commit()
    db.refresh(db_column)
    return db_column


@app.patch("/api/columns/{column_id}", response_model=TaskColumnResponse)
def update_column(
    column_id: int,
    column: TaskColumnUpdate,
    current_user: User = Depends(get_editor_or_admin),
    db: Session = Depends(get_db)
):
    db_column = db.query(TaskColumn).filter(TaskColumn.id == column_id).first()
    if not db_column:
        raise HTTPException(status_code=404, detail="Column not found")
    for key, value in column.model_dump(exclude_unset=True).items():
        setattr(db_column, key, value)
    db.commit()
    db.refresh(db_column)
    return db_column


@app.delete("/api/columns/{column_id}")
def delete_column(
    column_id: int,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    column = db.query(TaskColumn).filter(TaskColumn.id == column_id).first()
    if not column:
        raise HTTPException(status_code=404, detail="Column not found")
    # Move tasks to null column
    db.query(Task).filter(Task.column_id == column_id).update({Task.column_id: None})
    db.delete(column)
    db.commit()
    return {"ok": True}


@app.post("/api/columns/reorder")
def reorder_columns(
    reorder: List[ColumnReorder],
    current_user: User = Depends(get_editor_or_admin),
    db: Session = Depends(get_db)
):
    """Reorder columns within a board."""
    for item in reorder:
        db.query(TaskColumn).filter(TaskColumn.id == item.id).update({"position": item.position})
    db.commit()
    return {"ok": True}


# ============ Tasks ============

@app.get("/api/tasks", response_model=List[TaskResponse])
def get_tasks(
    board_id: int = None,
    column_id: int = None,
    status: str = None,
    assigned_to_id: int = None,
    include_completed: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get tasks with filters - only from user's organization."""
    # Get board IDs that belong to user's organization
    org_board_ids = [b.id for b in db.query(TaskBoard).filter(
        TaskBoard.organization_id == current_user.organization_id
    ).all()]

    query = db.query(Task).filter(Task.board_id.in_(org_board_ids))

    if board_id:
        query = query.filter(Task.board_id == board_id)
    if column_id:
        query = query.filter(Task.column_id == column_id)
    if status:
        query = query.filter(Task.status == status)
    if assigned_to_id:
        query = query.filter(Task.assigned_to_id == assigned_to_id)
    if not include_completed:
        query = query.filter(Task.status != "done")

    tasks = query.order_by(Task.position, Task.created_at.desc()).all()

    # Add computed fields
    result = []
    for task in tasks:
        task_dict = TaskResponse.model_validate(task).model_dump()
        # Calculate total time from time entries
        task_dict["total_time_minutes"] = sum([t.duration_minutes or 0 for t in task.time_entries])
        task_dict["comment_count"] = len(task.comments)
        result.append(task_dict)

    return result


@app.post("/api/tasks", response_model=TaskResponse)
def create_task(
    task: TaskCreate,
    current_user: User = Depends(get_editor_or_admin),
    db: Session = Depends(get_db)
):
    """Create a task. Only admin can set assigned_to_id."""
    task_data = task.model_dump()

    # Only admin can assign tasks
    if task_data.get("assigned_to_id") and current_user.role != "admin":
        task_data["assigned_to_id"] = None

    # Set position to end of column
    if task_data.get("column_id"):
        max_pos = db.query(Task).filter(Task.column_id == task_data["column_id"]).count()
        task_data["position"] = max_pos

    db_task = Task(**task_data, created_by_id=current_user.id)
    db.add(db_task)
    db.commit()

    # Log activity
    activity = TaskActivity(
        task_id=db_task.id,
        user_id=current_user.id,
        activity_type="created",
        description=f"Created task: {db_task.title}"
    )
    db.add(activity)
    db.commit()
    db.refresh(db_task)
    return db_task


@app.get("/api/tasks/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task_dict = TaskResponse.model_validate(task).model_dump()
    task_dict["total_time_minutes"] = sum([t.duration_minutes or 0 for t in task.time_entries])
    task_dict["comment_count"] = len(task.comments)
    return task_dict


@app.patch("/api/tasks/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    task: TaskUpdate,
    current_user: User = Depends(get_editor_or_admin),
    db: Session = Depends(get_db)
):
    """Update task (editor/admin only)."""
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = task.model_dump(exclude_unset=True)

    # Track status changes
    if "status" in update_data and update_data["status"] != db_task.status:
        old_status = db_task.status
        activity = TaskActivity(
            task_id=task_id,
            user_id=current_user.id,
            activity_type="status_changed",
            description=f"Changed status from {old_status} to {update_data['status']}",
            old_value=old_status,
            new_value=update_data["status"]
        )
        db.add(activity)

        # Set completed_at if status is done
        if update_data["status"] == "done" and not db_task.completed_at:
            update_data["completed_at"] = datetime.utcnow()

            # Award XP for task completion
            # Use task's business_id, or fall back to board's business_id
            business_id = db_task.business_id
            if not business_id:
                board = db.query(TaskBoard).filter(TaskBoard.id == db_task.board_id).first()
                business_id = board.business_id if board else None

            if business_id:
                completed_early = db_task.due_date and datetime.utcnow() < db_task.due_date
                xp_amount = _calculate_task_xp(db_task, completed_early)
                _award_xp(db, business_id, xp_amount, current_user.organization_id)
                # Update quest and achievement progress
                _update_quest_progress(db, business_id, "task_complete")
                _update_achievement_progress_internal(db, business_id, "task_complete")

        elif update_data["status"] != "done":
            update_data["completed_at"] = None

    for key, value in update_data.items():
        setattr(db_task, key, value)

    db.commit()
    db.refresh(db_task)
    return db_task


@app.delete("/api/tasks/{task_id}")
def delete_task(
    task_id: int,
    current_user: User = Depends(get_editor_or_admin),
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return {"ok": True}


# ============ Task Assignment (Admin Only) ============

@app.patch("/api/tasks/{task_id}/assign", response_model=TaskResponse)
def assign_task(
    task_id: int,
    assignment: TaskAssign,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Assign task to user (admin only)."""
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")

    old_assignee = db_task.assigned_to_id
    db_task.assigned_to_id = assignment.assigned_to_id

    # Get assignee name for activity log
    assignee_name = None
    if assignment.assigned_to_id:
        assignee = db.query(User).filter(User.id == assignment.assigned_to_id).first()
        assignee_name = assignee.name or assignee.email if assignee else None

    activity = TaskActivity(
        task_id=task_id,
        user_id=current_user.id,
        activity_type="assigned",
        description=f"Assigned task to {assignee_name}" if assignee_name else "Unassigned task",
        old_value=str(old_assignee) if old_assignee else None,
        new_value=str(assignment.assigned_to_id) if assignment.assigned_to_id else None
    )
    db.add(activity)
    db.commit()
    db.refresh(db_task)
    return db_task


# ============ Task Completion (All Users!) ============

@app.post("/api/tasks/{task_id}/complete", response_model=TaskResponse)
def complete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark task as complete. All authenticated users can do this (including viewers)."""
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")

    if db_task.status == "done":
        raise HTTPException(status_code=400, detail="Task already completed")

    old_status = db_task.status
    db_task.status = "done"
    db_task.completed_at = datetime.utcnow()

    # Move to Done column if board has one
    done_column = db.query(TaskColumn).filter(
        TaskColumn.board_id == db_task.board_id,
        TaskColumn.status == "done"
    ).first()
    if done_column:
        db_task.column_id = done_column.id

    activity = TaskActivity(
        task_id=task_id,
        user_id=current_user.id,
        activity_type="completed",
        description="Marked task as complete",
        old_value=old_status,
        new_value="done"
    )
    db.add(activity)

    # Award XP for task completion
    # Use task's business_id, or fall back to board's business_id
    business_id = db_task.business_id
    if not business_id:
        board = db.query(TaskBoard).filter(TaskBoard.id == db_task.board_id).first()
        business_id = board.business_id if board else None

    if business_id:
        completed_early = db_task.due_date and datetime.utcnow() < db_task.due_date
        xp_amount = _calculate_task_xp(db_task, completed_early)
        _award_xp(db, business_id, xp_amount, current_user.organization_id)
        # Update quest and achievement progress
        _update_quest_progress(db, business_id, "task_complete")
        _update_achievement_progress_internal(db, business_id, "task_complete")

    db.commit()
    db.refresh(db_task)
    return db_task


@app.post("/api/tasks/{task_id}/reopen", response_model=TaskResponse)
def reopen_task(
    task_id: int,
    current_user: User = Depends(get_editor_or_admin),
    db: Session = Depends(get_db)
):
    """Reopen a completed task (editor/admin only)."""
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")

    if db_task.status != "done":
        raise HTTPException(status_code=400, detail="Task is not completed")

    db_task.status = "todo"
    db_task.completed_at = None

    # Move to Todo column
    todo_column = db.query(TaskColumn).filter(
        TaskColumn.board_id == db_task.board_id,
        TaskColumn.status == "todo"
    ).first()
    if todo_column:
        db_task.column_id = todo_column.id

    activity = TaskActivity(
        task_id=task_id,
        user_id=current_user.id,
        activity_type="reopened",
        description="Reopened task"
    )
    db.add(activity)
    db.commit()
    db.refresh(db_task)
    return db_task


# ============ Task Move (Drag-and-Drop) ============

@app.post("/api/tasks/move", response_model=TaskResponse)
def move_task(
    move: TaskMove,
    current_user: User = Depends(get_editor_or_admin),
    db: Session = Depends(get_db)
):
    """Move task to different column/position (drag-and-drop)."""
    db_task = db.query(Task).filter(Task.id == move.task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")

    target_column = db.query(TaskColumn).filter(TaskColumn.id == move.target_column_id).first()
    if not target_column:
        raise HTTPException(status_code=404, detail="Target column not found")

    old_column_id = db_task.column_id

    # If moving to different column, update status
    if target_column.id != old_column_id:
        db_task.column_id = target_column.id
        db_task.status = target_column.status

        # Update completed_at based on new status
        if target_column.status == "done" and not db_task.completed_at:
            db_task.completed_at = datetime.utcnow()
        elif target_column.status != "done":
            db_task.completed_at = None

    # Reorder tasks in target column
    tasks_in_target = db.query(Task).filter(
        Task.column_id == move.target_column_id,
        Task.id != move.task_id
    ).order_by(Task.position).all()

    # Insert at target position
    for i, t in enumerate(tasks_in_target):
        if i >= move.target_position:
            t.position = i + 1
        else:
            t.position = i

    db_task.position = move.target_position

    # Log if column changed
    if old_column_id != target_column.id:
        activity = TaskActivity(
            task_id=move.task_id,
            user_id=current_user.id,
            activity_type="status_changed",
            description=f"Moved to {target_column.name}",
            old_value=str(old_column_id),
            new_value=str(target_column.id)
        )
        db.add(activity)

    db.commit()
    db.refresh(db_task)
    return db_task


# ============ Task Comments ============

@app.get("/api/tasks/{task_id}/comments", response_model=List[TaskCommentResponse])
def get_task_comments(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(TaskComment).filter(TaskComment.task_id == task_id).order_by(TaskComment.created_at).all()


@app.post("/api/comments", response_model=TaskCommentResponse)
def create_comment(
    comment: TaskCommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a comment. All authenticated users can comment."""
    task = db.query(Task).filter(Task.id == comment.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    db_comment = TaskComment(
        task_id=comment.task_id,
        user_id=current_user.id,
        content=comment.content
    )
    db.add(db_comment)

    activity = TaskActivity(
        task_id=comment.task_id,
        user_id=current_user.id,
        activity_type="commented",
        description="Added a comment"
    )
    db.add(activity)
    db.commit()
    db.refresh(db_comment)
    return db_comment


@app.patch("/api/comments/{comment_id}", response_model=TaskCommentResponse)
def update_comment(
    comment_id: int,
    comment: TaskCommentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_comment = db.query(TaskComment).filter(TaskComment.id == comment_id).first()
    if not db_comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    # Only owner or admin can edit
    if db_comment.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Cannot edit this comment")

    db_comment.content = comment.content
    db_comment.is_edited = True
    db.commit()
    db.refresh(db_comment)
    return db_comment


@app.delete("/api/comments/{comment_id}")
def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_comment = db.query(TaskComment).filter(TaskComment.id == comment_id).first()
    if not db_comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if db_comment.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Cannot delete this comment")

    db.delete(db_comment)
    db.commit()
    return {"ok": True}


# ============ Time Tracking ============

@app.get("/api/tasks/{task_id}/time-entries", response_model=List[TimeEntryResponse])
def get_time_entries(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(TimeEntry).filter(TimeEntry.task_id == task_id).order_by(TimeEntry.created_at.desc()).all()


@app.post("/api/time-entries", response_model=TimeEntryResponse)
def create_time_entry(
    entry: TimeEntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a manual time entry."""
    task = db.query(Task).filter(Task.id == entry.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    db_entry = TimeEntry(
        task_id=entry.task_id,
        user_id=current_user.id,
        duration_minutes=entry.duration_minutes,
        description=entry.description,
        is_running=False
    )
    db.add(db_entry)

    if entry.duration_minutes:
        activity = TaskActivity(
            task_id=entry.task_id,
            user_id=current_user.id,
            activity_type="time_logged",
            description=f"Logged {entry.duration_minutes} minutes"
        )
        db.add(activity)

    db.commit()
    db.refresh(db_entry)
    return db_entry


@app.post("/api/time-entries/start", response_model=TimeEntryResponse)
def start_timer(
    timer: TimerStart,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Start a timer for a task."""
    task = db.query(Task).filter(Task.id == timer.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Check for existing running timer for this user
    existing = db.query(TimeEntry).filter(
        TimeEntry.user_id == current_user.id,
        TimeEntry.is_running == True
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You have a running timer. Stop it first.")

    db_entry = TimeEntry(
        task_id=timer.task_id,
        user_id=current_user.id,
        started_at=datetime.utcnow(),
        description=timer.description,
        is_running=True
    )
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry


@app.post("/api/time-entries/{entry_id}/stop", response_model=TimeEntryResponse)
def stop_timer(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Stop a running timer."""
    db_entry = db.query(TimeEntry).filter(TimeEntry.id == entry_id).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail="Time entry not found")

    if db_entry.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot stop another user's timer")

    if not db_entry.is_running:
        raise HTTPException(status_code=400, detail="Timer is not running")

    now = datetime.utcnow()
    db_entry.ended_at = now
    db_entry.is_running = False
    db_entry.duration_minutes = int((now - db_entry.started_at).total_seconds() / 60)

    activity = TaskActivity(
        task_id=db_entry.task_id,
        user_id=current_user.id,
        activity_type="time_logged",
        description=f"Tracked {db_entry.duration_minutes} minutes"
    )
    db.add(activity)
    db.commit()
    db.refresh(db_entry)
    return db_entry


@app.get("/api/time-entries/running")
def get_running_timer(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the current user's running timer if any. Returns null if none."""
    entry = db.query(TimeEntry).filter(
        TimeEntry.user_id == current_user.id,
        TimeEntry.is_running == True
    ).first()
    if not entry:
        return None
    return TimeEntryResponse.model_validate(entry)


@app.delete("/api/time-entries/{entry_id}")
def delete_time_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_entry = db.query(TimeEntry).filter(TimeEntry.id == entry_id).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail="Time entry not found")

    if db_entry.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Cannot delete this entry")

    db.delete(db_entry)
    db.commit()
    return {"ok": True}


# ============ Task Activity ============

@app.get("/api/tasks/{task_id}/activity", response_model=List[TaskActivityResponse])
def get_task_activity(
    task_id: int,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(TaskActivity).filter(
        TaskActivity.task_id == task_id
    ).order_by(TaskActivity.created_at.desc()).limit(limit).all()


# ============ Users list for task assignment ============

@app.get("/api/users-list", response_model=List[UserBrief])
def get_users_list(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get list of users for assignment dropdowns."""
    users = db.query(User).filter(User.is_active == True).order_by(User.name, User.email).all()
    return users


# ============ Metrics ============

@app.get("/api/metrics", response_model=List[MetricResponse])
def get_metrics(
    metric_type: str = None,
    start_date: datetime = None,
    end_date: datetime = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get metrics with optional filters."""
    query = db.query(Metric).filter(Metric.organization_id == current_user.organization_id)
    if metric_type:
        query = query.filter(Metric.metric_type == metric_type)
    if start_date:
        query = query.filter(Metric.date >= start_date)
    if end_date:
        query = query.filter(Metric.date <= end_date)
    return query.order_by(Metric.date.desc()).all()


@app.post("/api/metrics", response_model=MetricResponse)
def create_metric(
    metric: MetricCreate,
    current_user: User = Depends(get_editor_or_admin),
    db: Session = Depends(get_db)
):
    """Create a metric (editor/admin only)."""
    db_metric = Metric(**metric.model_dump(), created_by_id=current_user.id, organization_id=current_user.organization_id)
    db.add(db_metric)
    db.commit()
    db.refresh(db_metric)

    # Award XP for logging a metric
    if db_metric.business_id:
        _award_xp(db, db_metric.business_id, XP_METRIC_ENTRY, current_user.organization_id)
        # Update quest and achievement progress
        _update_quest_progress(db, db_metric.business_id, "metric_create")
        _update_achievement_progress_internal(db, db_metric.business_id, "metric_create")
        db.commit()

    return db_metric


@app.get("/api/metrics/{metric_id}", response_model=MetricResponse)
def get_metric(
    metric_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    metric = db.query(Metric).filter(Metric.id == metric_id).first()
    if not metric:
        raise HTTPException(status_code=404, detail="Metric not found")
    return metric


@app.patch("/api/metrics/{metric_id}", response_model=MetricResponse)
def update_metric(
    metric_id: int,
    metric: MetricUpdate,
    current_user: User = Depends(get_editor_or_admin),
    db: Session = Depends(get_db)
):
    """Update a metric (editor/admin only)."""
    db_metric = db.query(Metric).filter(Metric.id == metric_id).first()
    if not db_metric:
        raise HTTPException(status_code=404, detail="Metric not found")

    for key, value in metric.model_dump(exclude_unset=True).items():
        setattr(db_metric, key, value)

    db.commit()
    db.refresh(db_metric)
    return db_metric


@app.delete("/api/metrics/{metric_id}")
def delete_metric(
    metric_id: int,
    current_user: User = Depends(get_editor_or_admin),
    db: Session = Depends(get_db)
):
    """Delete a metric (editor/admin only)."""
    metric = db.query(Metric).filter(Metric.id == metric_id).first()
    if not metric:
        raise HTTPException(status_code=404, detail="Metric not found")
    db.delete(metric)
    db.commit()
    return {"ok": True}


@app.get("/api/metrics/summary/latest", response_model=List[MetricSummary])
def get_latest_metrics_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the latest value for each metric type with change from previous."""
    from sqlalchemy import func, desc

    # Get all unique metric types
    metric_types = db.query(Metric.metric_type, Metric.name).distinct().all()

    summaries = []
    for metric_type, name in metric_types:
        # Get the two most recent values for this metric type
        recent = db.query(Metric).filter(
            Metric.metric_type == metric_type
        ).order_by(desc(Metric.date)).limit(2).all()

        if recent:
            current = recent[0]
            previous = recent[1] if len(recent) > 1 else None

            # Calculate change percent
            change_percent = None
            trend = None
            if previous:
                try:
                    curr_val = float(current.value.replace(',', '').replace('$', '').replace('%', ''))
                    prev_val = float(previous.value.replace(',', '').replace('$', '').replace('%', ''))
                    if prev_val != 0:
                        change_percent = ((curr_val - prev_val) / prev_val) * 100
                        if change_percent > 0:
                            trend = "up"
                        elif change_percent < 0:
                            trend = "down"
                        else:
                            trend = "flat"
                except (ValueError, AttributeError):
                    pass

            summaries.append(MetricSummary(
                metric_type=metric_type,
                name=current.name,
                current_value=current.value,
                previous_value=previous.value if previous else None,
                change_percent=round(change_percent, 1) if change_percent is not None else None,
                unit=current.unit,
                trend=trend
            ))

    return summaries


@app.get("/api/metrics/chart/{metric_type}")
def get_metric_chart_data(
    metric_type: str,
    months: int = 12,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get metric data formatted for charts."""
    start_date = datetime.utcnow() - timedelta(days=months * 30)

    metrics = db.query(Metric).filter(
        Metric.metric_type == metric_type,
        Metric.date >= start_date
    ).order_by(Metric.date).all()

    return {
        "metric_type": metric_type,
        "data": [
            {
                "date": m.date.isoformat(),
                "value": m.value,
                "notes": m.notes
            }
            for m in metrics
        ]
    }


# ============ ANALYTICS ROUTES ============

from .models import MetricGoal
from .schemas import (
    MetricGoalCreate, MetricGoalUpdate, MetricGoalResponse,
    AnalyticsOverview, GrowthMetric, FinancialHealth, CustomerHealth, AnalyticsDashboard
)


def parse_metric_value(value: str) -> float:
    """Parse a metric value string to float."""
    try:
        # Remove common formatting
        cleaned = value.replace(',', '').replace('$', '').replace('%', '').strip()
        return float(cleaned)
    except (ValueError, AttributeError):
        return 0.0


def get_period_days(period: str) -> int:
    """Convert period string to days."""
    periods = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "1y": 365,
        "all": 3650  # ~10 years
    }
    return periods.get(period, 30)


@app.get("/api/analytics/dashboard")
def get_analytics_dashboard(
    period: str = "30d",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get comprehensive analytics dashboard data."""
    from sqlalchemy import func, desc

    days = get_period_days(period)
    start_date = datetime.utcnow() - timedelta(days=days)
    prev_start = start_date - timedelta(days=days)
    prev_end = start_date

    # Get all metrics in period
    current_metrics = db.query(Metric).filter(
        Metric.date >= start_date
    ).all()

    prev_metrics = db.query(Metric).filter(
        Metric.date >= prev_start,
        Metric.date < prev_end
    ).all()

    # Get unique metric types
    metric_types = db.query(Metric.metric_type).distinct().all()
    metric_types = [m[0] for m in metric_types]

    # Calculate trends per metric type
    improving = 0
    declining = 0
    flat = 0
    growth_metrics = []

    for mt in metric_types:
        # Get latest value for current period
        current = db.query(Metric).filter(
            Metric.metric_type == mt,
            Metric.date >= start_date
        ).order_by(desc(Metric.date)).first()

        # Get latest value for previous period
        previous = db.query(Metric).filter(
            Metric.metric_type == mt,
            Metric.date >= prev_start,
            Metric.date < prev_end
        ).order_by(desc(Metric.date)).first()

        if current and previous:
            curr_val = parse_metric_value(current.value)
            prev_val = parse_metric_value(previous.value)

            if prev_val != 0:
                pct_change = ((curr_val - prev_val) / abs(prev_val)) * 100
            else:
                pct_change = 100 if curr_val > 0 else 0

            # Invert for metrics where down is good
            inverted = mt in ['burn_rate', 'churn', 'cac']
            actual_change = pct_change * (-1 if inverted else 1)

            if actual_change > 1:
                improving += 1
            elif actual_change < -1:
                declining += 1
            else:
                flat += 1

            growth_metrics.append(GrowthMetric(
                metric_type=mt,
                name=current.name,
                current_value=curr_val,
                previous_value=prev_val,
                absolute_change=round(curr_val - prev_val, 2),
                percent_change=round(pct_change, 1),
                unit=current.unit
            ))
        elif current:
            flat += 1

    # Build financial health
    def get_latest_value(metric_type: str) -> float | None:
        m = db.query(Metric).filter(
            Metric.metric_type == metric_type
        ).order_by(desc(Metric.date)).first()
        return parse_metric_value(m.value) if m else None

    mrr = get_latest_value('mrr')
    prev_mrr = None
    prev_mrr_metric = db.query(Metric).filter(
        Metric.metric_type == 'mrr',
        Metric.date < start_date
    ).order_by(desc(Metric.date)).first()
    if prev_mrr_metric:
        prev_mrr = parse_metric_value(prev_mrr_metric.value)

    mrr_growth = None
    if mrr and prev_mrr and prev_mrr > 0:
        mrr_growth = round(((mrr - prev_mrr) / prev_mrr) * 100, 1)

    financial = FinancialHealth(
        mrr=mrr,
        arr=get_latest_value('arr'),
        burn_rate=get_latest_value('burn_rate'),
        runway_months=get_latest_value('runway'),
        cash=get_latest_value('cash'),
        mrr_growth=mrr_growth,
        revenue=get_latest_value('revenue')
    )

    # Build customer health
    customers = get_latest_value('customers')
    prev_customers_metric = db.query(Metric).filter(
        Metric.metric_type == 'customers',
        Metric.date < start_date
    ).order_by(desc(Metric.date)).first()
    prev_customers = parse_metric_value(prev_customers_metric.value) if prev_customers_metric else None

    customer_growth = None
    if customers and prev_customers and prev_customers > 0:
        customer_growth = round(((customers - prev_customers) / prev_customers) * 100, 1)

    ltv = get_latest_value('ltv')
    cac = get_latest_value('cac')
    ltv_cac_ratio = None
    if ltv and cac and cac > 0:
        ltv_cac_ratio = round(ltv / cac, 2)

    customer = CustomerHealth(
        total_customers=int(customers) if customers else None,
        customer_growth=customer_growth,
        churn_rate=get_latest_value('churn'),
        ltv=ltv,
        cac=cac,
        ltv_cac_ratio=ltv_cac_ratio,
        nps=get_latest_value('nps')
    )

    # Get goals with progress
    goals_db = db.query(MetricGoal).filter(
        MetricGoal.is_achieved == False
    ).all()

    goals = []
    for g in goals_db:
        current_val = get_latest_value(g.metric_type)
        progress = None
        if current_val is not None and g.target_value != 0:
            progress = round((current_val / g.target_value) * 100, 1)

        goals.append(MetricGoalResponse(
            id=g.id,
            metric_type=g.metric_type,
            target_value=g.target_value,
            target_date=g.target_date,
            name=g.name,
            notes=g.notes,
            current_value=current_val,
            progress_percent=progress,
            is_achieved=g.is_achieved,
            created_at=g.created_at,
            updated_at=g.updated_at
        ))

    overview = AnalyticsOverview(
        period=period,
        total_metrics=len(metric_types),
        metrics_with_data=len([m for m in growth_metrics if m.current_value]),
        improving_metrics=improving,
        declining_metrics=declining,
        flat_metrics=flat
    )

    return AnalyticsDashboard(
        overview=overview,
        financial=financial,
        customer=customer,
        growth_metrics=growth_metrics,
        goals=goals
    )


@app.get("/api/analytics/multi-chart")
def get_multi_metric_chart(
    metric_types: str,  # comma-separated
    period: str = "30d",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get chart data for multiple metrics at once."""
    types = [t.strip() for t in metric_types.split(',')]
    days = get_period_days(period)
    start_date = datetime.utcnow() - timedelta(days=days)

    result = {}
    for mt in types:
        metrics = db.query(Metric).filter(
            Metric.metric_type == mt,
            Metric.date >= start_date
        ).order_by(Metric.date).all()

        result[mt] = [
            {
                "date": m.date.isoformat(),
                "value": parse_metric_value(m.value),
                "formatted": m.value
            }
            for m in metrics
        ]

    return result


# Goal CRUD
@app.get("/api/analytics/goals", response_model=List[MetricGoalResponse])
def get_metric_goals(
    include_achieved: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all metric goals."""
    query = db.query(MetricGoal)
    if not include_achieved:
        query = query.filter(MetricGoal.is_achieved == False)

    goals = query.order_by(MetricGoal.target_date).all()

    result = []
    for g in goals:
        # Get current value
        latest = db.query(Metric).filter(
            Metric.metric_type == g.metric_type
        ).order_by(Metric.date.desc()).first()

        current_val = parse_metric_value(latest.value) if latest else None
        progress = None
        if current_val is not None and g.target_value != 0:
            progress = round((current_val / g.target_value) * 100, 1)

        result.append(MetricGoalResponse(
            id=g.id,
            metric_type=g.metric_type,
            target_value=g.target_value,
            target_date=g.target_date,
            name=g.name,
            notes=g.notes,
            current_value=current_val,
            progress_percent=progress,
            is_achieved=g.is_achieved,
            created_at=g.created_at,
            updated_at=g.updated_at
        ))

    return result


@app.post("/api/analytics/goals", response_model=MetricGoalResponse)
def create_metric_goal(
    goal: MetricGoalCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new metric goal."""
    if current_user.role not in ['admin', 'editor']:
        raise HTTPException(status_code=403, detail="Not authorized")

    db_goal = MetricGoal(
        metric_type=goal.metric_type,
        target_value=goal.target_value,
        target_date=goal.target_date,
        name=goal.name,
        notes=goal.notes,
        created_by_id=current_user.id
    )
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)

    # Get current value
    latest = db.query(Metric).filter(
        Metric.metric_type == goal.metric_type
    ).order_by(Metric.date.desc()).first()

    current_val = parse_metric_value(latest.value) if latest else None
    progress = None
    if current_val is not None and goal.target_value != 0:
        progress = round((current_val / goal.target_value) * 100, 1)

    return MetricGoalResponse(
        id=db_goal.id,
        metric_type=db_goal.metric_type,
        target_value=db_goal.target_value,
        target_date=db_goal.target_date,
        name=db_goal.name,
        notes=db_goal.notes,
        current_value=current_val,
        progress_percent=progress,
        is_achieved=db_goal.is_achieved,
        created_at=db_goal.created_at,
        updated_at=db_goal.updated_at
    )


@app.patch("/api/analytics/goals/{goal_id}", response_model=MetricGoalResponse)
def update_metric_goal(
    goal_id: int,
    goal_update: MetricGoalUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a metric goal."""
    if current_user.role not in ['admin', 'editor']:
        raise HTTPException(status_code=403, detail="Not authorized")

    db_goal = db.query(MetricGoal).filter(MetricGoal.id == goal_id).first()
    if not db_goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    update_data = goal_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_goal, field, value)

    db.commit()
    db.refresh(db_goal)

    # Get current value
    latest = db.query(Metric).filter(
        Metric.metric_type == db_goal.metric_type
    ).order_by(Metric.date.desc()).first()

    current_val = parse_metric_value(latest.value) if latest else None
    progress = None
    if current_val is not None and db_goal.target_value != 0:
        progress = round((current_val / db_goal.target_value) * 100, 1)

    return MetricGoalResponse(
        id=db_goal.id,
        metric_type=db_goal.metric_type,
        target_value=db_goal.target_value,
        target_date=db_goal.target_date,
        name=db_goal.name,
        notes=db_goal.notes,
        current_value=current_val,
        progress_percent=progress,
        is_achieved=db_goal.is_achieved,
        created_at=db_goal.created_at,
        updated_at=db_goal.updated_at
    )


@app.delete("/api/analytics/goals/{goal_id}")
def delete_metric_goal(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a metric goal."""
    if current_user.role not in ['admin', 'editor']:
        raise HTTPException(status_code=403, detail="Not authorized")

    db_goal = db.query(MetricGoal).filter(MetricGoal.id == goal_id).first()
    if not db_goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    db.delete(db_goal)
    db.commit()
    return {"ok": True}


# ============ WEB PRESENCE ROUTES ============

def safe_json_loads(value: str | None) -> list | None:
    """Safely parse JSON, returning None on error."""
    if not value:
        return None
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        logger.warning(f"Failed to parse JSON: {value[:100] if value else 'None'}")
        return None

def serialize_web_presence(presence: WebPresence) -> dict:
    """Convert WebPresence model to dict with parsed JSON fields."""
    result = {
        "id": presence.id,
        "domain_name": presence.domain_name,
        "domain_registrar": presence.domain_registrar,
        "domain_expiration": presence.domain_expiration,
        "domain_privacy": presence.domain_privacy,
        "domain_auto_renew": presence.domain_auto_renew,
        "email_provider": presence.email_provider,
        "email_domain": presence.email_domain,
        "email_admin": presence.email_admin,
        "additional_emails": safe_json_loads(presence.additional_emails),
        "website_url": presence.website_url,
        "website_platform": presence.website_platform,
        "website_hosting": presence.website_hosting,
        "ssl_enabled": presence.ssl_enabled,
        "additional_websites": safe_json_loads(presence.additional_websites),
        "linkedin_url": presence.linkedin_url,
        "twitter_url": presence.twitter_url,
        "instagram_url": presence.instagram_url,
        "facebook_url": presence.facebook_url,
        "youtube_url": presence.youtube_url,
        "github_url": presence.github_url,
        "tiktok_url": presence.tiktok_url,
        "additional_socials": safe_json_loads(presence.additional_socials),
        "google_business_url": presence.google_business_url,
        "google_business_verified": presence.google_business_verified,
        "apple_business_url": presence.apple_business_url,
        "apple_business_verified": presence.apple_business_verified,
        "bing_places_url": presence.bing_places_url,
        "bing_places_verified": presence.bing_places_verified,
        "yelp_url": presence.yelp_url,
        "yelp_claimed": presence.yelp_claimed,
        "bbb_url": presence.bbb_url,
        "bbb_accredited": presence.bbb_accredited,
        "additional_listings": safe_json_loads(presence.additional_listings),
        "notes": presence.notes,
        "created_at": presence.created_at,
        "updated_at": presence.updated_at,
    }
    return result


@app.get("/api/web-presence")
def get_web_presence(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get web presence info (singleton - creates if not exists)."""
    presence = db.query(WebPresence).first()
    if not presence:
        presence = WebPresence()
        db.add(presence)
        db.commit()
        db.refresh(presence)
    return serialize_web_presence(presence)


@app.patch("/api/web-presence")
def update_web_presence(
    data: WebPresenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update web presence info."""
    try:
        presence = db.query(WebPresence).first()
        if not presence:
            presence = WebPresence()
            db.add(presence)
            db.commit()
            db.refresh(presence)

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            # Serialize list fields to JSON
            if key in ('additional_emails', 'additional_websites', 'additional_socials', 'additional_listings') and value is not None:
                try:
                    value = json.dumps([item.model_dump() if hasattr(item, 'model_dump') else item for item in value])
                except (TypeError, AttributeError) as e:
                    logger.warning(f"Failed to serialize {key}: {e}")
                    value = json.dumps(value) if value else None
            setattr(presence, key, value)

        db.commit()
        db.refresh(presence)
        return serialize_web_presence(presence)
    except Exception as e:
        logger.error(f"Error updating web presence: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update web presence: {str(e)}")


# ============ BANK ACCOUNT ROUTES ============

@app.get("/api/bank-accounts", response_model=List[BankAccountResponse])
def get_bank_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all bank accounts."""
    return db.query(BankAccount).order_by(BankAccount.is_primary.desc(), BankAccount.institution_name).all()


@app.post("/api/bank-accounts", response_model=BankAccountResponse)
def create_bank_account(
    data: BankAccountCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a bank account."""
    account = BankAccount(**data.model_dump())
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@app.get("/api/bank-accounts/{account_id}", response_model=BankAccountResponse)
def get_bank_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific bank account."""
    account = db.query(BankAccount).filter(BankAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    return account


@app.patch("/api/bank-accounts/{account_id}", response_model=BankAccountResponse)
def update_bank_account(
    account_id: int,
    data: BankAccountUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a bank account."""
    account = db.query(BankAccount).filter(BankAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(account, key, value)

    db.commit()
    db.refresh(account)
    return account


@app.delete("/api/bank-accounts/{account_id}")
def delete_bank_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a bank account."""
    account = db.query(BankAccount).filter(BankAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")

    db.delete(account)
    db.commit()
    return {"message": "Bank account deleted"}


# ============ Calendar Integration (iCal) ============

@app.post("/api/calendar/generate-token")
def generate_calendar_token(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate or regenerate a calendar subscription token for the current user."""
    # Generate a unique token
    token = secrets.token_urlsafe(32)

    # Update user's calendar token
    current_user.calendar_token = token
    db.commit()

    return {"calendar_token": token}


@app.get("/api/calendar/token")
def get_calendar_token(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the current user's calendar subscription token."""
    return {"calendar_token": current_user.calendar_token}


@app.get("/api/calendar/feed/{token}.ics")
def get_calendar_feed(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Get iCal feed for tasks and deadlines.
    This endpoint uses a token for authentication so it can be used by calendar apps.
    """
    if not ICALENDAR_AVAILABLE:
        raise HTTPException(status_code=501, detail="Calendar sync not available - icalendar package not installed")

    # Find user by calendar token
    user = db.query(User).filter(User.calendar_token == token).first()
    if not user:
        raise HTTPException(status_code=404, detail="Invalid calendar token")

    # Create calendar
    cal = ICalendar()
    cal.add('prodid', '-//Made4Founders//Task Calendar//EN')
    cal.add('version', '2.0')
    cal.add('calscale', 'GREGORIAN')
    cal.add('method', 'PUBLISH')
    cal.add('x-wr-calname', 'Made4Founders Tasks & Deadlines')

    # Add deadlines
    deadlines = db.query(Deadline).filter(Deadline.is_completed == False).all()
    for deadline in deadlines:
        event = ICalEvent()
        event.add('uid', f'deadline-{deadline.id}@made4founders')
        event.add('summary', f'[Deadline] {deadline.title}')
        if deadline.description:
            event.add('description', deadline.description)
        event.add('dtstart', deadline.due_date.date())
        event.add('dtend', deadline.due_date.date())

        # Add reminder/alarm
        if deadline.reminder_days and ICalAlarm:
            alarm = ICalAlarm()
            alarm.add('action', 'DISPLAY')
            alarm.add('description', f'Reminder: {deadline.title}')
            alarm.add('trigger', timedelta(days=-deadline.reminder_days))
            event.add_component(alarm)

        # Add categories based on type
        event.add('categories', [deadline.deadline_type.upper()])
        event.add('status', 'CONFIRMED')
        cal.add_component(event)

    # Add tasks with due dates
    tasks = db.query(Task).filter(
        Task.due_date != None,
        Task.status != 'done'
    ).all()

    for task in tasks:
        event = ICalEvent()
        event.add('uid', f'task-{task.id}@made4founders')

        # Add priority indicator to title
        priority_prefix = {
            'urgent': '[!!!] ',
            'high': '[!!] ',
            'medium': '[!] ',
            'low': ''
        }.get(task.priority, '')

        event.add('summary', f'{priority_prefix}{task.title}')
        if task.description:
            event.add('description', task.description)
        event.add('dtstart', task.due_date.date())
        event.add('dtend', task.due_date.date())

        # Map priority to iCal priority (1=high, 5=medium, 9=low)
        ical_priority = {
            'urgent': 1,
            'high': 2,
            'medium': 5,
            'low': 9
        }.get(task.priority, 5)
        event.add('priority', ical_priority)

        # Add status
        status_map = {
            'backlog': 'TENTATIVE',
            'todo': 'CONFIRMED',
            'in_progress': 'CONFIRMED',
            'done': 'COMPLETED'
        }
        event.add('status', status_map.get(task.status, 'CONFIRMED'))
        event.add('categories', ['TASK', task.priority.upper()])
        cal.add_component(event)

    # Return as .ics file
    return Response(
        content=cal.to_ical(),
        media_type='text/calendar',
        headers={
            'Content-Disposition': 'attachment; filename="made4founders-calendar.ics"'
        }
    )


# ============ Public Contact Form ============
@app.post("/api/contact")
def submit_contact_form(
    submission: ContactSubmissionCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Public endpoint for contact form submissions.
    No authentication required.
    """
    # Basic rate limiting by IP (simple in-memory for now)
    client_ip = request.client.host if request.client else None

    # Create submission
    db_submission = ContactSubmission(
        name=submission.name,
        email=submission.email,
        company=submission.company,
        subject=submission.subject,
        message=submission.message,
        source=submission.source,
        ip_address=client_ip,
        user_agent=request.headers.get("user-agent", "")[:500] if request.headers.get("user-agent") else None,
    )
    db.add(db_submission)
    db.commit()

    return {"ok": True, "message": "Your message has been received. We'll get back to you soon."}
