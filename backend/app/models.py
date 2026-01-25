from sqlalchemy import Column, Integer, String, Text, DateTime, Date, Boolean, ForeignKey, Enum, Float, JSON, Index, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from .database import Base


# ============ MULTI-TENANCY & SUBSCRIPTION ENUMS ============

class SubscriptionTier(str, enum.Enum):
    FREE = "free"
    STARTER = "starter"
    GROWTH = "growth"
    SCALE = "scale"
    ENTERPRISE = "enterprise"


class SubscriptionStatus(str, enum.Enum):
    TRIALING = "trialing"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    UNPAID = "unpaid"


class OAuthProvider(str, enum.Enum):
    GOOGLE = "google"
    GITHUB = "github"
    TWITTER = "twitter"
    FACEBOOK = "facebook"
    INSTAGRAM = "instagram"
    LINKEDIN = "linkedin"


class BrandAssetType(str, enum.Enum):
    LOGO_PRIMARY = "logo_primary"
    LOGO_HORIZONTAL = "logo_horizontal"
    LOGO_STACKED = "logo_stacked"
    LOGO_ICON = "logo_icon"
    LOGO_DARK = "logo_dark"
    LOGO_LIGHT = "logo_light"
    FAVICON = "favicon"
    APP_ICON = "app_icon"
    SOCIAL_COVER = "social_cover"
    PATTERN = "pattern"
    OTHER = "other"


class ColorType(str, enum.Enum):
    PRIMARY = "primary"
    SECONDARY = "secondary"
    ACCENT = "accent"
    BACKGROUND = "background"
    TEXT = "text"
    SUCCESS = "success"
    WARNING = "warning"
    ERROR = "error"
    CUSTOM = "custom"


class FontUsage(str, enum.Enum):
    HEADING = "heading"
    BODY = "body"
    ACCENT = "accent"
    MONOSPACE = "monospace"


class EmailTemplateType(str, enum.Enum):
    NEWSLETTER = "newsletter"
    ANNOUNCEMENT = "announcement"
    PROMOTIONAL = "promotional"
    EVENT = "event"
    FOLLOW_UP = "follow_up"
    WELCOME = "welcome"
    CUSTOM = "custom"


class SocialPlatform(str, enum.Enum):
    TWITTER = "twitter"
    LINKEDIN = "linkedin"
    FACEBOOK = "facebook"
    INSTAGRAM = "instagram"
    THREADS = "threads"


class CampaignStatus(str, enum.Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    SENT = "sent"
    FAILED = "failed"


class DocumentTemplateCategory(str, enum.Enum):
    NDA = "nda"
    OPERATING_AGREEMENT = "operating_agreement"
    BOARD_RESOLUTION = "board_resolution"
    CONTRACTOR_AGREEMENT = "contractor_agreement"
    EMPLOYEE_OFFER = "employee_offer"
    INVESTOR_UPDATE = "investor_update"
    TERMS_OF_SERVICE = "terms_of_service"
    PRIVACY_POLICY = "privacy_policy"
    OTHER = "other"


# ============ BUSINESS TYPES ============

class BusinessType(str, enum.Enum):
    CORPORATION = "corporation"  # C-Corp, S-Corp
    LLC = "llc"
    PRODUCT = "product"  # SaaS, app, physical product
    SERVICE = "service"  # Consulting, agency
    PROJECT = "project"  # Time-bound initiative
    DEPARTMENT = "department"  # Internal division
    BRAND = "brand"  # Sub-brand
    OTHER = "other"


# ============ MULTI-TENANCY MODELS ============

class Organization(Base):
    """Multi-tenant organization (company/startup)"""
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)  # URL-friendly identifier

    # Subscription
    stripe_customer_id = Column(String(255), nullable=True, unique=True)
    stripe_subscription_id = Column(String(255), nullable=True)
    subscription_tier = Column(String(50), default=SubscriptionTier.FREE.value)
    subscription_status = Column(String(50), default=SubscriptionStatus.TRIALING.value)
    trial_ends_at = Column(DateTime, nullable=True)
    subscription_ends_at = Column(DateTime, nullable=True)

    # AI Usage Tracking (resets monthly)
    ai_summaries_used = Column(Integer, default=0)
    ai_usage_reset_at = Column(DateTime, nullable=True)

    # Settings
    settings = Column(JSON, nullable=True)  # JSON for flexible org settings

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="organization")
    subscription_history = relationship("SubscriptionHistory", back_populates="organization")
    businesses = relationship("Business", back_populates="organization", foreign_keys="Business.organization_id")


class Business(Base):
    """
    Fractal business/venture structure.

    Supports hierarchical organization:
    - Top-level: Axion Deep Labs (C-Corp)
      - Child: Site2CRM (Product)
      - Child: Quanta (Product)
        - Grandchild: Quanta API (Service)
        - Grandchild: Quanta Dashboard (Service)

    Items can be assigned to any level. When viewing a business,
    you see items assigned to it + all items from parent levels (inherited).
    """
    __tablename__ = "businesses"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)

    # Fractal hierarchy - NULL parent_id means top-level business
    parent_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=True)

    # Basic info
    name = Column(String(255), nullable=False)  # "Site2CRM", "Quanta"
    slug = Column(String(100), index=True, nullable=True)  # URL-friendly identifier
    business_type = Column(String(50), default=BusinessType.OTHER.value)
    description = Column(Text, nullable=True)

    # Visual identity
    color = Column(String(7), nullable=True)  # Hex color e.g., "#FF6B35"
    emoji = Column(String(10), nullable=True)  # Emoji icon e.g., "🚀"
    logo_path = Column(String(500), nullable=True)  # Path to logo file

    # Additional business info
    website = Column(String(500), nullable=True)
    primary_contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)

    # Status
    is_active = Column(Boolean, default=True)
    is_archived = Column(Boolean, default=False)
    archived_at = Column(DateTime, nullable=True)

    # ============ GAMIFICATION ============
    # XP and Leveling
    xp = Column(Integer, default=0)
    level = Column(Integer, default=1)

    # Streaks (days of consecutive activity)
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    last_activity_date = Column(Date, nullable=True)

    # Health Score (0-100, calculated from various factors)
    health_score = Column(Integer, default=0)
    health_compliance = Column(Integer, default=0)  # Compliance subscore
    health_financial = Column(Integer, default=0)  # Financial subscore
    health_operations = Column(Integer, default=0)  # Operations subscore
    health_growth = Column(Integer, default=0)  # Growth subscore
    health_updated_at = Column(DateTime, nullable=True)

    # Gamification toggle (for the sticklers who don't like fun)
    gamification_enabled = Column(Boolean, default=True)

    # Achievements (JSON array of earned achievement IDs)
    achievements = Column(JSON, nullable=True)

    # Daily quest progress (JSON, resets daily)
    daily_quests = Column(JSON, nullable=True)
    daily_quests_date = Column(Date, nullable=True)

    # ============ CHALLENGE STATS ============
    challenge_wins = Column(Integer, default=0)
    challenge_losses = Column(Integer, default=0)
    challenge_draws = Column(Integer, default=0)
    challenge_win_streak = Column(Integer, default=0)
    best_challenge_win_streak = Column(Integer, default=0)

    # Titles earned (JSON array) - e.g., ["Champion", "Undefeated", "Streak Master"]
    titles = Column(JSON, nullable=True)

    # Current active title being displayed
    active_title = Column(String(50), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="businesses", foreign_keys=[organization_id])
    parent = relationship("Business", remote_side=[id], backref="children")


# ============ QUEST SYSTEM ============

class QuestType(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    ACHIEVEMENT = "achievement"  # One-time achievements


class QuestCategory(str, enum.Enum):
    TASKS = "tasks"
    METRICS = "metrics"
    DOCUMENTS = "documents"
    CONTACTS = "contacts"
    CHECKLIST = "checklist"
    STREAK = "streak"
    GENERAL = "general"


class Quest(Base):
    """
    Quest template definitions.
    These define what quests are available in the system.
    """
    __tablename__ = "quests"

    id = Column(Integer, primary_key=True, index=True)

    # Quest identity
    slug = Column(String(100), unique=True, nullable=False)  # e.g., "complete-3-tasks"
    name = Column(String(255), nullable=False)  # "Task Master"
    description = Column(Text, nullable=True)  # "Complete 3 tasks today"

    # Quest type and category
    quest_type = Column(String(20), default=QuestType.DAILY.value)
    category = Column(String(20), default=QuestCategory.GENERAL.value)

    # Requirements
    target_count = Column(Integer, default=1)  # How many to complete
    action_type = Column(String(50), nullable=False)  # "task_complete", "metric_create", etc.

    # Rewards
    xp_reward = Column(Integer, default=25)

    # Display
    icon = Column(String(50), nullable=True)  # Emoji or icon name
    difficulty = Column(String(20), default="easy")  # easy, medium, hard

    # Availability
    is_active = Column(Boolean, default=True)
    min_level = Column(Integer, default=1)  # Minimum business level to receive this quest

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)


class BusinessQuest(Base):
    """
    Quest instance assigned to a business.
    Tracks progress toward quest completion.
    """
    __tablename__ = "business_quests"

    id = Column(Integer, primary_key=True, index=True)

    # Links
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    quest_id = Column(Integer, ForeignKey("quests.id", ondelete="CASCADE"), nullable=False)

    # Progress tracking
    current_count = Column(Integer, default=0)
    target_count = Column(Integer, nullable=False)  # Copied from quest for history

    # Status
    is_completed = Column(Boolean, default=False)
    is_claimed = Column(Boolean, default=False)  # XP claimed?

    # Timing
    assigned_date = Column(Date, nullable=False)  # When quest was assigned
    expires_at = Column(DateTime, nullable=True)  # When quest expires (daily = end of day)
    completed_at = Column(DateTime, nullable=True)
    claimed_at = Column(DateTime, nullable=True)

    # Reward (copied from quest for history)
    xp_reward = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    business = relationship("Business", backref="quests")
    quest = relationship("Quest", backref="business_instances")

    # Unique constraint: one quest per business per day (for daily quests)
    __table_args__ = (
        Index('ix_business_quest_date', 'business_id', 'quest_id', 'assigned_date'),
    )


# ============ ACHIEVEMENT SYSTEM ============

class AchievementCategory(str, enum.Enum):
    TASKS = "tasks"
    STREAKS = "streaks"
    METRICS = "metrics"
    DOCUMENTS = "documents"
    CONTACTS = "contacts"
    CHECKLIST = "checklist"
    QUESTS = "quests"
    MILESTONES = "milestones"


class Achievement(Base):
    """
    Achievement template definitions.
    Defines what achievements are available in the system.
    """
    __tablename__ = "achievements"

    id = Column(Integer, primary_key=True, index=True)

    # Achievement identity
    slug = Column(String(100), unique=True, nullable=False)  # e.g., "first-task"
    name = Column(String(255), nullable=False)  # "First Steps"
    description = Column(Text, nullable=True)  # "Complete your first task"

    # Category and rarity
    category = Column(String(20), default=AchievementCategory.MILESTONES.value)
    rarity = Column(String(20), default="common")  # common, uncommon, rare, epic, legendary

    # Requirements
    requirement_type = Column(String(50), nullable=False)  # "task_complete", "streak_days", etc.
    requirement_count = Column(Integer, default=1)  # Number needed to unlock

    # Rewards
    xp_reward = Column(Integer, default=50)

    # Display
    icon = Column(String(50), nullable=True)  # Emoji or icon name
    badge_color = Column(String(20), nullable=True)  # Color for badge display

    # Ordering
    sort_order = Column(Integer, default=0)

    # Availability
    is_active = Column(Boolean, default=True)
    is_secret = Column(Boolean, default=False)  # Hidden until unlocked

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)


class BusinessAchievement(Base):
    """
    Tracks which achievements a business has earned.
    """
    __tablename__ = "business_achievements"

    id = Column(Integer, primary_key=True, index=True)

    # Links
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    achievement_id = Column(Integer, ForeignKey("achievements.id", ondelete="CASCADE"), nullable=False)

    # Progress (for achievements that can be partially completed)
    current_count = Column(Integer, default=0)
    target_count = Column(Integer, nullable=False)

    # Status
    is_unlocked = Column(Boolean, default=False)
    unlocked_at = Column(DateTime, nullable=True)

    # XP claimed
    xp_claimed = Column(Boolean, default=False)
    xp_reward = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    business = relationship("Business", backref="earned_achievements")
    achievement = relationship("Achievement", backref="business_instances")

    # Unique constraint: one achievement per business
    __table_args__ = (
        Index('ix_business_achievement', 'business_id', 'achievement_id', unique=True),
    )


# ============ CHALLENGE SYSTEM ============

class ChallengeType(str, enum.Enum):
    TASK_SPRINT = "task_sprint"           # Most tasks completed
    XP_RACE = "xp_race"                   # Most XP earned
    STREAK_SHOWDOWN = "streak_showdown"   # Maintain/grow streak
    QUEST_CHAMPION = "quest_champion"     # Most quests completed
    CHECKLIST_BLITZ = "checklist_blitz"   # Most checklist items done
    DOCUMENT_DASH = "document_dash"       # Most documents uploaded
    CONTACT_COLLECTOR = "contact_collector"  # Most contacts added


class ChallengeStatus(str, enum.Enum):
    PENDING = "pending"       # Waiting for opponent to accept
    ACTIVE = "active"         # Challenge in progress
    COMPLETED = "completed"   # Challenge finished, winner determined
    CANCELLED = "cancelled"   # Cancelled by creator or expired
    DECLINED = "declined"     # Opponent declined


class ChallengeDuration(str, enum.Enum):
    THREE_DAYS = "3_days"
    ONE_WEEK = "1_week"
    TWO_WEEKS = "2_weeks"
    ONE_MONTH = "1_month"


class Challenge(Base):
    """
    Head-to-head or group challenge between businesses.
    Privacy-safe: only tracks counts, never content.
    """
    __tablename__ = "challenges"

    id = Column(Integer, primary_key=True, index=True)

    # Challenge identity
    name = Column(String(255), nullable=False)  # "Weekend Warrior Showdown"
    description = Column(Text, nullable=True)
    challenge_type = Column(String(50), nullable=False)  # ChallengeType

    # Invite system
    invite_code = Column(String(20), unique=True, nullable=False, index=True)
    is_public = Column(Boolean, default=False)  # Show on public challenge board

    # Timing
    duration = Column(String(20), nullable=False)  # ChallengeDuration
    status = Column(String(20), default=ChallengeStatus.PENDING.value)
    starts_at = Column(DateTime, nullable=True)  # When challenge begins
    ends_at = Column(DateTime, nullable=True)    # When challenge ends

    # Target (optional - if set, first to reach wins)
    target_count = Column(Integer, nullable=True)  # e.g., "First to 10 tasks"

    # Stakes - XP wager
    xp_wager = Column(Integer, default=0)         # XP each participant bets
    winner_bonus_xp = Column(Integer, default=100)  # Base bonus for winner

    # Handicap system (percentage boost for underdog)
    handicap_enabled = Column(Boolean, default=True)

    # Creator
    created_by_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)

    # Winner (set when challenge completes)
    winner_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True)

    # Stats
    participant_count = Column(Integer, default=2)  # For group challenges
    max_participants = Column(Integer, default=2)   # 2 = head-to-head

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    creator = relationship("Business", foreign_keys=[created_by_id], backref="created_challenges")
    winner = relationship("Business", foreign_keys=[winner_id], backref="won_challenges")
    participants = relationship("ChallengeParticipant", back_populates="challenge", cascade="all, delete-orphan")


class ChallengeParticipant(Base):
    """
    Tracks each participant's progress in a challenge.
    """
    __tablename__ = "challenge_participants"

    id = Column(Integer, primary_key=True, index=True)

    # Links
    challenge_id = Column(Integer, ForeignKey("challenges.id", ondelete="CASCADE"), nullable=False)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)

    # Participation status
    is_creator = Column(Boolean, default=False)
    has_accepted = Column(Boolean, default=False)  # Must accept to participate
    accepted_at = Column(DateTime, nullable=True)
    declined_at = Column(DateTime, nullable=True)

    # Progress tracking
    starting_count = Column(Integer, default=0)    # Value at challenge start (for delta calculation)
    current_count = Column(Integer, default=0)     # Current value
    progress = Column(Integer, default=0)          # current - starting (the actual progress)

    # Handicap (percentage - e.g., 10 = 10% boost to score)
    handicap_percent = Column(Integer, default=0)
    adjusted_progress = Column(Integer, default=0)  # progress * (1 + handicap_percent/100)

    # XP wagered by this participant
    xp_wagered = Column(Integer, default=0)

    # Result
    final_rank = Column(Integer, nullable=True)    # 1st, 2nd, etc.
    xp_won = Column(Integer, default=0)            # XP won from challenge
    xp_lost = Column(Integer, default=0)           # XP lost from wager

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    challenge = relationship("Challenge", back_populates="participants")
    business = relationship("Business", backref="challenge_participations")

    # Unique constraint: one participation per business per challenge
    __table_args__ = (
        Index('ix_challenge_participant', 'challenge_id', 'business_id', unique=True),
    )


class SubscriptionHistory(Base):
    """Track subscription changes for billing history"""
    __tablename__ = "subscription_history"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)

    event_type = Column(String(50), nullable=False)  # created, updated, canceled, renewed
    tier = Column(String(50), nullable=False)
    amount_cents = Column(Integer, nullable=True)
    stripe_invoice_id = Column(String(255), nullable=True)
    stripe_payment_intent_id = Column(String(255), nullable=True)

    event_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship("Organization", back_populates="subscription_history")


class OAuthConnection(Base):
    """Store OAuth connections for social posting"""
    __tablename__ = "oauth_connections"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    provider = Column(String(50), nullable=False)  # twitter, facebook, instagram, linkedin
    provider_user_id = Column(String(255), nullable=True)
    provider_username = Column(String(255), nullable=True)

    access_token = Column(Text, nullable=False)  # Encrypted
    refresh_token = Column(Text, nullable=True)  # Encrypted
    token_expires_at = Column(DateTime, nullable=True)

    scopes = Column(Text, nullable=True)  # Comma-separated scopes
    is_active = Column(Boolean, default=True)

    # For pages/business accounts (FB, IG, LinkedIn)
    page_id = Column(String(255), nullable=True)
    page_name = Column(String(255), nullable=True)
    page_access_token = Column(Text, nullable=True)  # Encrypted

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AccountingConnection(Base):
    """Store OAuth connections for accounting software integrations"""
    __tablename__ = "accounting_connections"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    provider = Column(String(50), nullable=False)  # quickbooks, xero, freshbooks, zoho
    company_id = Column(String(255), nullable=True)  # Provider's company/org ID
    company_name = Column(String(255), nullable=True)

    access_token = Column(Text, nullable=False)  # Encrypted
    refresh_token = Column(Text, nullable=True)  # Encrypted
    token_expires_at = Column(DateTime, nullable=True)

    scopes = Column(Text, nullable=True)  # Comma-separated scopes
    extra_data = Column(Text, nullable=True)  # JSON for provider-specific data
    is_active = Column(Boolean, default=True)

    last_sync_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ZoomConnection(Base):
    """Store OAuth connections for Zoom meeting integrations"""
    __tablename__ = "zoom_connections"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    zoom_user_id = Column(String(255), nullable=False)
    zoom_email = Column(String(255), nullable=True)
    zoom_name = Column(String(255), nullable=True)

    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=True)
    token_expires_at = Column(DateTime, nullable=True)

    scopes = Column(Text, nullable=True)  # Comma-separated scopes
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class GoogleMeetConnection(Base):
    """Store OAuth connections for Google Meet/Calendar integrations"""
    __tablename__ = "google_meet_connections"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    google_user_id = Column(String(255), nullable=False)
    google_email = Column(String(255), nullable=True)
    google_name = Column(String(255), nullable=True)

    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=True)
    token_expires_at = Column(DateTime, nullable=True)

    scopes = Column(Text, nullable=True)  # Comma-separated scopes
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TeamsConnection(Base):
    """Store OAuth connections for Microsoft Teams integrations"""
    __tablename__ = "teams_connections"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    microsoft_user_id = Column(String(255), nullable=False)
    microsoft_email = Column(String(255), nullable=True)
    microsoft_name = Column(String(255), nullable=True)
    tenant_id = Column(String(255), nullable=True)

    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=True)
    token_expires_at = Column(DateTime, nullable=True)

    scopes = Column(Text, nullable=True)  # Comma-separated scopes
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============ BRANDING MODELS ============

class BrandColor(Base):
    """Brand color palette"""
    __tablename__ = "brand_colors"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=True)

    name = Column(String(100), nullable=True)  # e.g., "Ocean Blue", "Sunset Orange"
    hex_value = Column(String(9), nullable=False)  # #RRGGBB or #RRGGBBAA
    rgb_value = Column(String(20), nullable=True)  # "255, 128, 0"
    hsl_value = Column(String(20), nullable=True)  # "30, 100%, 50%"
    color_type = Column(String(50), default=ColorType.CUSTOM.value)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class BrandFont(Base):
    """Brand typography"""
    __tablename__ = "brand_fonts"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=True)

    name = Column(String(100), nullable=False)  # e.g., "Inter", "Playfair Display"
    font_family = Column(String(255), nullable=False)  # CSS font-family value
    font_url = Column(String(500), nullable=True)  # Google Fonts or custom URL
    font_weight = Column(String(50), nullable=True)  # "400", "400,500,700"
    usage_type = Column(String(50), default=FontUsage.BODY.value)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class BrandAsset(Base):
    """Brand assets (logos, icons, patterns)"""
    __tablename__ = "brand_assets"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=True)

    name = Column(String(255), nullable=False)
    asset_type = Column(String(50), default=BrandAssetType.OTHER.value)
    file_path = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=True)  # Original filename
    file_size = Column(Integer, nullable=True)  # bytes
    mime_type = Column(String(100), nullable=True)

    # Image dimensions
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)

    # For dark/light variants
    background_type = Column(String(20), nullable=True)  # "dark", "light", "transparent"

    description = Column(Text, nullable=True)
    tags = Column(String(500), nullable=True)  # Comma-separated tags
    is_primary = Column(Boolean, default=False)  # Primary asset for this type
    sort_order = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class BrandGuideline(Base):
    """Brand guidelines and voice"""
    __tablename__ = "brand_guidelines"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=True)

    # Company identity
    company_name = Column(String(255), nullable=True)
    tagline = Column(String(500), nullable=True)
    mission_statement = Column(Text, nullable=True)

    # Brand voice
    voice_tone = Column(String(100), nullable=True)  # "Professional", "Casual", "Friendly"
    voice_description = Column(Text, nullable=True)

    # Usage guidelines
    logo_min_size = Column(String(50), nullable=True)  # e.g., "32px"
    logo_clear_space = Column(String(50), nullable=True)  # e.g., "10% of width"
    color_usage_notes = Column(Text, nullable=True)
    typography_notes = Column(Text, nullable=True)
    dos_and_donts = Column(Text, nullable=True)  # JSON array

    order_index = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============ MARKETING MODELS ============

class EmailTemplate(Base):
    """Email templates for marketing"""
    __tablename__ = "email_templates"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(255), nullable=False)
    template_type = Column(String(50), default=EmailTemplateType.CUSTOM.value)

    # Template content
    subject_line = Column(String(500), nullable=True)
    preview_text = Column(String(255), nullable=True)
    html_content = Column(Text, nullable=True)
    json_content = Column(JSON, nullable=True)  # For structured builder

    # Source
    source = Column(String(50), default="custom")  # custom, mailchimp, uploaded
    external_id = Column(String(255), nullable=True)  # Mailchimp template ID

    thumbnail_path = Column(String(500), nullable=True)
    is_default = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MarketingCampaign(Base):
    """Marketing campaigns"""
    __tablename__ = "marketing_campaigns"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    title = Column(String(255), nullable=False)
    core_message = Column(Text, nullable=True)
    status = Column(String(50), default=CampaignStatus.DRAFT.value)

    # Channels
    include_email = Column(Boolean, default=False)
    include_twitter = Column(Boolean, default=False)
    include_linkedin = Column(Boolean, default=False)
    include_facebook = Column(Boolean, default=False)
    include_instagram = Column(Boolean, default=False)

    # Email settings
    email_template_id = Column(Integer, ForeignKey("email_templates.id"), nullable=True)
    email_subject = Column(String(500), nullable=True)
    mailchimp_campaign_id = Column(String(255), nullable=True)

    # Scheduling
    scheduled_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    created_by = relationship("User", backref="created_campaigns")
    email_template = relationship("EmailTemplate")
    versions = relationship("CampaignVersion", back_populates="campaign", cascade="all, delete-orphan")


class CampaignVersion(Base):
    """Platform-specific content for campaigns"""
    __tablename__ = "campaign_versions"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("marketing_campaigns.id", ondelete="CASCADE"), nullable=False)

    platform = Column(String(50), nullable=False)  # email, twitter, linkedin, facebook, instagram
    content = Column(Text, nullable=False)
    character_count = Column(Integer, nullable=True)

    # For email
    html_content = Column(Text, nullable=True)

    # For social with images
    image_path = Column(String(500), nullable=True)

    # Posting status
    posted_at = Column(DateTime, nullable=True)
    post_id = Column(String(255), nullable=True)  # External post ID
    post_url = Column(String(500), nullable=True)
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign = relationship("MarketingCampaign", back_populates="versions")


class EmailAnalytics(Base):
    """Email campaign analytics from Mailchimp"""
    __tablename__ = "email_analytics"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    campaign_id = Column(Integer, ForeignKey("marketing_campaigns.id", ondelete="CASCADE"), nullable=True)

    mailchimp_campaign_id = Column(String(255), nullable=False)

    # Metrics
    emails_sent = Column(Integer, default=0)
    emails_delivered = Column(Integer, default=0)
    opens = Column(Integer, default=0)
    unique_opens = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    unique_clicks = Column(Integer, default=0)
    unsubscribes = Column(Integer, default=0)
    bounces = Column(Integer, default=0)

    # Rates (stored as percentages)
    open_rate = Column(Float, nullable=True)
    click_rate = Column(Float, nullable=True)
    unsubscribe_rate = Column(Float, nullable=True)
    bounce_rate = Column(Float, nullable=True)

    # Top links
    top_links = Column(JSON, nullable=True)  # [{url, clicks, unique_clicks}]

    fetched_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    campaign = relationship("MarketingCampaign", backref="email_analytics")


class SocialAnalytics(Base):
    """Social media post analytics"""
    __tablename__ = "social_analytics"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=True)
    campaign_version_id = Column(Integer, ForeignKey("campaign_versions.id", ondelete="CASCADE"), nullable=True)

    platform = Column(String(50), nullable=False)
    post_id = Column(String(255), nullable=False)

    # Common metrics
    impressions = Column(Integer, default=0)
    reach = Column(Integer, default=0)
    engagements = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    clicks = Column(Integer, default=0)

    # Platform-specific stored as JSON
    platform_metrics = Column(JSON, nullable=True)

    fetched_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    campaign_version = relationship("CampaignVersion", backref="social_analytics")


# ============ EMAIL INTEGRATION ============

class EmailIntegration(Base):
    """Email service provider integrations"""
    __tablename__ = "email_integrations"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, unique=True)

    provider = Column(String(50), nullable=False)  # mailchimp, sendgrid, brevo
    api_key_encrypted = Column(Text, nullable=False)
    server_prefix = Column(String(20), nullable=True)  # For Mailchimp

    # Default audience/list
    default_list_id = Column(String(255), nullable=True)
    default_list_name = Column(String(255), nullable=True)

    is_active = Column(Boolean, default=True)
    last_synced_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============ DOCUMENT TEMPLATES ============

class DocumentTemplate(Base):
    """Pre-built document templates and user-rendered documents"""
    __tablename__ = "document_templates"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), default=DocumentTemplateCategory.OTHER.value)

    # Template source (for system templates)
    template_id = Column(String(100), nullable=True)  # Reference to built-in template

    # Template file (for file-based templates)
    file_path = Column(String(500), nullable=True)
    file_format = Column(String(20), nullable=True)  # docx, pdf, html

    # Rendered content (for text-based templates)
    content = Column(Text, nullable=True)

    # Customization
    variables = Column(JSON, nullable=True)  # [{name, label, type, default}]

    # Metadata
    is_system = Column(Boolean, default=False)  # System templates vs user-rendered
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)  # NULL = global

    preview_image = Column(String(500), nullable=True)
    download_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============ EXISTING ENUMS (unchanged) ============

class ServiceCategory(str, enum.Enum):
    BANKING = "banking"
    LEGAL = "legal"
    TAX = "tax"
    ACCOUNTING = "accounting"
    GOVERNMENT = "government"
    INSURANCE = "insurance"
    VENDORS = "vendors"
    TOOLS = "tools"
    OTHER = "other"


class DocumentCategory(str, enum.Enum):
    FORMATION = "formation"
    CONTRACTS = "contracts"
    TAX = "tax"
    INSURANCE = "insurance"
    LICENSES = "licenses"
    AGREEMENTS = "agreements"
    FINANCIAL = "financial"
    OTHER = "other"


class ContactType(str, enum.Enum):
    LAWYER = "lawyer"
    ACCOUNTANT = "accountant"
    BANKER = "banker"
    INVESTOR = "investor"
    VENDOR = "vendor"
    REGISTERED_AGENT = "registered_agent"
    ADVISOR = "advisor"
    ENGINEER = "engineer"
    SCIENTIST = "scientist"
    DESIGNER = "designer"
    MARKETER = "marketer"
    DEVELOPER = "developer"
    CONSULTANT = "consultant"
    CONTRACTOR = "contractor"
    RECRUITER = "recruiter"
    EXECUTIVE = "executive"
    OTHER = "other"


class DeadlineType(str, enum.Enum):
    FILING = "filing"
    RENEWAL = "renewal"
    PAYMENT = "payment"
    REPORT = "report"
    MEETING = "meeting"
    OTHER = "other"


class ProductOfferedCategory(str, enum.Enum):
    SOFTWARE = "software"
    SAAS = "saas"
    HARDWARE = "hardware"
    CONSULTING = "consulting"
    SERVICE = "service"
    SUBSCRIPTION = "subscription"
    LICENSE = "license"
    OTHER = "other"


class ProductUsedCategory(str, enum.Enum):
    DEVELOPMENT = "development"
    INFRASTRUCTURE = "infrastructure"
    PRODUCTIVITY = "productivity"
    COMMUNICATION = "communication"
    MARKETING = "marketing"
    FINANCE = "finance"
    HR = "hr"
    ANALYTICS = "analytics"
    SECURITY = "security"
    DESIGN = "design"
    OTHER = "other"


class WebLinkCategory(str, enum.Enum):
    BUSINESS = "business"
    GOVERNMENT = "government"
    FINANCIAL = "financial"
    LEGAL = "legal"
    RESEARCH = "research"
    NEWS = "news"
    TOOLS = "tools"
    REFERENCE = "reference"
    OTHER = "other"


class MarketplaceCategory(str, enum.Enum):
    ECOMMERCE = "ecommerce"        # Amazon, eBay, Etsy
    SOFTWARE = "software"          # Capterra, G2, GetApp
    APPSTORE = "appstore"          # App Store, Google Play
    B2B = "b2b"                    # Alibaba, ThomasNet
    FREELANCE = "freelance"        # Upwork, Fiverr
    SOCIAL = "social"             # Facebook Marketplace, Instagram Shop
    OTHER = "other"


class Marketplace(Base):
    """Marketplaces where you sell products/services (Amazon, eBay, Capterra, G2, etc.)"""
    __tablename__ = "marketplaces"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True)

    name = Column(String(255), nullable=False)  # "Amazon", "Capterra"
    category = Column(String(50), default=MarketplaceCategory.OTHER.value)
    url = Column(String(500), nullable=True)                    # Main marketplace URL
    store_url = Column(String(500), nullable=True)              # Your store/listing URL

    account_id = Column(String(255), nullable=True)             # Seller ID, username
    status = Column(String(50), default="active")               # active, pending, suspended

    commission_rate = Column(String(50), nullable=True)         # "15%", "$0.99/sale"
    monthly_fee = Column(String(50), nullable=True)             # "$39.99/mo"

    icon = Column(String(100), nullable=True)                   # Emoji or icon
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True)  # Optional business assignment
    name = Column(String(255), nullable=False)
    url = Column(String(500), nullable=False)
    category = Column(String(50), default=ServiceCategory.OTHER.value)
    description = Column(Text, nullable=True)
    username_hint = Column(String(255), nullable=True)  # Not the actual username, just a hint
    notes = Column(Text, nullable=True)
    icon = Column(String(100), nullable=True)  # emoji or icon name
    is_favorite = Column(Boolean, default=False)
    last_visited = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    category = Column(String(50), default=DocumentCategory.OTHER.value)
    file_path = Column(String(500), nullable=True)  # Local file path
    external_url = Column(String(500), nullable=True)  # Google Drive, Dropbox link
    description = Column(Text, nullable=True)
    expiration_date = Column(DateTime, nullable=True)
    tags = Column(String(500), nullable=True)  # Comma-separated tags
    is_sensitive = Column(Boolean, default=False)  # Requires password to download
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    title = Column(String(255), nullable=True)  # Job title
    company = Column(String(255), nullable=True)
    contact_type = Column(String(50), default=ContactType.OTHER.value)
    email = Column(String(255), nullable=True)
    secondary_email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    mobile_phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    timezone = Column(String(50), nullable=True)
    website = Column(String(500), nullable=True)
    linkedin_url = Column(String(500), nullable=True)
    twitter_handle = Column(String(100), nullable=True)
    birthday = Column(Date, nullable=True)
    additional_emails = Column(Text, nullable=True)  # JSON array of strings
    additional_phones = Column(Text, nullable=True)  # JSON array of strings
    tags = Column(Text, nullable=True)  # Comma-separated tags
    responsibilities = Column(Text, nullable=True)  # What this contact handles for you
    notes = Column(Text, nullable=True)
    last_contacted = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Meeting(Base):
    """Meeting notes and records"""
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    meeting_date = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, nullable=True)  # Duration in minutes
    location = Column(String(500), nullable=True)  # Physical location or video link
    meeting_type = Column(String(50), default="general")  # general, board, team, client, investor, etc.
    attendees = Column(Text, nullable=True)  # JSON array of attendee names/emails
    agenda = Column(Text, nullable=True)  # Meeting agenda
    minutes = Column(Text, nullable=True)  # Meeting minutes/notes
    decisions = Column(Text, nullable=True)  # Key decisions made
    action_items = Column(Text, nullable=True)  # JSON array of action items
    audio_file_url = Column(String(500), nullable=True)  # Link to audio recording
    document_ids = Column(Text, nullable=True)  # JSON array of linked document IDs
    tags = Column(Text, nullable=True)  # Comma-separated tags
    is_recurring = Column(Boolean, default=False)
    recurrence_pattern = Column(String(100), nullable=True)  # weekly, monthly, etc.
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Deadline(Base):
    __tablename__ = "deadlines"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    deadline_type = Column(String(50), default=DeadlineType.OTHER.value)
    due_date = Column(DateTime, nullable=False)
    reminder_days = Column(Integer, default=7)  # Days before to remind
    is_recurring = Column(Boolean, default=False)
    recurrence_months = Column(Integer, nullable=True)  # Recur every N months
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    related_service_id = Column(Integer, ForeignKey("services.id"), nullable=True)
    related_document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    related_service = relationship("Service", backref="deadlines")
    related_document = relationship("Document", backref="deadlines")


class BusinessInfo(Base):
    """Core business information"""
    __tablename__ = "business_info"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, unique=True)
    legal_name = Column(String(255), nullable=True)
    dba_name = Column(String(255), nullable=True)  # Doing Business As
    entity_type = Column(String(50), nullable=True)  # LLC, C-Corp, S-Corp, etc.
    formation_state = Column(String(50), nullable=True)
    formation_date = Column(DateTime, nullable=True)
    fiscal_year_end = Column(String(20), nullable=True)  # e.g., "December"
    industry = Column(String(100), nullable=True)
    website = Column(String(500), nullable=True)
    address_line1 = Column(String(255), nullable=True)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(50), nullable=True)
    zip_code = Column(String(20), nullable=True)
    country = Column(String(50), default="United States")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class BusinessIdentifier(Base):
    """Sensitive business identifiers (EIN, D-U-N-S, state IDs, etc.)"""
    __tablename__ = "business_identifiers"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True)
    identifier_type = Column(String(50), nullable=False)  # ein, duns, state_id, etc.
    label = Column(String(100), nullable=False)  # Display name
    value = Column(String(255), nullable=False)  # The actual number/ID
    issuing_authority = Column(String(100), nullable=True)  # IRS, State of Delaware, etc.
    issue_date = Column(DateTime, nullable=True)
    expiration_date = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    related_document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    related_document = relationship("Document")


class ChecklistProgress(Base):
    """Tracks progress on getting started checklist items"""
    __tablename__ = "checklist_progress"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True)
    item_id = Column(String(100), nullable=False, index=True)  # matches frontend item IDs
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)  # User notes about this item
    data = Column(Text, nullable=True)  # JSON string for structured data (e.g., selected options)
    related_document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    related_identifier_id = Column(Integer, ForeignKey("business_identifiers.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    related_document = relationship("Document")
    related_identifier = relationship("BusinessIdentifier")

    # Unique constraint: one checklist item per organization
    __table_args__ = (UniqueConstraint('organization_id', 'item_id', name='uq_checklist_org_item'),)


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"


class User(Base):
    """User authentication"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)  # Nullable for OAuth-only users
    name = Column(String(255), nullable=True)
    role = Column(String(50), default=UserRole.VIEWER.value)
    is_active = Column(Boolean, default=True)
    calendar_token = Column(String(64), unique=True, nullable=True, index=True)  # For iCal feed auth

    # Multi-tenancy
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    is_org_owner = Column(Boolean, default=False)  # Organization owner/creator

    # Current business context (which business user is viewing)
    current_business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True)

    # User preferences
    gamification_enabled = Column(Boolean, default=True)  # Personal gamification toggle

    # OAuth fields
    oauth_provider = Column(String(50), nullable=True)  # google, github
    oauth_provider_id = Column(String(255), nullable=True)  # Provider's user ID
    avatar_url = Column(String(500), nullable=True)

    # Email verification
    email_verified = Column(Boolean, default=False)
    email_verification_token = Column(String(255), nullable=True)
    email_verified_at = Column(DateTime, nullable=True)

    # Stripe
    stripe_customer_id = Column(String(255), nullable=True)

    # MFA (Two-Factor Authentication)
    mfa_enabled = Column(Boolean, default=False)
    mfa_secret = Column(String(255), nullable=True)  # Encrypted TOTP secret
    mfa_backup_codes = Column(Text, nullable=True)  # JSON array of hashed backup codes

    # Onboarding
    has_completed_onboarding = Column(Boolean, default=False)

    # Account Lockout (security hardening)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)

    # Password Reset
    password_reset_token = Column(String(255), nullable=True)
    password_reset_token_expires = Column(DateTime, nullable=True)

    # Email verification token expiry
    email_verification_token_expires = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="users")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")


class UserSession(Base):
    """Track active user sessions for session management"""
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Token identification (jti from JWT)
    token_id = Column(String(32), unique=True, nullable=False, index=True)

    # Session metadata
    device_info = Column(String(500), nullable=True)
    ip_address = Column(String(45), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)

    # Status
    is_revoked = Column(Boolean, default=False)
    revoked_at = Column(DateTime, nullable=True)
    revoked_reason = Column(String(100), nullable=True)

    # Relationships
    user = relationship("User", back_populates="sessions")


class TokenBlacklist(Base):
    """Blacklist for revoked JWT tokens"""
    __tablename__ = "token_blacklist"

    id = Column(Integer, primary_key=True, index=True)
    token_id = Column(String(32), unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, default=datetime.utcnow)
    reason = Column(String(100), nullable=True)


class VaultConfig(Base):
    """Vault master password configuration"""
    __tablename__ = "vault_config"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, unique=True)
    master_password_hash = Column(String(255), nullable=False)  # bcrypt hash
    salt = Column(String(255), nullable=False)  # For key derivation
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Credential(Base):
    """Encrypted credential storage"""
    __tablename__ = "credentials"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)  # Display name (not encrypted)
    service_url = Column(String(500), nullable=True)  # URL (not encrypted)
    category = Column(String(50), default="other")  # banking, tax, legal, etc.
    icon = Column(String(100), nullable=True)  # emoji or icon

    # Encrypted fields (stored as base64)
    encrypted_username = Column(Text, nullable=True)
    encrypted_password = Column(Text, nullable=True)
    encrypted_notes = Column(Text, nullable=True)
    encrypted_totp_secret = Column(Text, nullable=True)  # For 2FA
    encrypted_purpose = Column(Text, nullable=True)  # Purpose/description of this credential
    encrypted_custom_fields = Column(Text, nullable=True)  # JSON array of custom fields

    related_service_id = Column(Integer, ForeignKey("services.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    related_service = relationship("Service")


class ProductOffered(Base):
    """Products and services that the business offers/sells"""
    __tablename__ = "products_offered"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), default=ProductOfferedCategory.OTHER.value)
    pricing_model = Column(String(50), nullable=True)  # one-time, subscription, hourly, etc.
    price = Column(String(100), nullable=True)  # Price description (e.g., "$99/mo", "Contact us")
    url = Column(String(500), nullable=True)  # Product page URL
    icon = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ProductUsed(Base):
    """Tools and services that the business uses"""
    __tablename__ = "products_used"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    vendor = Column(String(255), nullable=True)  # Company that provides it
    category = Column(String(50), default=ProductUsedCategory.OTHER.value)
    is_paid = Column(Boolean, default=False)
    monthly_cost = Column(String(100), nullable=True)  # e.g., "$50/mo" or "Free tier"
    billing_cycle = Column(String(50), nullable=True)  # monthly, annually, etc.
    url = Column(String(500), nullable=True)
    icon = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    renewal_date = Column(DateTime, nullable=True)
    # New detailed fields
    description = Column(Text, nullable=True)  # What the product is
    use_case = Column(Text, nullable=True)  # How we use it in our business
    features = Column(Text, nullable=True)  # Key features we use (comma-separated)
    integrations = Column(Text, nullable=True)  # What it integrates with
    login_url = Column(String(500), nullable=True)  # Direct login URL
    account_email = Column(String(255), nullable=True)  # Email used for this account
    license_type = Column(String(100), nullable=True)  # free, starter, pro, enterprise
    status = Column(String(50), default="active")  # active, trial, cancelled, considering
    contract_end_date = Column(DateTime, nullable=True)  # When contract ends
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WebLink(Base):
    """Important web links and bookmarks"""
    __tablename__ = "web_links"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    url = Column(String(500), nullable=False)
    category = Column(String(50), default=WebLinkCategory.OTHER.value)
    description = Column(Text, nullable=True)
    icon = Column(String(100), nullable=True)
    is_favorite = Column(Boolean, default=False)
    last_visited = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============ Task Management Models ============

class TaskStatus(str, enum.Enum):
    BACKLOG = "backlog"
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    DONE = "done"


class TaskPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class ActivityType(str, enum.Enum):
    CREATED = "created"
    UPDATED = "updated"
    STATUS_CHANGED = "status_changed"
    ASSIGNED = "assigned"
    COMMENTED = "commented"
    TIME_LOGGED = "time_logged"
    COMPLETED = "completed"
    REOPENED = "reopened"


class TaskBoard(Base):
    """Kanban board configuration"""
    __tablename__ = "task_boards"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False)
    icon = Column(String(100), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    created_by = relationship("User", backref="created_boards")
    columns = relationship("TaskColumn", back_populates="board", order_by="TaskColumn.position", cascade="all, delete-orphan")


class TaskColumn(Base):
    """Kanban column configuration"""
    __tablename__ = "task_columns"

    id = Column(Integer, primary_key=True, index=True)
    board_id = Column(Integer, ForeignKey("task_boards.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    status = Column(String(50), default=TaskStatus.TODO.value)
    position = Column(Integer, default=0)
    color = Column(String(20), nullable=True)
    wip_limit = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    board = relationship("TaskBoard", back_populates="columns")
    tasks = relationship("Task", back_populates="column", order_by="Task.position")


class Task(Base):
    """Core task entity"""
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Business assignment (can override board's business)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True)

    # Status & Organization
    board_id = Column(Integer, ForeignKey("task_boards.id", ondelete="CASCADE"), nullable=False)
    column_id = Column(Integer, ForeignKey("task_columns.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(50), default=TaskStatus.TODO.value)
    priority = Column(String(20), default=TaskPriority.MEDIUM.value)
    position = Column(Integer, default=0)

    # Dates
    due_date = Column(DateTime, nullable=True)
    reminder_days = Column(Integer, default=1)
    start_date = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Time tracking
    estimated_minutes = Column(Integer, nullable=True)

    # Relationships to Users
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Integration relationships
    related_deadline_id = Column(Integer, ForeignKey("deadlines.id"), nullable=True)
    related_contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)

    # Metadata
    tags = Column(String(500), nullable=True)
    icon = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    board = relationship("TaskBoard", backref="tasks")
    column = relationship("TaskColumn", back_populates="tasks")
    created_by = relationship("User", foreign_keys=[created_by_id], backref="created_tasks")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id], backref="assigned_tasks")
    related_deadline = relationship("Deadline", backref="tasks")
    related_contact = relationship("Contact", backref="tasks")
    comments = relationship("TaskComment", back_populates="task", cascade="all, delete-orphan")
    time_entries = relationship("TimeEntry", back_populates="task", cascade="all, delete-orphan")
    activities = relationship("TaskActivity", back_populates="task", cascade="all, delete-orphan")


class TaskComment(Base):
    """Comments on tasks"""
    __tablename__ = "task_comments"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    is_edited = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    task = relationship("Task", back_populates="comments")
    user = relationship("User", backref="task_comments")


class TimeEntry(Base):
    """Time tracking entries"""
    __tablename__ = "time_entries"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Time tracking
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, nullable=True)

    description = Column(String(500), nullable=True)
    is_running = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    task = relationship("Task", back_populates="time_entries")
    user = relationship("User", backref="time_entries")


class TaskActivity(Base):
    """Activity log for tasks"""
    __tablename__ = "task_activities"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    activity_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    old_value = Column(String(255), nullable=True)
    new_value = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("Task", back_populates="activities")
    user = relationship("User", backref="task_activities")


class WebPresence(Base):
    """Web presence tracking - domain, email, website, social media"""
    __tablename__ = "web_presence"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, unique=True)

    # Domain
    domain_name = Column(String(255), nullable=True)
    domain_registrar = Column(String(100), nullable=True)
    domain_expiration = Column(DateTime, nullable=True)
    domain_privacy = Column(Boolean, default=False)
    domain_auto_renew = Column(Boolean, default=False)

    # Professional Email (primary)
    email_provider = Column(String(100), nullable=True)  # Google Workspace, Microsoft 365, etc.
    email_domain = Column(String(255), nullable=True)  # yourcompany.com
    email_admin = Column(String(255), nullable=True)  # admin@yourcompany.com

    # Additional emails - JSON array: [{provider, domain, email, notes}]
    additional_emails = Column(Text, nullable=True)

    # Website (primary)
    website_url = Column(String(500), nullable=True)
    website_platform = Column(String(100), nullable=True)  # Webflow, WordPress, etc.
    website_hosting = Column(String(100), nullable=True)  # Vercel, Netlify, AWS, etc.
    ssl_enabled = Column(Boolean, default=False)

    # Additional websites - JSON array: [{url, name, platform, hosting, ssl_enabled}]
    additional_websites = Column(Text, nullable=True)

    # Social Media (legacy fields kept for backwards compatibility)
    linkedin_url = Column(String(500), nullable=True)
    twitter_url = Column(String(500), nullable=True)
    instagram_url = Column(String(500), nullable=True)
    facebook_url = Column(String(500), nullable=True)
    youtube_url = Column(String(500), nullable=True)
    github_url = Column(String(500), nullable=True)
    tiktok_url = Column(String(500), nullable=True)

    # Additional/custom social media - JSON array: [{platform, url, handle}]
    additional_socials = Column(Text, nullable=True)

    # Business Listings
    google_business_url = Column(String(500), nullable=True)
    google_business_verified = Column(Boolean, default=False)
    apple_business_url = Column(String(500), nullable=True)
    apple_business_verified = Column(Boolean, default=False)
    bing_places_url = Column(String(500), nullable=True)
    bing_places_verified = Column(Boolean, default=False)
    yelp_url = Column(String(500), nullable=True)
    yelp_claimed = Column(Boolean, default=False)
    bbb_url = Column(String(500), nullable=True)
    bbb_accredited = Column(Boolean, default=False)

    # Additional business listings - JSON array: [{platform, url, verified, handle}]
    additional_listings = Column(Text, nullable=True)

    # Additional notes
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class BankAccountType(str, enum.Enum):
    CHECKING = "checking"
    SAVINGS = "savings"
    MONEY_MARKET = "money_market"
    CD = "cd"
    BUSINESS = "business"
    OTHER = "other"


class BankAccount(Base):
    """Bank and financial accounts"""
    __tablename__ = "bank_accounts"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True)
    account_type = Column(String(50), nullable=False)  # checking, savings, coinbase, paypal, stripe, etc.
    institution_name = Column(String(255), nullable=False)
    account_name = Column(String(255), nullable=True)  # Nickname for the account
    account_number_last4 = Column(String(4), nullable=True)  # Last 4 digits only
    routing_number = Column(String(9), nullable=True)  # For bank accounts
    account_holder = Column(String(255), nullable=True)
    is_primary = Column(Boolean, default=False)
    url = Column(String(500), nullable=True)
    icon = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MetricType(str, enum.Enum):
    MRR = "mrr"  # Monthly Recurring Revenue
    ARR = "arr"  # Annual Recurring Revenue
    REVENUE = "revenue"  # Total revenue (one-time + recurring)
    CUSTOMERS = "customers"  # Total customers
    USERS = "users"  # Total users (if different from customers)
    BURN_RATE = "burn_rate"  # Monthly burn rate
    RUNWAY = "runway"  # Months of runway
    CASH = "cash"  # Cash on hand
    CAC = "cac"  # Customer Acquisition Cost
    LTV = "ltv"  # Lifetime Value
    CHURN = "churn"  # Churn rate (%)
    NPS = "nps"  # Net Promoter Score
    CUSTOM = "custom"  # Custom metric


class Metric(Base):
    """Business metrics tracking over time"""
    __tablename__ = "metrics"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True)
    metric_type = Column(String(50), nullable=False)
    name = Column(String(100), nullable=False)  # Display name
    value = Column(String(100), nullable=False)  # Stored as string to handle various formats
    unit = Column(String(20), nullable=True)  # $, %, months, etc.
    date = Column(DateTime, nullable=False)  # Date this metric applies to
    notes = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    created_by = relationship("User", backref="metrics")


class MetricGoal(Base):
    """Goals/targets for metrics"""
    __tablename__ = "metric_goals"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True)
    metric_type = Column(String(50), nullable=False)
    name = Column(String(100), nullable=True)
    target_value = Column(Float, nullable=False)
    target_date = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    is_achieved = Column(Boolean, default=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    created_by = relationship("User", backref="metric_goals")


class ContactSubmission(Base):
    """Public contact form submissions"""
    __tablename__ = "contact_submissions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    company = Column(String(255), nullable=True)
    subject = Column(String(100), nullable=True)
    message = Column(Text, nullable=False)
    source = Column(String(100), nullable=True)  # e.g., 'contact_page', 'pricing', etc.
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    is_read = Column(Boolean, default=False)
    is_replied = Column(Boolean, default=False)
    replied_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ============ BUSINESS JUNCTION TABLES (Many-to-Many) ============

class ContactBusiness(Base):
    """Junction table for Contact to Business many-to-many relationship"""
    __tablename__ = "contact_businesses"

    id = Column(Integer, primary_key=True, index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    contact = relationship("Contact", backref="business_associations")
    business = relationship("Business", backref="contact_associations")

    __table_args__ = (UniqueConstraint('contact_id', 'business_id', name='uq_contact_business'),)


class DocumentBusiness(Base):
    """Junction table for Document to Business many-to-many relationship"""
    __tablename__ = "document_businesses"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", backref="business_associations")
    business = relationship("Business", backref="document_associations")

    __table_args__ = (UniqueConstraint('document_id', 'business_id', name='uq_document_business'),)


class CredentialBusiness(Base):
    """Junction table for Credential to Business many-to-many relationship"""
    __tablename__ = "credential_businesses"

    id = Column(Integer, primary_key=True, index=True)
    credential_id = Column(Integer, ForeignKey("credentials.id", ondelete="CASCADE"), nullable=False)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    credential = relationship("Credential", backref="business_associations")
    business = relationship("Business", backref="credential_associations")

    __table_args__ = (UniqueConstraint('credential_id', 'business_id', name='uq_credential_business'),)


class WebLinkBusiness(Base):
    """Junction table for WebLink to Business many-to-many relationship"""
    __tablename__ = "web_link_businesses"

    id = Column(Integer, primary_key=True, index=True)
    web_link_id = Column(Integer, ForeignKey("web_links.id", ondelete="CASCADE"), nullable=False)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    web_link = relationship("WebLink", backref="business_associations")
    business = relationship("Business", backref="web_link_associations")

    __table_args__ = (UniqueConstraint('web_link_id', 'business_id', name='uq_web_link_business'),)


class ProductOfferedBusiness(Base):
    """Junction table for ProductOffered to Business many-to-many relationship"""
    __tablename__ = "product_offered_businesses"

    id = Column(Integer, primary_key=True, index=True)
    product_offered_id = Column(Integer, ForeignKey("products_offered.id", ondelete="CASCADE"), nullable=False)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    product_offered = relationship("ProductOffered", backref="business_associations")
    business = relationship("Business", backref="product_offered_associations")

    __table_args__ = (UniqueConstraint('product_offered_id', 'business_id', name='uq_product_offered_business'),)


class ProductUsedBusiness(Base):
    """Junction table for ProductUsed to Business many-to-many relationship"""
    __tablename__ = "product_used_businesses"

    id = Column(Integer, primary_key=True, index=True)
    product_used_id = Column(Integer, ForeignKey("products_used.id", ondelete="CASCADE"), nullable=False)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    product_used = relationship("ProductUsed", backref="business_associations")
    business = relationship("Business", backref="product_used_associations")

    __table_args__ = (UniqueConstraint('product_used_id', 'business_id', name='uq_product_used_business'),)


class ServiceBusiness(Base):
    """Junction table for Service to Business many-to-many relationship"""
    __tablename__ = "service_businesses"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"), nullable=False)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    service = relationship("Service", backref="business_associations")
    business = relationship("Business", backref="service_associations")

    __table_args__ = (UniqueConstraint('service_id', 'business_id', name='uq_service_business'),)


class DeadlineBusiness(Base):
    """Junction table for Deadline to Business many-to-many relationship"""
    __tablename__ = "deadline_businesses"

    id = Column(Integer, primary_key=True, index=True)
    deadline_id = Column(Integer, ForeignKey("deadlines.id", ondelete="CASCADE"), nullable=False)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    deadline = relationship("Deadline", backref="business_associations")
    business = relationship("Business", backref="deadline_associations")

    __table_args__ = (UniqueConstraint('deadline_id', 'business_id', name='uq_deadline_business'),)


class MeetingBusiness(Base):
    """Junction table for Meeting to Business many-to-many relationship"""
    __tablename__ = "meeting_businesses"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    meeting = relationship("Meeting", backref="business_associations")
    business = relationship("Business", backref="meeting_associations")

    __table_args__ = (UniqueConstraint('meeting_id', 'business_id', name='uq_meeting_business'),)


class MeetingTranscript(Base):
    """Meeting transcripts uploaded from Zoom, Meet, Teams, etc."""
    __tablename__ = "meeting_transcripts"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True)

    # Meeting info
    title = Column(String(255), nullable=False)
    meeting_date = Column(DateTime, nullable=True)
    meeting_type = Column(String(50), default="general")  # general, investor, client, team, board
    platform = Column(String(50), nullable=True)  # zoom, meet, teams, webex, other

    # File info
    file_path = Column(String(500), nullable=False)  # stored filename
    file_name = Column(String(255), nullable=True)   # original filename
    file_size = Column(Integer, nullable=True)
    file_format = Column(String(10), nullable=True)  # vtt, srt, txt

    # Parsed content
    transcript_text = Column(Text, nullable=True)     # Full plain text
    duration_seconds = Column(Integer, nullable=True)
    word_count = Column(Integer, nullable=True)
    speaker_count = Column(Integer, nullable=True)

    # AI summary (generated once on upload)
    summary = Column(Text, nullable=True)
    action_items = Column(Text, nullable=True)  # JSON array
    key_points = Column(Text, nullable=True)    # JSON array
    summary_generated_at = Column(DateTime, nullable=True)

    # Metadata
    tags = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="meeting_transcripts")
    business = relationship("Business", backref="meeting_transcripts")
