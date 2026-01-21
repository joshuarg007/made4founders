from pydantic import BaseModel
from typing import Optional, List, Literal
from datetime import datetime, date


# ============ Business Schemas (Fractal Hierarchy) ============

class BusinessBase(BaseModel):
    name: str
    slug: Optional[str] = None
    business_type: str = "other"
    description: Optional[str] = None
    color: Optional[str] = None
    emoji: Optional[str] = None
    parent_id: Optional[int] = None
    is_active: bool = True


class BusinessCreate(BusinessBase):
    pass


class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    business_type: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    emoji: Optional[str] = None
    parent_id: Optional[int] = None
    is_active: Optional[bool] = None
    is_archived: Optional[bool] = None
    gamification_enabled: Optional[bool] = None


class BusinessResponse(BusinessBase):
    id: int
    organization_id: int
    is_archived: bool
    # Gamification
    xp: int
    level: int
    current_streak: int
    longest_streak: int
    health_score: int
    health_compliance: int
    health_financial: int
    health_operations: int
    health_growth: int
    achievements: Optional[List[str]] = None
    gamification_enabled: bool = True
    # Challenge stats
    challenge_wins: int = 0
    challenge_losses: int = 0
    challenge_draws: int = 0
    challenge_win_streak: int = 0
    best_challenge_win_streak: int = 0
    titles: Optional[List[str]] = None
    active_title: Optional[str] = None
    # Timestamps
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BusinessWithChildren(BusinessResponse):
    """Business with nested children for tree view"""
    children: List["BusinessWithChildren"] = []


class BusinessSwitchRequest(BaseModel):
    """Request to switch current business context"""
    business_id: Optional[int] = None  # None = org-wide view


# ============ Quest Schemas ============

class QuestBase(BaseModel):
    slug: str
    name: str
    description: Optional[str] = None
    quest_type: str = "daily"
    category: str = "general"
    target_count: int = 1
    action_type: str
    xp_reward: int = 25
    icon: Optional[str] = None
    difficulty: str = "easy"
    min_level: int = 1


class QuestCreate(QuestBase):
    pass


class QuestResponse(QuestBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class BusinessQuestResponse(BaseModel):
    """Quest instance assigned to a business"""
    id: int
    business_id: int
    quest_id: int
    current_count: int
    target_count: int
    is_completed: bool
    is_claimed: bool
    assigned_date: date
    expires_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    claimed_at: Optional[datetime] = None
    xp_reward: int
    created_at: datetime

    # Nested quest details
    quest: QuestResponse

    class Config:
        from_attributes = True


class QuestProgressUpdate(BaseModel):
    """Update quest progress"""
    increment: int = 1  # How much to increment progress


class QuestClaimResponse(BaseModel):
    """Response when claiming a quest reward"""
    success: bool
    xp_awarded: int
    new_xp: int
    new_level: int
    message: str


# ============ Achievement Schemas ============

class AchievementBase(BaseModel):
    slug: str
    name: str
    description: Optional[str] = None
    category: str = "milestones"
    rarity: str = "common"
    requirement_type: str
    requirement_count: int = 1
    xp_reward: int = 50
    icon: Optional[str] = None
    badge_color: Optional[str] = None
    sort_order: int = 0
    is_secret: bool = False


class AchievementCreate(AchievementBase):
    pass


class AchievementResponse(AchievementBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class BusinessAchievementResponse(BaseModel):
    """Achievement instance for a business"""
    id: int
    business_id: int
    achievement_id: int
    current_count: int
    target_count: int
    is_unlocked: bool
    unlocked_at: Optional[datetime] = None
    xp_claimed: bool
    xp_reward: int
    created_at: datetime
    updated_at: datetime

    # Nested achievement details
    achievement: AchievementResponse

    class Config:
        from_attributes = True


class AchievementClaimResponse(BaseModel):
    """Response when claiming an achievement reward"""
    success: bool
    xp_awarded: int
    new_xp: int
    new_level: int
    message: str


# ============ Leaderboard Schemas ============

class LeaderboardEntry(BaseModel):
    """Single entry in the leaderboard"""
    rank: int
    business_id: int
    business_name: str
    business_emoji: Optional[str] = None
    business_color: Optional[str] = None
    organization_name: str
    xp: int
    level: int
    current_streak: int
    longest_streak: int
    achievements_count: int


class LeaderboardResponse(BaseModel):
    """Full leaderboard response"""
    entries: List[LeaderboardEntry]
    total_count: int
    user_rank: Optional[int] = None  # Current user's rank if they're on the list


# ============ Challenge Schemas ============

class ChallengeParticipantBrief(BaseModel):
    """Brief participant info for challenge display"""
    id: int
    business_id: int
    business_name: str
    business_emoji: Optional[str] = None
    business_color: Optional[str] = None
    business_level: int
    is_creator: bool
    has_accepted: bool
    progress: int
    adjusted_progress: int
    handicap_percent: int
    xp_wagered: int
    final_rank: Optional[int] = None
    xp_won: int
    xp_lost: int


class ChallengeCreate(BaseModel):
    """Create a new challenge"""
    name: str
    description: Optional[str] = None
    challenge_type: str  # task_sprint, xp_race, etc.
    duration: str  # 3_days, 1_week, 2_weeks, 1_month
    target_count: Optional[int] = None  # Optional: first to reach X wins
    xp_wager: int = 0  # XP to bet
    handicap_enabled: bool = True
    is_public: bool = False
    max_participants: int = 2  # 2 = head-to-head


class ChallengeResponse(BaseModel):
    """Full challenge response"""
    id: int
    name: str
    description: Optional[str] = None
    challenge_type: str
    invite_code: str
    is_public: bool
    duration: str
    status: str
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    target_count: Optional[int] = None
    xp_wager: int
    winner_bonus_xp: int
    handicap_enabled: bool
    created_by_id: int
    winner_id: Optional[int] = None
    participant_count: int
    max_participants: int
    created_at: datetime
    completed_at: Optional[datetime] = None

    # Nested participants
    participants: List[ChallengeParticipantBrief] = []

    # Computed fields
    time_remaining: Optional[str] = None  # "2d 5h 30m"
    your_progress: Optional[int] = None
    opponent_progress: Optional[int] = None

    class Config:
        from_attributes = True


class ChallengeAcceptRequest(BaseModel):
    """Accept a challenge invitation"""
    xp_wager: int = 0  # How much XP to wager


class ChallengeJoinByCodeRequest(BaseModel):
    """Join a challenge using invite code"""
    invite_code: str
    xp_wager: int = 0


class ChallengeListResponse(BaseModel):
    """List of challenges"""
    active: List[ChallengeResponse]
    pending: List[ChallengeResponse]
    completed: List[ChallengeResponse]
    invitations: List[ChallengeResponse]  # Challenges you've been invited to


class ChallengeResultResponse(BaseModel):
    """Result when a challenge completes"""
    challenge_id: int
    challenge_name: str
    winner_id: Optional[int]
    winner_name: Optional[str]
    your_rank: int
    your_progress: int
    xp_won: int
    xp_lost: int
    net_xp: int
    new_title: Optional[str] = None  # If you earned a new title
    message: str


# ============ Service schemas ============

# Service schemas
class ServiceBase(BaseModel):
    name: str
    url: str
    category: str = "other"
    description: Optional[str] = None
    username_hint: Optional[str] = None
    notes: Optional[str] = None
    icon: Optional[str] = None
    is_favorite: bool = False


class ServiceCreate(ServiceBase):
    pass


class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    username_hint: Optional[str] = None
    notes: Optional[str] = None
    icon: Optional[str] = None
    is_favorite: Optional[bool] = None
    last_visited: Optional[datetime] = None


class ServiceResponse(ServiceBase):
    id: int
    last_visited: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Document schemas
class DocumentBase(BaseModel):
    name: str
    category: str = "other"
    file_path: Optional[str] = None
    external_url: Optional[str] = None
    description: Optional[str] = None
    expiration_date: Optional[datetime] = None
    tags: Optional[str] = None
    is_sensitive: bool = False


class DocumentCreate(DocumentBase):
    pass


class DocumentUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    file_path: Optional[str] = None
    external_url: Optional[str] = None
    description: Optional[str] = None
    expiration_date: Optional[datetime] = None
    tags: Optional[str] = None
    is_sensitive: Optional[bool] = None


class DocumentResponse(DocumentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentWithStatus(DocumentBase):
    """Document response with file existence status"""
    id: int
    created_at: datetime
    updated_at: datetime
    file_exists: bool = False

    class Config:
        from_attributes = True


# Contact schemas
class ContactBase(BaseModel):
    name: str
    title: Optional[str] = None  # Job title
    company: Optional[str] = None
    contact_type: str = "other"
    email: Optional[str] = None
    secondary_email: Optional[str] = None
    phone: Optional[str] = None
    mobile_phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    timezone: Optional[str] = None
    website: Optional[str] = None
    linkedin_url: Optional[str] = None
    twitter_handle: Optional[str] = None
    birthday: Optional[date] = None
    tags: Optional[str] = None
    responsibilities: Optional[str] = None  # What this contact handles for you
    notes: Optional[str] = None


class ContactCreate(ContactBase):
    pass


class ContactUpdate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    contact_type: Optional[str] = None
    email: Optional[str] = None
    secondary_email: Optional[str] = None
    phone: Optional[str] = None
    mobile_phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    timezone: Optional[str] = None
    website: Optional[str] = None
    linkedin_url: Optional[str] = None
    twitter_handle: Optional[str] = None
    birthday: Optional[date] = None
    tags: Optional[str] = None
    responsibilities: Optional[str] = None
    notes: Optional[str] = None
    last_contacted: Optional[datetime] = None


class ContactResponse(ContactBase):
    id: int
    last_contacted: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Deadline schemas
class DeadlineBase(BaseModel):
    title: str
    description: Optional[str] = None
    deadline_type: str = "other"
    due_date: datetime
    reminder_days: int = 7
    is_recurring: bool = False
    recurrence_months: Optional[int] = None
    related_service_id: Optional[int] = None
    related_document_id: Optional[int] = None


class DeadlineCreate(DeadlineBase):
    pass


class DeadlineUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    deadline_type: Optional[str] = None
    due_date: Optional[datetime] = None
    reminder_days: Optional[int] = None
    is_recurring: Optional[bool] = None
    recurrence_months: Optional[int] = None
    is_completed: Optional[bool] = None
    related_service_id: Optional[int] = None
    related_document_id: Optional[int] = None


class DeadlineResponse(DeadlineBase):
    id: int
    is_completed: bool
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Dashboard stats
class DashboardStats(BaseModel):
    total_services: int
    total_documents: int
    total_contacts: int
    upcoming_deadlines: int
    expiring_documents: int
    overdue_deadlines: int


# Business Info schemas
class BusinessInfoBase(BaseModel):
    legal_name: Optional[str] = None
    dba_name: Optional[str] = None
    entity_type: Optional[str] = None
    formation_state: Optional[str] = None
    formation_date: Optional[datetime] = None
    fiscal_year_end: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: str = "United States"


class BusinessInfoCreate(BusinessInfoBase):
    pass


class BusinessInfoUpdate(BusinessInfoBase):
    pass


class BusinessInfoResponse(BusinessInfoBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Business Identifier schemas
class BusinessIdentifierBase(BaseModel):
    identifier_type: str
    label: str
    value: str
    issuing_authority: Optional[str] = None
    issue_date: Optional[datetime] = None
    expiration_date: Optional[datetime] = None
    notes: Optional[str] = None
    related_document_id: Optional[int] = None


class BusinessIdentifierCreate(BusinessIdentifierBase):
    pass


class BusinessIdentifierUpdate(BaseModel):
    identifier_type: Optional[str] = None
    label: Optional[str] = None
    value: Optional[str] = None
    issuing_authority: Optional[str] = None
    issue_date: Optional[datetime] = None
    expiration_date: Optional[datetime] = None
    notes: Optional[str] = None
    related_document_id: Optional[int] = None


class BusinessIdentifierResponse(BusinessIdentifierBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Masked version for frontend display
class BusinessIdentifierMasked(BaseModel):
    id: int
    identifier_type: str
    label: str
    masked_value: str  # e.g., "XX-XXX1234"
    issuing_authority: Optional[str] = None
    issue_date: Optional[datetime] = None
    expiration_date: Optional[datetime] = None
    notes: Optional[str] = None
    related_document_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Checklist Progress schemas
class ChecklistProgressBase(BaseModel):
    item_id: str
    is_completed: bool = False
    notes: Optional[str] = None
    data: Optional[str] = None  # JSON string
    related_document_id: Optional[int] = None
    related_identifier_id: Optional[int] = None


class ChecklistProgressCreate(ChecklistProgressBase):
    pass


class ChecklistProgressUpdate(BaseModel):
    is_completed: Optional[bool] = None
    notes: Optional[str] = None
    data: Optional[str] = None
    related_document_id: Optional[int] = None
    related_identifier_id: Optional[int] = None


class ChecklistProgressResponse(ChecklistProgressBase):
    id: int
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Bulk checklist response for frontend
class ChecklistProgressBulk(BaseModel):
    items: dict[str, ChecklistProgressResponse]  # keyed by item_id


# Auth schemas
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    email: str
    password: str
    name: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    email: str
    name: Optional[str]
    role: str = "viewer"
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserMe(BaseModel):
    email: str
    name: Optional[str]
    role: str = "viewer"


# User Management schemas (admin only)
class UserAdminCreate(BaseModel):
    email: str
    password: str
    name: Optional[str] = None
    role: str = "viewer"
    is_active: bool = True


class UserAdminUpdate(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


# Vault schemas
class VaultSetup(BaseModel):
    master_password: str


class VaultUnlock(BaseModel):
    master_password: str


class VaultStatus(BaseModel):
    is_setup: bool
    is_unlocked: bool


class CustomField(BaseModel):
    """Custom field for credential metadata"""
    name: str
    value: str
    type: Literal["text", "secret", "url", "date", "dropdown"] = "text"
    options: Optional[List[str]] = None  # For dropdown type


class CredentialBase(BaseModel):
    name: str
    service_url: Optional[str] = None
    category: str = "other"
    icon: Optional[str] = None
    related_service_id: Optional[int] = None


class CredentialCreate(CredentialBase):
    username: Optional[str] = None
    password: Optional[str] = None
    notes: Optional[str] = None
    totp_secret: Optional[str] = None
    purpose: Optional[str] = None
    custom_fields: Optional[List[CustomField]] = None


class CredentialUpdate(BaseModel):
    name: Optional[str] = None
    service_url: Optional[str] = None
    category: Optional[str] = None
    icon: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    notes: Optional[str] = None
    totp_secret: Optional[str] = None
    purpose: Optional[str] = None
    custom_fields: Optional[List[CustomField]] = None
    related_service_id: Optional[int] = None


class CredentialMasked(CredentialBase):
    """Credential with masked sensitive fields (when vault is locked)"""
    id: int
    has_username: bool
    has_password: bool
    has_notes: bool
    has_totp: bool
    has_purpose: bool
    has_custom_fields: bool
    custom_field_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CredentialDecrypted(CredentialBase):
    """Credential with decrypted sensitive fields (when vault is unlocked)"""
    id: int
    username: Optional[str] = None
    password: Optional[str] = None
    notes: Optional[str] = None
    totp_secret: Optional[str] = None
    purpose: Optional[str] = None
    custom_fields: Optional[List[CustomField]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Product Offered schemas
class ProductOfferedBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: str = "other"
    pricing_model: Optional[str] = None
    price: Optional[str] = None
    url: Optional[str] = None
    icon: Optional[str] = None
    is_active: bool = True
    notes: Optional[str] = None


class ProductOfferedCreate(ProductOfferedBase):
    pass


class ProductOfferedUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    pricing_model: Optional[str] = None
    price: Optional[str] = None
    url: Optional[str] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class ProductOfferedResponse(ProductOfferedBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Product Used schemas
class ProductUsedBase(BaseModel):
    name: str
    vendor: Optional[str] = None
    category: str = "other"
    is_paid: bool = False
    monthly_cost: Optional[str] = None
    billing_cycle: Optional[str] = None
    url: Optional[str] = None
    icon: Optional[str] = None
    notes: Optional[str] = None
    renewal_date: Optional[datetime] = None
    # New detailed fields
    description: Optional[str] = None
    use_case: Optional[str] = None
    features: Optional[str] = None
    integrations: Optional[str] = None
    login_url: Optional[str] = None
    account_email: Optional[str] = None
    license_type: Optional[str] = None
    status: str = "active"
    contract_end_date: Optional[datetime] = None


class ProductUsedCreate(ProductUsedBase):
    pass


class ProductUsedUpdate(BaseModel):
    name: Optional[str] = None
    vendor: Optional[str] = None
    category: Optional[str] = None
    is_paid: Optional[bool] = None
    monthly_cost: Optional[str] = None
    billing_cycle: Optional[str] = None
    url: Optional[str] = None
    icon: Optional[str] = None
    notes: Optional[str] = None
    renewal_date: Optional[datetime] = None
    description: Optional[str] = None
    use_case: Optional[str] = None
    features: Optional[str] = None
    integrations: Optional[str] = None
    login_url: Optional[str] = None
    account_email: Optional[str] = None
    license_type: Optional[str] = None
    status: Optional[str] = None
    contract_end_date: Optional[datetime] = None


class ProductUsedResponse(ProductUsedBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Web Link schemas
class WebLinkBase(BaseModel):
    title: str
    url: str
    category: str = "other"
    description: Optional[str] = None
    icon: Optional[str] = None
    is_favorite: bool = False


class WebLinkCreate(WebLinkBase):
    pass


class WebLinkUpdate(BaseModel):
    title: Optional[str] = None
    url: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    is_favorite: Optional[bool] = None


class WebLinkResponse(WebLinkBase):
    id: int
    last_visited: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ Marketplace Schemas ============

class MarketplaceBase(BaseModel):
    name: str
    category: str = "other"
    url: Optional[str] = None
    store_url: Optional[str] = None
    account_id: Optional[str] = None
    status: str = "active"
    commission_rate: Optional[str] = None
    monthly_fee: Optional[str] = None
    icon: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True


class MarketplaceCreate(MarketplaceBase):
    pass


class MarketplaceUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    url: Optional[str] = None
    store_url: Optional[str] = None
    account_id: Optional[str] = None
    status: Optional[str] = None
    commission_rate: Optional[str] = None
    monthly_fee: Optional[str] = None
    icon: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class MarketplaceResponse(MarketplaceBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ Task Management Schemas ============

# Helper schema for user info in responses
class UserBrief(BaseModel):
    id: int
    email: str
    name: Optional[str] = None

    class Config:
        from_attributes = True


# TaskBoard schemas
class TaskBoardBase(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None


class TaskBoardCreate(TaskBoardBase):
    pass


class TaskBoardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    is_default: Optional[bool] = None


# TaskColumn schemas
class TaskColumnBase(BaseModel):
    name: str
    status: str = "todo"
    color: Optional[str] = None
    wip_limit: Optional[int] = None


class TaskColumnCreate(TaskColumnBase):
    board_id: int
    position: Optional[int] = None


class TaskColumnUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    position: Optional[int] = None
    color: Optional[str] = None
    wip_limit: Optional[int] = None


class TaskColumnResponse(BaseModel):
    id: int
    board_id: int
    name: str
    status: str
    position: int
    color: Optional[str] = None
    wip_limit: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TaskBoardResponse(TaskBoardBase):
    id: int
    is_default: bool
    created_by_id: int
    columns: List[TaskColumnResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Task schemas
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "medium"
    due_date: Optional[datetime] = None
    reminder_days: int = 1
    start_date: Optional[datetime] = None
    estimated_minutes: Optional[int] = None
    tags: Optional[str] = None
    icon: Optional[str] = None
    related_deadline_id: Optional[int] = None
    related_contact_id: Optional[int] = None


class TaskCreate(TaskBase):
    board_id: int
    column_id: Optional[int] = None
    status: str = "todo"
    assigned_to_id: Optional[int] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    column_id: Optional[int] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    position: Optional[int] = None
    due_date: Optional[datetime] = None
    reminder_days: Optional[int] = None
    start_date: Optional[datetime] = None
    estimated_minutes: Optional[int] = None
    tags: Optional[str] = None
    icon: Optional[str] = None
    related_deadline_id: Optional[int] = None
    related_contact_id: Optional[int] = None


class TaskAssign(BaseModel):
    assigned_to_id: Optional[int] = None


class TaskMove(BaseModel):
    task_id: int
    target_column_id: int
    target_position: int


class TaskResponse(TaskBase):
    id: int
    board_id: int
    column_id: Optional[int] = None
    status: str
    position: int
    created_by_id: int
    assigned_to_id: Optional[int] = None
    completed_at: Optional[datetime] = None
    created_by: Optional[UserBrief] = None
    assigned_to: Optional[UserBrief] = None
    total_time_minutes: Optional[int] = None
    comment_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# TaskComment schemas
class TaskCommentBase(BaseModel):
    content: str


class TaskCommentCreate(TaskCommentBase):
    task_id: int


class TaskCommentUpdate(BaseModel):
    content: str


class TaskCommentResponse(TaskCommentBase):
    id: int
    task_id: int
    user_id: int
    user: Optional[UserBrief] = None
    is_edited: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# TimeEntry schemas
class TimeEntryBase(BaseModel):
    description: Optional[str] = None


class TimeEntryCreate(TimeEntryBase):
    task_id: int
    duration_minutes: Optional[int] = None


class TimeEntryUpdate(BaseModel):
    description: Optional[str] = None
    duration_minutes: Optional[int] = None


class TimerStart(BaseModel):
    task_id: int
    description: Optional[str] = None


class TimeEntryResponse(TimeEntryBase):
    id: int
    task_id: int
    user_id: int
    user: Optional[UserBrief] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    is_running: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# TaskActivity schemas
class TaskActivityResponse(BaseModel):
    id: int
    task_id: int
    user_id: int
    user: Optional[UserBrief] = None
    activity_type: str
    description: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Column reorder schema
class ColumnReorder(BaseModel):
    id: int
    position: int


# ============ Metrics Schemas ============

class MetricBase(BaseModel):
    metric_type: str  # mrr, arr, revenue, customers, users, burn_rate, runway, cash, cac, ltv, churn, nps, custom
    name: str
    value: str
    unit: Optional[str] = None
    date: datetime
    notes: Optional[str] = None


class MetricCreate(MetricBase):
    pass


class MetricUpdate(BaseModel):
    metric_type: Optional[str] = None
    name: Optional[str] = None
    value: Optional[str] = None
    unit: Optional[str] = None
    date: Optional[datetime] = None
    notes: Optional[str] = None


class MetricResponse(MetricBase):
    id: int
    created_by_id: int
    created_by: Optional[UserBrief] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Metric summary for dashboard
class MetricSummary(BaseModel):
    metric_type: str
    name: str
    current_value: str
    previous_value: Optional[str] = None
    change_percent: Optional[float] = None
    unit: Optional[str] = None
    trend: Optional[str] = None  # up, down, flat


# ============ Analytics Schemas ============

class MetricGoalBase(BaseModel):
    metric_type: str
    target_value: float
    target_date: Optional[datetime] = None
    name: Optional[str] = None
    notes: Optional[str] = None


class MetricGoalCreate(MetricGoalBase):
    pass


class MetricGoalUpdate(BaseModel):
    target_value: Optional[float] = None
    target_date: Optional[datetime] = None
    name: Optional[str] = None
    notes: Optional[str] = None
    is_achieved: Optional[bool] = None


class MetricGoalResponse(MetricGoalBase):
    id: int
    current_value: Optional[float] = None
    progress_percent: Optional[float] = None
    is_achieved: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AnalyticsOverview(BaseModel):
    period: str  # 7d, 30d, 90d, 1y, all
    total_metrics: int
    metrics_with_data: int
    improving_metrics: int
    declining_metrics: int
    flat_metrics: int


class GrowthMetric(BaseModel):
    metric_type: str
    name: str
    current_value: float
    previous_value: float
    absolute_change: float
    percent_change: float
    unit: Optional[str] = None


class FinancialHealth(BaseModel):
    mrr: Optional[float] = None
    arr: Optional[float] = None
    burn_rate: Optional[float] = None
    runway_months: Optional[float] = None
    cash: Optional[float] = None
    mrr_growth: Optional[float] = None  # percent
    revenue: Optional[float] = None


class CustomerHealth(BaseModel):
    total_customers: Optional[int] = None
    customer_growth: Optional[float] = None  # percent
    churn_rate: Optional[float] = None
    ltv: Optional[float] = None
    cac: Optional[float] = None
    ltv_cac_ratio: Optional[float] = None
    nps: Optional[float] = None


class AnalyticsDashboard(BaseModel):
    overview: AnalyticsOverview
    financial: FinancialHealth
    customer: CustomerHealth
    growth_metrics: List[GrowthMetric]
    goals: List[MetricGoalResponse]


# ============ Web Presence Schemas ============

class AdditionalEmail(BaseModel):
    provider: Optional[str] = None
    domain: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None


class AdditionalWebsite(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    platform: Optional[str] = None
    hosting: Optional[str] = None
    ssl_enabled: bool = False


class AdditionalSocial(BaseModel):
    platform: str
    url: Optional[str] = None
    handle: Optional[str] = None


class AdditionalListing(BaseModel):
    platform: str
    url: Optional[str] = None
    verified: bool = False
    handle: Optional[str] = None


class WebPresenceBase(BaseModel):
    # Domain
    domain_name: Optional[str] = None
    domain_registrar: Optional[str] = None
    domain_expiration: Optional[datetime] = None
    domain_privacy: bool = False
    domain_auto_renew: bool = False

    # Professional Email (primary)
    email_provider: Optional[str] = None
    email_domain: Optional[str] = None
    email_admin: Optional[str] = None

    # Additional emails
    additional_emails: Optional[List[AdditionalEmail]] = None

    # Website (primary)
    website_url: Optional[str] = None
    website_platform: Optional[str] = None
    website_hosting: Optional[str] = None
    ssl_enabled: bool = False

    # Additional websites
    additional_websites: Optional[List[AdditionalWebsite]] = None

    # Social Media
    linkedin_url: Optional[str] = None
    twitter_url: Optional[str] = None
    instagram_url: Optional[str] = None
    facebook_url: Optional[str] = None
    youtube_url: Optional[str] = None
    github_url: Optional[str] = None
    tiktok_url: Optional[str] = None

    # Additional/custom social media
    additional_socials: Optional[List[AdditionalSocial]] = None

    # Business Listings
    google_business_url: Optional[str] = None
    google_business_verified: bool = False
    apple_business_url: Optional[str] = None
    apple_business_verified: bool = False
    bing_places_url: Optional[str] = None
    bing_places_verified: bool = False
    yelp_url: Optional[str] = None
    yelp_claimed: bool = False
    bbb_url: Optional[str] = None
    bbb_accredited: bool = False

    # Additional business listings
    additional_listings: Optional[List[AdditionalListing]] = None

    notes: Optional[str] = None


class WebPresenceCreate(WebPresenceBase):
    pass


class WebPresenceUpdate(WebPresenceBase):
    pass


class WebPresenceResponse(WebPresenceBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ Bank Account Schemas ============

class BankAccountBase(BaseModel):
    account_type: str  # checking, savings, coinbase, paypal, stripe, etc.
    institution_name: str
    account_name: Optional[str] = None
    account_number_last4: Optional[str] = None
    routing_number: Optional[str] = None
    account_holder: Optional[str] = None
    is_primary: bool = False
    url: Optional[str] = None
    icon: Optional[str] = None
    notes: Optional[str] = None


class BankAccountCreate(BankAccountBase):
    pass


class BankAccountUpdate(BaseModel):
    account_type: Optional[str] = None
    institution_name: Optional[str] = None
    account_name: Optional[str] = None
    account_number_last4: Optional[str] = None
    routing_number: Optional[str] = None
    account_holder: Optional[str] = None
    is_primary: Optional[bool] = None
    url: Optional[str] = None
    icon: Optional[str] = None
    notes: Optional[str] = None


class BankAccountResponse(BankAccountBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ Contact Submissions ============

class ContactSubmissionCreate(BaseModel):
    name: str
    email: str
    company: Optional[str] = None
    subject: Optional[str] = None
    message: str
    source: Optional[str] = None
