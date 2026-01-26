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


class AuditLog(Base):
    """Audit log for security-sensitive operations."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Event details
    event_type = Column(String(50), nullable=False, index=True)  # login, logout, password_change, etc.
    action = Column(String(100), nullable=False)  # e.g., "POST /api/auth/login"
    resource = Column(String(200), nullable=True)  # affected resource path
    resource_id = Column(String(50), nullable=True)  # ID of affected resource

    # Context
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6
    user_agent = Column(String(500), nullable=True)
    status_code = Column(Integer, nullable=True)
    success = Column(Boolean, default=True)

    # Additional data (JSON)
    details = Column(Text, nullable=True)  # JSON object with extra context

    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    organization = relationship("Organization", backref="audit_logs")
    user = relationship("User", backref="audit_logs")


# ============================================================================
# PLAID INTEGRATION MODELS
# ============================================================================

class PlaidItem(Base):
    """Plaid Item - represents a connection to a financial institution via Plaid."""
    __tablename__ = "plaid_items"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)

    # Plaid identifiers
    item_id = Column(String(100), unique=True, nullable=False, index=True)
    access_token = Column(String(255), nullable=False)  # Encrypted in production

    # Institution info
    institution_id = Column(String(50), nullable=True)
    institution_name = Column(String(255), nullable=True)

    # Sync state
    cursor = Column(String(255), nullable=True)  # For transactions sync
    last_sync_at = Column(DateTime, nullable=True)
    sync_status = Column(String(50), default="pending")  # pending, syncing, synced, error
    sync_error = Column(Text, nullable=True)

    # Status
    is_active = Column(Boolean, default=True)
    consent_expires_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="plaid_items")
    accounts = relationship("PlaidAccount", back_populates="plaid_item", cascade="all, delete-orphan")


class PlaidAccount(Base):
    """Plaid Account - individual bank account linked via Plaid."""
    __tablename__ = "plaid_accounts"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    plaid_item_id = Column(Integer, ForeignKey("plaid_items.id", ondelete="CASCADE"), nullable=False)

    # Plaid identifiers
    account_id = Column(String(100), unique=True, nullable=False, index=True)

    # Account info
    name = Column(String(255), nullable=True)
    official_name = Column(String(255), nullable=True)
    mask = Column(String(4), nullable=True)  # Last 4 digits
    account_type = Column(String(50), nullable=True)  # depository, credit, loan, investment, other
    account_subtype = Column(String(50), nullable=True)  # checking, savings, credit card, etc.

    # Balances (updated on sync)
    balance_available = Column(Float, nullable=True)
    balance_current = Column(Float, nullable=True)
    balance_limit = Column(Float, nullable=True)  # For credit accounts
    iso_currency_code = Column(String(3), default="USD")

    # Status
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="plaid_accounts")
    plaid_item = relationship("PlaidItem", back_populates="accounts")
    transactions = relationship("PlaidTransaction", back_populates="account", cascade="all, delete-orphan")


class PlaidTransaction(Base):
    """Plaid Transaction - synced from bank via Plaid."""
    __tablename__ = "plaid_transactions"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    plaid_account_id = Column(Integer, ForeignKey("plaid_accounts.id", ondelete="CASCADE"), nullable=False)

    # Plaid identifiers
    transaction_id = Column(String(100), unique=True, nullable=False, index=True)

    # Transaction details
    amount = Column(Float, nullable=False)  # Positive for debits, negative for credits
    iso_currency_code = Column(String(3), default="USD")
    date = Column(Date, nullable=False, index=True)
    datetime_posted = Column(DateTime, nullable=True)

    # Merchant/payee info
    name = Column(String(255), nullable=True)
    merchant_name = Column(String(255), nullable=True)

    # Categorization
    category = Column(String(255), nullable=True)  # Primary category
    category_detailed = Column(String(255), nullable=True)  # Detailed category
    personal_finance_category = Column(String(100), nullable=True)  # Plaid's PFC

    # Status
    pending = Column(Boolean, default=False)

    # Location (optional)
    location_city = Column(String(100), nullable=True)
    location_state = Column(String(50), nullable=True)

    # User categorization override
    custom_category = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    is_excluded = Column(Boolean, default=False)  # Exclude from calculations

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="plaid_transactions")
    account = relationship("PlaidAccount", back_populates="transactions")


# ============================================================================
# STRIPE REVENUE INTEGRATION MODELS
# ============================================================================

class StripeConnection(Base):
    """Connected Stripe account for revenue tracking."""
    __tablename__ = "stripe_connections"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)

    # Stripe identifiers
    stripe_account_id = Column(String(100), unique=True, nullable=False, index=True)
    access_token = Column(String(255), nullable=False)
    refresh_token = Column(String(255), nullable=True)

    # Account info
    account_name = Column(String(255), nullable=True)

    # Sync state
    last_sync_at = Column(DateTime, nullable=True)
    sync_status = Column(String(50), default="pending")  # pending, syncing, synced, error
    sync_error = Column(Text, nullable=True)

    # Status
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="stripe_connections")
    customers = relationship("StripeCustomerSync", back_populates="connection", cascade="all, delete-orphan")
    subscriptions = relationship("StripeSubscriptionSync", back_populates="connection", cascade="all, delete-orphan")


class StripeCustomerSync(Base):
    """Synced Stripe customer data."""
    __tablename__ = "stripe_customers_sync"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    stripe_connection_id = Column(Integer, ForeignKey("stripe_connections.id", ondelete="CASCADE"), nullable=False)

    # Stripe identifiers
    stripe_customer_id = Column(String(100), nullable=False, index=True)

    # Customer info
    email = Column(String(255), nullable=True)
    name = Column(String(255), nullable=True)

    # Timestamps
    customer_created_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="stripe_customers")
    connection = relationship("StripeConnection", back_populates="customers")


class StripeSubscriptionSync(Base):
    """Synced Stripe subscription data for MRR/ARR calculation."""
    __tablename__ = "stripe_subscriptions_sync"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    stripe_connection_id = Column(Integer, ForeignKey("stripe_connections.id", ondelete="CASCADE"), nullable=False)

    # Stripe identifiers
    stripe_subscription_id = Column(String(100), nullable=False, index=True)
    stripe_customer_id = Column(String(100), nullable=True, index=True)

    # Subscription details
    status = Column(String(50), nullable=False)  # active, canceled, past_due, etc.
    plan_name = Column(String(255), nullable=True)
    mrr = Column(Float, default=0.0)  # Monthly recurring revenue for this subscription

    # Timestamps
    subscription_created_at = Column(DateTime, nullable=True)
    current_period_end = Column(DateTime, nullable=True)
    canceled_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="stripe_subscriptions")
    connection = relationship("StripeConnection", back_populates="subscriptions")


# ============================================================================
# GOOGLE CALENDAR INTEGRATION MODEL
# ============================================================================

class GoogleCalendarConnection(Base):
    """Connected Google Calendar for syncing deadlines and meetings."""
    __tablename__ = "google_calendar_connections"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # OAuth tokens
    access_token = Column(String(500), nullable=False)
    refresh_token = Column(String(500), nullable=True)
    token_expires_at = Column(DateTime, nullable=True)

    # Calendar info
    calendar_id = Column(String(255), default="primary")
    calendar_name = Column(String(255), nullable=True)

    # Sync settings
    sync_deadlines = Column(Boolean, default=True)
    sync_meetings = Column(Boolean, default=True)

    # Sync state
    last_sync_at = Column(DateTime, nullable=True)
    sync_status = Column(String(50), default="pending")  # pending, syncing, synced, error
    sync_error = Column(Text, nullable=True)

    # Status
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="google_calendar_connections")
    user = relationship("User", backref="google_calendar_connections")


# ============================================================================
# SLACK INTEGRATION MODEL
# ============================================================================

class SlackConnection(Base):
    """Connected Slack workspace for notifications."""
    __tablename__ = "slack_connections"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Slack identifiers
    team_id = Column(String(50), nullable=False, index=True)
    team_name = Column(String(255), nullable=True)
    bot_user_id = Column(String(50), nullable=True)

    # OAuth tokens
    access_token = Column(String(500), nullable=False)
    webhook_url = Column(String(500), nullable=True)

    # Channel settings
    channel_id = Column(String(50), nullable=True)
    channel_name = Column(String(255), nullable=True)

    # Notification settings
    notify_deadlines = Column(Boolean, default=True)
    notify_tasks = Column(Boolean, default=True)
    notify_metrics = Column(Boolean, default=True)
    daily_digest = Column(Boolean, default=True)
    daily_digest_time = Column(String(5), default="09:00")  # HH:MM format

    # Status
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="slack_connections")
    user = relationship("User", backref="slack_connections")


# ============================================================================
# CAP TABLE MODELS
# ============================================================================

class ShareholderType(str, enum.Enum):
    FOUNDER = "founder"
    INVESTOR = "investor"
    EMPLOYEE = "employee"
    ADVISOR = "advisor"
    BOARD_MEMBER = "board_member"
    OTHER = "other"


class ShareClassType(str, enum.Enum):
    COMMON = "common"
    PREFERRED = "preferred"


class VestingScheduleType(str, enum.Enum):
    STANDARD_4Y_1Y_CLIFF = "standard_4y_1y_cliff"  # 4 years, 1 year cliff
    IMMEDIATE = "immediate"  # Fully vested
    CUSTOM = "custom"


class SafeType(str, enum.Enum):
    POST_MONEY = "post_money"
    PRE_MONEY = "pre_money"
    MFN = "mfn"  # Most Favored Nation


class Shareholder(Base):
    """Investor, founder, employee, or advisor who holds equity."""
    __tablename__ = "shareholders"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    # Basic info
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    shareholder_type = Column(String(50), default="other")  # ShareholderType

    # Optional link to existing contact
    contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)

    # Additional details
    title = Column(String(255), nullable=True)  # e.g., "CEO", "Lead Investor"
    company = Column(String(255), nullable=True)  # e.g., "Sequoia Capital"
    phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="shareholders")
    contact = relationship("Contact", backref="shareholder_profiles")
    equity_grants = relationship("EquityGrant", back_populates="shareholder", cascade="all, delete-orphan")
    stock_options = relationship("StockOption", back_populates="shareholder", cascade="all, delete-orphan")
    safe_notes = relationship("SafeNote", back_populates="shareholder", cascade="all, delete-orphan")
    convertible_notes = relationship("ConvertibleNote", back_populates="shareholder", cascade="all, delete-orphan")


class ShareClass(Base):
    """Share class definition (Common, Series A, Series B, etc.)."""
    __tablename__ = "share_classes"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(100), nullable=False)  # e.g., "Common", "Series A Preferred"
    class_type = Column(String(50), default="common")  # ShareClassType
    prefix = Column(String(10), nullable=True)  # e.g., "CS" for Common Stock

    # Share details
    authorized_shares = Column(Integer, nullable=True)  # Total authorized
    par_value = Column(Float, default=0.0001)  # Par value per share
    price_per_share = Column(Float, nullable=True)  # Current/issue price

    # Preferred stock terms
    liquidation_preference = Column(Float, default=1.0)  # 1x, 2x, etc.
    participation_cap = Column(Float, nullable=True)  # Cap on participation
    is_participating = Column(Boolean, default=False)  # Participating preferred?
    dividend_rate = Column(Float, nullable=True)  # Annual dividend %
    is_cumulative_dividend = Column(Boolean, default=False)

    # Conversion
    conversion_ratio = Column(Float, default=1.0)  # Preferred to common ratio
    is_auto_convert_on_ipo = Column(Boolean, default=True)

    # Anti-dilution
    anti_dilution_type = Column(String(50), nullable=True)  # broad_based, narrow_based, full_ratchet

    # Voting
    votes_per_share = Column(Float, default=1.0)

    # Board seats
    board_seats = Column(Integer, default=0)

    notes = Column(Text, nullable=True)
    display_order = Column(Integer, default=0)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="share_classes")
    equity_grants = relationship("EquityGrant", back_populates="share_class")
    stock_options = relationship("StockOption", back_populates="share_class")


class EquityGrant(Base):
    """Actual equity ownership (issued shares)."""
    __tablename__ = "equity_grants"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    shareholder_id = Column(Integer, ForeignKey("shareholders.id", ondelete="CASCADE"), nullable=False)
    share_class_id = Column(Integer, ForeignKey("share_classes.id", ondelete="RESTRICT"), nullable=False)

    # Grant details
    shares = Column(Integer, nullable=False)  # Number of shares
    price_per_share = Column(Float, nullable=True)  # Price paid per share
    grant_date = Column(Date, nullable=False)
    certificate_number = Column(String(50), nullable=True)

    # Vesting
    vesting_schedule = Column(String(50), default="immediate")  # VestingScheduleType
    vesting_start_date = Column(Date, nullable=True)
    vesting_end_date = Column(Date, nullable=True)
    cliff_months = Column(Integer, default=0)
    vesting_period_months = Column(Integer, default=0)

    # For custom vesting - JSON array of {date, shares_vested}
    custom_vesting_schedule = Column(Text, nullable=True)

    # Repurchase rights
    has_repurchase_right = Column(Boolean, default=False)
    repurchase_price = Column(Float, nullable=True)

    # 83(b) election
    filed_83b = Column(Boolean, default=False)
    filed_83b_date = Column(Date, nullable=True)

    # Status
    status = Column(String(50), default="active")  # active, cancelled, repurchased
    cancelled_date = Column(Date, nullable=True)
    cancelled_shares = Column(Integer, default=0)

    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="equity_grants")
    shareholder = relationship("Shareholder", back_populates="equity_grants")
    share_class = relationship("ShareClass", back_populates="equity_grants")


class StockOption(Base):
    """Stock option grants (ISO, NSO)."""
    __tablename__ = "stock_options"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    shareholder_id = Column(Integer, ForeignKey("shareholders.id", ondelete="CASCADE"), nullable=False)
    share_class_id = Column(Integer, ForeignKey("share_classes.id", ondelete="RESTRICT"), nullable=False)

    # Option details
    option_type = Column(String(10), default="ISO")  # ISO, NSO
    shares_granted = Column(Integer, nullable=False)
    exercise_price = Column(Float, nullable=False)  # Strike price
    grant_date = Column(Date, nullable=False)
    expiration_date = Column(Date, nullable=True)  # Usually 10 years from grant

    # Vesting
    vesting_schedule = Column(String(50), default="standard_4y_1y_cliff")
    vesting_start_date = Column(Date, nullable=True)
    cliff_months = Column(Integer, default=12)
    vesting_period_months = Column(Integer, default=48)

    # Custom vesting - JSON array
    custom_vesting_schedule = Column(Text, nullable=True)

    # Exercise tracking
    shares_exercised = Column(Integer, default=0)
    shares_cancelled = Column(Integer, default=0)

    # Early exercise
    allows_early_exercise = Column(Boolean, default=False)
    early_exercised_shares = Column(Integer, default=0)

    # Status
    status = Column(String(50), default="active")  # active, exercised, cancelled, expired

    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="stock_options")
    shareholder = relationship("Shareholder", back_populates="stock_options")
    share_class = relationship("ShareClass", back_populates="stock_options")


class SafeNote(Base):
    """SAFE (Simple Agreement for Future Equity) tracking."""
    __tablename__ = "safe_notes"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    shareholder_id = Column(Integer, ForeignKey("shareholders.id", ondelete="CASCADE"), nullable=False)

    # SAFE details
    safe_type = Column(String(50), default="post_money")  # SafeType
    investment_amount = Column(Float, nullable=False)
    valuation_cap = Column(Float, nullable=True)  # Post-money valuation cap
    discount_rate = Column(Float, nullable=True)  # e.g., 0.20 for 20% discount

    # MFN clause
    has_mfn = Column(Boolean, default=False)

    # Pro-rata rights
    has_pro_rata = Column(Boolean, default=False)

    # Dates
    signed_date = Column(Date, nullable=False)

    # Conversion tracking
    is_converted = Column(Boolean, default=False)
    converted_date = Column(Date, nullable=True)
    converted_shares = Column(Integer, nullable=True)
    converted_share_class_id = Column(Integer, nullable=True)
    conversion_price = Column(Float, nullable=True)

    # Document reference
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)

    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="safe_notes")
    shareholder = relationship("Shareholder", back_populates="safe_notes")


class ConvertibleNote(Base):
    """Convertible promissory note tracking."""
    __tablename__ = "convertible_notes"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    shareholder_id = Column(Integer, ForeignKey("shareholders.id", ondelete="CASCADE"), nullable=False)

    # Note details
    principal_amount = Column(Float, nullable=False)
    interest_rate = Column(Float, nullable=False)  # Annual rate, e.g., 0.05 for 5%
    valuation_cap = Column(Float, nullable=True)
    discount_rate = Column(Float, nullable=True)  # e.g., 0.20 for 20%

    # Dates
    issue_date = Column(Date, nullable=False)
    maturity_date = Column(Date, nullable=False)

    # Qualified financing threshold
    qualified_financing_amount = Column(Float, nullable=True)

    # Conversion tracking
    is_converted = Column(Boolean, default=False)
    converted_date = Column(Date, nullable=True)
    converted_shares = Column(Integer, nullable=True)
    converted_share_class_id = Column(Integer, nullable=True)
    conversion_price = Column(Float, nullable=True)
    accrued_interest_at_conversion = Column(Float, nullable=True)

    # Document reference
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)

    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="convertible_notes")
    shareholder = relationship("Shareholder", back_populates="convertible_notes")


class FundingRound(Base):
    """Track funding rounds for historical reference."""
    __tablename__ = "funding_rounds"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(100), nullable=False)  # e.g., "Seed", "Series A"
    round_type = Column(String(50), nullable=True)  # pre_seed, seed, series_a, series_b, etc.

    # Valuation
    pre_money_valuation = Column(Float, nullable=True)
    post_money_valuation = Column(Float, nullable=True)

    # Amount
    amount_raised = Column(Float, nullable=True)
    target_amount = Column(Float, nullable=True)

    # Price
    price_per_share = Column(Float, nullable=True)

    # Lead investor
    lead_investor_id = Column(Integer, ForeignKey("shareholders.id", ondelete="SET NULL"), nullable=True)

    # Dates
    announced_date = Column(Date, nullable=True)
    closed_date = Column(Date, nullable=True)

    # Status
    status = Column(String(50), default="planned")  # planned, in_progress, closed, cancelled

    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="funding_rounds")
    lead_investor = relationship("Shareholder", foreign_keys=[lead_investor_id])


class Valuation409A(Base):
    """409A valuation tracking for stock option pricing."""
    __tablename__ = "valuations_409a"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    # Valuation details
    valuation_date = Column(Date, nullable=False)  # Date of the valuation
    effective_date = Column(Date, nullable=False)  # When the valuation becomes effective
    expiration_date = Column(Date, nullable=False)  # 12 months from effective date typically

    # Fair market value
    fmv_per_share = Column(Float, nullable=False)  # Fair Market Value per common share
    total_common_shares = Column(Integer, nullable=True)  # Total common shares at time of valuation
    implied_company_value = Column(Float, nullable=True)  # Total implied value

    # Valuation provider
    provider_name = Column(String(200), nullable=True)  # e.g., "Carta", "Eqvista", "Internal"
    provider_type = Column(String(50), default="external")  # external, internal

    # Report reference
    report_document_id = Column(Integer, ForeignKey("data_room_documents.id", ondelete="SET NULL"), nullable=True)

    # Status
    status = Column(String(50), default="draft")  # draft, pending_review, final, superseded

    # Methodology
    valuation_method = Column(String(100), nullable=True)  # e.g., "OPM", "PWERM", "Backsolve"
    discount_for_lack_of_marketability = Column(Float, nullable=True)  # DLOM percentage

    # Triggering event (what prompted this valuation)
    trigger_event = Column(String(100), nullable=True)  # annual, funding_round, material_event, initial

    notes = Column(Text, nullable=True)

    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="valuations_409a")
    created_by = relationship("User", foreign_keys=[created_by_id])
    report_document = relationship("DataRoomDocument", foreign_keys=[report_document_id])


# ============================================================================
# INVESTOR UPDATE MODELS
# ============================================================================

class InvestorUpdateStatus(str, enum.Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    SENDING = "sending"
    SENT = "sent"
    FAILED = "failed"


class InvestorUpdate(Base):
    """Investor update email campaigns."""
    __tablename__ = "investor_updates"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    # Update content
    title = Column(String(255), nullable=False)  # e.g., "Q4 2025 Update"
    subject_line = Column(String(255), nullable=True)  # Email subject
    greeting = Column(String(500), nullable=True)  # Opening greeting
    highlights = Column(Text, nullable=True)  # Key highlights (JSON array)
    body_content = Column(Text, nullable=True)  # Main content (HTML)
    closing = Column(Text, nullable=True)  # Closing remarks
    signature_name = Column(String(255), nullable=True)  # Sender name
    signature_title = Column(String(255), nullable=True)  # Sender title

    # Metrics to include (JSON array of metric types)
    included_metrics = Column(Text, nullable=True)  # ['mrr', 'runway', 'cash', ...]

    # Recipient filtering
    recipient_types = Column(Text, nullable=True)  # JSON: ['investor', 'board_member']
    recipient_ids = Column(Text, nullable=True)  # JSON: specific shareholder IDs, or null for all matching types

    # Status and scheduling
    status = Column(String(50), default="draft")  # InvestorUpdateStatus
    scheduled_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)

    # Stats
    recipient_count = Column(Integer, default=0)
    sent_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    opened_count = Column(Integer, default=0)

    # Creator
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="investor_updates")
    created_by = relationship("User", backref="investor_updates")
    recipients = relationship("InvestorUpdateRecipient", back_populates="investor_update", cascade="all, delete-orphan")


class InvestorUpdateRecipient(Base):
    """Individual recipient tracking for investor updates."""
    __tablename__ = "investor_update_recipients"

    id = Column(Integer, primary_key=True, index=True)
    investor_update_id = Column(Integer, ForeignKey("investor_updates.id", ondelete="CASCADE"), nullable=False, index=True)
    shareholder_id = Column(Integer, ForeignKey("shareholders.id", ondelete="SET NULL"), nullable=True)

    # Recipient info (stored for historical record even if shareholder deleted)
    email = Column(String(255), nullable=False)
    name = Column(String(255), nullable=True)

    # Delivery tracking
    status = Column(String(50), default="pending")  # pending, sent, failed, bounced
    sent_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

    # Engagement tracking (optional)
    opened_at = Column(DateTime, nullable=True)
    clicked_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    investor_update = relationship("InvestorUpdate", back_populates="recipients")
    shareholder = relationship("Shareholder", backref="update_recipients")


# ============================================
# DATA ROOM MODELS
# ============================================

class DataRoomFolder(Base):
    """Folders for organizing data room documents."""
    __tablename__ = "data_room_folders"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Hierarchy
    parent_id = Column(Integer, ForeignKey("data_room_folders.id", ondelete="CASCADE"), nullable=True, index=True)
    display_order = Column(Integer, default=0)

    # Access control
    visibility = Column(String(50), default="internal")  # internal, investors, custom

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="data_room_folders")
    parent = relationship("DataRoomFolder", remote_side=[id], backref="children")
    documents = relationship("DataRoomDocument", back_populates="folder", cascade="all, delete-orphan")


class DataRoomDocument(Base):
    """Documents added to the data room."""
    __tablename__ = "data_room_documents"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    # Link to existing document
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)

    # Folder placement
    folder_id = Column(Integer, ForeignKey("data_room_folders.id", ondelete="SET NULL"), nullable=True, index=True)

    # Data room specific
    display_name = Column(String(255), nullable=True)  # Override document name for data room
    display_order = Column(Integer, default=0)
    visibility = Column(String(50), default="internal")  # internal, investors, custom

    # Stats
    view_count = Column(Integer, default=0)
    download_count = Column(Integer, default=0)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="data_room_documents")
    document = relationship("Document", backref="data_room_entries")
    folder = relationship("DataRoomFolder", back_populates="documents")


class ShareableLink(Base):
    """Shareable links for data room access."""
    __tablename__ = "shareable_links"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    # What is being shared
    folder_id = Column(Integer, ForeignKey("data_room_folders.id", ondelete="CASCADE"), nullable=True)
    document_id = Column(Integer, ForeignKey("data_room_documents.id", ondelete="CASCADE"), nullable=True)

    # Link token (URL-safe)
    token = Column(String(64), unique=True, nullable=False, index=True)

    # Optional: link for specific shareholder
    shareholder_id = Column(Integer, ForeignKey("shareholders.id", ondelete="SET NULL"), nullable=True)

    # Security
    password_hash = Column(String(255), nullable=True)  # Optional password
    expires_at = Column(DateTime, nullable=True)
    access_limit = Column(Integer, nullable=True)  # Max accesses
    current_accesses = Column(Integer, default=0)

    # Link name/purpose
    name = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)

    # Creator
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="shareable_links")
    folder = relationship("DataRoomFolder", backref="shareable_links")
    data_room_document = relationship("DataRoomDocument", backref="shareable_links")
    shareholder = relationship("Shareholder", backref="data_room_links")
    created_by = relationship("User", backref="created_shareable_links")
    access_logs = relationship("DataRoomAccess", back_populates="shareable_link", cascade="all, delete-orphan")


class DataRoomAccess(Base):
    """Audit trail for data room views and downloads."""
    __tablename__ = "data_room_access"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    # What was accessed
    folder_id = Column(Integer, ForeignKey("data_room_folders.id", ondelete="SET NULL"), nullable=True)
    document_id = Column(Integer, ForeignKey("data_room_documents.id", ondelete="SET NULL"), nullable=True)

    # How it was accessed
    shareable_link_id = Column(Integer, ForeignKey("shareable_links.id", ondelete="SET NULL"), nullable=True)

    # Who accessed (either internal user or external via shareholder)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    shareholder_id = Column(Integer, ForeignKey("shareholders.id", ondelete="SET NULL"), nullable=True)

    # Access type
    access_type = Column(String(50), nullable=False)  # view, download

    # Client info
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="data_room_access_logs")
    folder = relationship("DataRoomFolder", backref="access_logs")
    data_room_document = relationship("DataRoomDocument", backref="access_logs")
    shareable_link = relationship("ShareableLink", back_populates="access_logs")
    user = relationship("User", backref="data_room_access")
    shareholder = relationship("Shareholder", backref="data_room_access")


# ============================================
# BUDGET MODELS
# ============================================

class BudgetCategory(Base):
    """Budget spending categories (e.g., 'Marketing', 'Payroll', 'Software')."""
    __tablename__ = "budget_categories"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    # Category info
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(20), nullable=True)  # For UI: "#FF5733"
    icon = Column(String(50), nullable=True)  # lucide icon name

    # Hierarchy
    parent_id = Column(Integer, ForeignKey("budget_categories.id", ondelete="CASCADE"), nullable=True)
    display_order = Column(Integer, default=0)

    # Transaction mapping (JSON arrays)
    plaid_categories = Column(Text, nullable=True)  # ["FOOD_AND_DRINK", "SHOPPING"]
    merchant_keywords = Column(Text, nullable=True)  # ["AWS", "Google Cloud", "Stripe"]

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="budget_categories")
    parent = relationship("BudgetCategory", remote_side=[id], backref="children")
    line_items = relationship("BudgetLineItem", back_populates="category", cascade="all, delete-orphan")


class BudgetPeriod(Base):
    """Budget for a specific time period (monthly, quarterly, annual)."""
    __tablename__ = "budget_periods"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    # Period definition
    period_type = Column(String(20), nullable=False)  # monthly, quarterly, annual
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)

    # Metadata
    name = Column(String(100), nullable=True)  # "Q1 2025 Budget"
    notes = Column(Text, nullable=True)

    # Total budget amount (sum of line items)
    total_budget = Column(Float, default=0.0)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="budget_periods")
    line_items = relationship("BudgetLineItem", back_populates="period", cascade="all, delete-orphan")


class BudgetLineItem(Base):
    """Individual budget line (category + amount for a period)."""
    __tablename__ = "budget_line_items"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    budget_period_id = Column(Integer, ForeignKey("budget_periods.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("budget_categories.id", ondelete="CASCADE"), nullable=False, index=True)

    # Budget amount
    budgeted_amount = Column(Float, nullable=False)

    # Actual tracking (updated via calculation)
    actual_amount = Column(Float, default=0.0)
    transaction_count = Column(Integer, default=0)

    # Variance calculation
    variance_amount = Column(Float, nullable=True)  # budgeted - actual
    variance_percent = Column(Float, nullable=True)  # (variance / budgeted) * 100
    status = Column(String(20), default="on_track")  # on_track, warning, over

    # Tracking
    notes = Column(Text, nullable=True)
    last_calculated_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="budget_line_items")
    period = relationship("BudgetPeriod", back_populates="line_items")
    category = relationship("BudgetCategory", back_populates="line_items")


# ============================================
# INVOICE MODELS
# ============================================

class Invoice(Base):
    """Invoice for billing contacts/clients."""
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True)

    # Billing contact
    contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="RESTRICT"), nullable=False, index=True)

    # Invoice metadata
    invoice_number = Column(String(50), nullable=False, index=True)
    issue_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)

    # Amount tracking
    subtotal = Column(Float, default=0.0)
    tax_rate = Column(Float, default=0.0)  # As percentage (e.g., 8.25 for 8.25%)
    tax_amount = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)

    # Payment status
    status = Column(String(50), default="draft")  # draft, sent, viewed, paid, overdue, cancelled
    payment_method = Column(String(50), nullable=True)
    paid_at = Column(DateTime, nullable=True)
    paid_amount = Column(Float, default=0.0)

    # Tracking
    notes = Column(Text, nullable=True)
    terms = Column(Text, nullable=True)  # Payment terms
    email_sent_at = Column(DateTime, nullable=True)
    viewed_at = Column(DateTime, nullable=True)
    last_reminder_at = Column(DateTime, nullable=True)

    # Creator
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="invoices")
    business = relationship("Business", backref="invoices")
    contact = relationship("Contact", backref="invoices")
    created_by = relationship("User", backref="created_invoices")
    line_items = relationship("InvoiceLineItem", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("InvoicePayment", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceLineItem(Base):
    """Line item on an invoice."""
    __tablename__ = "invoice_line_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)

    # Item details
    description = Column(String(500), nullable=False)
    quantity = Column(Float, default=1.0)
    unit_price = Column(Float, nullable=False)
    amount = Column(Float, nullable=False)  # quantity * unit_price

    # Optional: link to product/service
    product_id = Column(Integer, ForeignKey("products_offered.id", ondelete="SET NULL"), nullable=True)

    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    invoice = relationship("Invoice", back_populates="line_items")
    product = relationship("ProductOffered", backref="invoice_line_items")


class InvoicePayment(Base):
    """Payment record for an invoice (supports partial payments)."""
    __tablename__ = "invoice_payments"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)

    amount = Column(Float, nullable=False)
    payment_date = Column(Date, nullable=False)
    payment_method = Column(String(50), nullable=False)  # stripe, check, cash, bank_transfer, other

    # Optional Stripe reference
    stripe_payment_intent_id = Column(String(100), nullable=True)

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    invoice = relationship("Invoice", back_populates="payments")


# ============================================================================
# TEAM MANAGEMENT MODELS
# ============================================================================

class EmploymentType(str, enum.Enum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    CONTRACTOR = "contractor"
    INTERN = "intern"
    CONSULTANT = "consultant"


class EmploymentStatus(str, enum.Enum):
    ACTIVE = "active"
    ON_LEAVE = "on_leave"
    TERMINATED = "terminated"
    PENDING = "pending"


class Employee(Base):
    """Employee/team member record."""
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    # Basic Info
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    preferred_name = Column(String(100), nullable=True)
    email = Column(String(255), nullable=False)
    personal_email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)

    # Links to other entities
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    shareholder_id = Column(Integer, ForeignKey("shareholders.id", ondelete="SET NULL"), nullable=True)
    contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)

    # Employment Details
    employee_number = Column(String(50), nullable=True)
    employment_type = Column(String(50), default=EmploymentType.FULL_TIME.value)
    employment_status = Column(String(50), default=EmploymentStatus.ACTIVE.value)

    # Role & Position
    title = Column(String(255), nullable=True)
    department = Column(String(100), nullable=True)
    manager_id = Column(Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)

    # Dates
    hire_date = Column(Date, nullable=True)
    start_date = Column(Date, nullable=True)
    termination_date = Column(Date, nullable=True)
    termination_reason = Column(Text, nullable=True)

    # Compensation (stored in cents for precision)
    salary_cents = Column(Integer, nullable=True)
    salary_frequency = Column(String(20), nullable=True)  # annual, hourly, monthly
    hourly_rate_cents = Column(Integer, nullable=True)

    # Location
    work_location = Column(String(50), nullable=True)  # remote, office, hybrid
    office_location = Column(String(255), nullable=True)
    timezone = Column(String(50), nullable=True)

    # Contractor/1099 Info
    is_contractor = Column(Boolean, default=False)
    tax_classification = Column(String(50), nullable=True)  # W-2, 1099

    # Profile
    avatar_url = Column(String(500), nullable=True)
    bio = Column(Text, nullable=True)
    linkedin_url = Column(String(500), nullable=True)

    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="employees")
    manager = relationship("Employee", remote_side=[id], backref="direct_reports")
    user = relationship("User", backref="employee_profile")
    shareholder = relationship("Shareholder", backref="employee_profile")
    contact = relationship("Contact", backref="employee_profile")


class PTOPolicy(Base):
    """PTO policy defining allowance rules."""
    __tablename__ = "pto_policies"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(100), nullable=False)  # e.g., "Vacation", "Sick Leave"
    pto_type = Column(String(50), default="vacation")  # vacation, sick, personal, other
    description = Column(Text, nullable=True)

    # Simple allowance (days per year)
    annual_days = Column(Float, default=0)
    requires_approval = Column(Boolean, default=True)

    # Applicability
    applies_to_contractors = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="pto_policies")


class PTOBalance(Base):
    """PTO balance for an employee."""
    __tablename__ = "pto_balances"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    policy_id = Column(Integer, ForeignKey("pto_policies.id", ondelete="CASCADE"), nullable=False, index=True)

    # Balances (in days)
    available_days = Column(Float, default=0)
    used_days = Column(Float, default=0)
    pending_days = Column(Float, default=0)  # Requested but not yet taken

    balance_year = Column(Integer, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="pto_balances")
    employee = relationship("Employee", backref="pto_balances")
    policy = relationship("PTOPolicy", backref="balances")


class PTORequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    DENIED = "denied"
    CANCELLED = "cancelled"


class PTORequest(Base):
    """PTO request from an employee."""
    __tablename__ = "pto_requests"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    policy_id = Column(Integer, ForeignKey("pto_policies.id", ondelete="CASCADE"), nullable=False, index=True)

    # Request details
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    days_requested = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)

    # Status
    status = Column(String(50), default=PTORequestStatus.PENDING.value)
    reviewed_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="pto_requests")
    employee = relationship("Employee", backref="pto_requests")
    policy = relationship("PTOPolicy", backref="requests")
    reviewed_by = relationship("User", backref="pto_reviews")


class OnboardingTemplate(Base):
    """Reusable onboarding checklist template."""
    __tablename__ = "onboarding_templates"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Targeting
    role = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)
    employment_type = Column(String(50), nullable=True)

    # Template content (JSON array of task definitions)
    tasks_json = Column(Text, nullable=True)  # JSON: [{name, description, category, due_days}]

    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="onboarding_templates")


class OnboardingChecklist(Base):
    """Onboarding checklist instance for a specific employee."""
    __tablename__ = "onboarding_checklists"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    template_id = Column(Integer, ForeignKey("onboarding_templates.id", ondelete="SET NULL"), nullable=True)

    name = Column(String(255), nullable=False)
    start_date = Column(Date, nullable=False)
    target_completion_date = Column(Date, nullable=True)

    # Progress
    total_tasks = Column(Integer, default=0)
    completed_tasks = Column(Integer, default=0)
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="onboarding_checklists")
    employee = relationship("Employee", backref="onboarding_checklists")
    template = relationship("OnboardingTemplate", backref="checklists")


class OnboardingTask(Base):
    """Individual task in an onboarding checklist."""
    __tablename__ = "onboarding_tasks"

    id = Column(Integer, primary_key=True, index=True)
    checklist_id = Column(Integer, ForeignKey("onboarding_checklists.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=True)  # IT, HR, Training, etc.

    # Timing
    due_date = Column(Date, nullable=True)
    due_days_after_start = Column(Integer, nullable=True)

    # Assignment
    assignee_type = Column(String(50), nullable=True)  # employee, manager, hr, it
    assigned_to_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Completion
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    completed_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    completion_notes = Column(Text, nullable=True)

    sort_order = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    checklist = relationship("OnboardingChecklist", backref="tasks")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id], backref="assigned_onboarding_tasks")
    completed_by = relationship("User", foreign_keys=[completed_by_id], backref="completed_onboarding_tasks")


# ============================================================================
# AI FEATURES MODELS
# ============================================================================

class AIConversation(Base):
    """AI assistant conversation history."""
    __tablename__ = "ai_conversations"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(255), nullable=True)  # Auto-generated from first message
    is_archived = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="ai_conversations")
    user = relationship("User", backref="ai_conversations")


class AIMessage(Base):
    """Individual messages in AI conversation."""
    __tablename__ = "ai_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False, index=True)

    role = Column(String(20), nullable=False)  # user, assistant
    content = Column(Text, nullable=False)

    # Response metadata
    tokens_used = Column(Integer, nullable=True)
    model_used = Column(String(50), nullable=True)
    data_cards = Column(JSON, nullable=True)  # Structured data for rich display
    suggested_actions = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    conversation = relationship("AIConversation", backref="messages")


class Competitor(Base):
    """Tracked competitors for monitoring."""
    __tablename__ = "competitors"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(255), nullable=False)
    website = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)

    # Monitoring configuration
    keywords = Column(JSON, nullable=True)  # ["payments", "fintech"]
    rss_urls = Column(JSON, nullable=True)  # RSS feeds to monitor
    news_api_query = Column(String(500), nullable=True)  # Custom NewsAPI query

    # Status
    is_active = Column(Boolean, default=True)
    last_checked_at = Column(DateTime, nullable=True)

    # Metadata
    industry = Column(String(100), nullable=True)
    founded_year = Column(Integer, nullable=True)
    headquarters = Column(String(255), nullable=True)
    employee_count = Column(String(50), nullable=True)  # "10-50", "100-500", etc.

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", backref="competitors")


class CompetitorUpdate(Base):
    """News and updates about competitors."""
    __tablename__ = "competitor_updates"

    id = Column(Integer, primary_key=True, index=True)
    competitor_id = Column(Integer, ForeignKey("competitors.id", ondelete="CASCADE"), nullable=False, index=True)

    update_type = Column(String(50), nullable=False)  # news, product, funding, hiring, partnership
    title = Column(String(500), nullable=False)
    summary = Column(Text, nullable=True)
    content = Column(Text, nullable=True)

    # Source
    source_url = Column(String(1000), nullable=True)
    source_name = Column(String(255), nullable=True)

    # Analysis
    relevance_score = Column(Float, nullable=True)  # 0.0 - 1.0
    sentiment = Column(String(20), nullable=True)  # positive, neutral, negative
    ai_summary = Column(Text, nullable=True)

    # Status
    is_read = Column(Boolean, default=False)
    is_starred = Column(Boolean, default=False)

    published_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    competitor = relationship("Competitor", backref="updates")


class DocumentSummary(Base):
    """AI-generated document summaries and extractions."""
    __tablename__ = "document_summaries"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)

    # Summary content
    summary = Column(Text, nullable=True)
    document_type = Column(String(50), nullable=True)  # contract, term_sheet, invoice, report, legal, other

    # Extracted data
    key_terms = Column(JSON, nullable=True)  # [{"term": "...", "value": "..."}]
    extracted_dates = Column(JSON, nullable=True)  # [{"description": "...", "date": "YYYY-MM-DD"}]
    action_items = Column(JSON, nullable=True)  # ["action 1", "action 2"]
    risk_flags = Column(JSON, nullable=True)  # ["risk 1", "risk 2"]

    # Generation metadata
    model_used = Column(String(50), nullable=True)
    tokens_used = Column(Integer, nullable=True)
    processing_time_ms = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    document = relationship("Document", backref="ai_summaries")
