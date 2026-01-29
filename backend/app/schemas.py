from pydantic import BaseModel
from typing import Optional, List, Literal, Dict
from datetime import datetime, date


# ============ Business Schemas (Fractal Hierarchy) ============

class BusinessBrief(BaseModel):
    """Minimal business info for list displays and entity associations"""
    id: int
    name: str
    color: Optional[str] = None
    emoji: Optional[str] = None

    class Config:
        from_attributes = True


class BusinessBase(BaseModel):
    name: str
    slug: Optional[str] = None
    business_type: str = "other"
    description: Optional[str] = None
    color: Optional[str] = None
    emoji: Optional[str] = None
    parent_id: Optional[int] = None
    is_active: bool = True
    # New fields for business taxonomy
    website: Optional[str] = None
    primary_contact_id: Optional[int] = None
    notes: Optional[str] = None


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
    # New fields for business taxonomy
    website: Optional[str] = None
    primary_contact_id: Optional[int] = None
    notes: Optional[str] = None


class BusinessResponse(BusinessBase):
    id: int
    organization_id: int
    is_archived: bool
    archived_at: Optional[datetime] = None
    # Gamification (keeping for backwards compatibility, but simplified usage)
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


class BulkBusinessAssignRequest(BaseModel):
    """Bulk assign/remove businesses from entities"""
    entity_ids: List[int]  # IDs of entities to modify
    business_ids: List[int]  # Business IDs to assign/remove
    action: Literal["add", "remove", "set"]  # add: append, remove: unassign, set: replace all


class BusinessArchiveRequest(BaseModel):
    """Archive or restore a business"""
    is_archived: bool


class BusinessExportResponse(BaseModel):
    """Response for business data export"""
    business: BusinessBrief
    contacts_count: int
    documents_count: int
    credentials_count: int
    services_count: int
    products_offered_count: int
    products_used_count: int
    web_links_count: int
    deadlines_count: int
    meetings_count: int


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
    business_ids: Optional[List[int]] = None  # Multi-business associations


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
    businesses: List[BusinessBrief] = []  # Associated businesses
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
    business_ids: Optional[List[int]] = None  # Multi-business associations


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
    businesses: List[BusinessBrief] = []  # Associated businesses
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
    additional_emails: Optional[List[str]] = None
    additional_phones: Optional[List[str]] = None
    tags: Optional[str] = None
    responsibilities: Optional[str] = None  # What this contact handles for you
    notes: Optional[str] = None


class ContactCreate(ContactBase):
    business_ids: Optional[List[int]] = None  # Multi-business associations


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
    additional_emails: Optional[List[str]] = None
    additional_phones: Optional[List[str]] = None
    tags: Optional[str] = None
    responsibilities: Optional[str] = None
    notes: Optional[str] = None
    last_contacted: Optional[datetime] = None


class ContactResponse(ContactBase):
    id: int
    additional_emails: Optional[List[str]] = None
    additional_phones: Optional[List[str]] = None
    last_contacted: Optional[datetime]
    businesses: List[BusinessBrief] = []  # Associated businesses
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Meeting schemas
class MeetingBase(BaseModel):
    title: str
    meeting_date: datetime
    duration_minutes: Optional[int] = None
    location: Optional[str] = None
    meeting_type: str = "general"
    attendees: Optional[List[str]] = None
    agenda: Optional[str] = None
    minutes: Optional[str] = None
    decisions: Optional[str] = None
    action_items: Optional[List[dict]] = None  # [{task, assignee, due_date}]
    audio_file_url: Optional[str] = None
    document_ids: Optional[List[int]] = None
    tags: Optional[str] = None
    is_recurring: bool = False
    recurrence_pattern: Optional[str] = None


class MeetingCreate(MeetingBase):
    business_ids: Optional[List[int]] = None  # Multi-business associations


class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    meeting_date: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    location: Optional[str] = None
    meeting_type: Optional[str] = None
    attendees: Optional[List[str]] = None
    agenda: Optional[str] = None
    minutes: Optional[str] = None
    decisions: Optional[str] = None
    action_items: Optional[List[dict]] = None
    audio_file_url: Optional[str] = None
    document_ids: Optional[List[int]] = None
    tags: Optional[str] = None
    is_recurring: Optional[bool] = None
    recurrence_pattern: Optional[str] = None


class MeetingResponse(MeetingBase):
    id: int
    businesses: List[BusinessBrief] = []  # Associated businesses
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
    business_ids: Optional[List[int]] = None  # Multi-business associations


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
    businesses: List[BusinessBrief] = []  # Associated businesses
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
    has_completed_onboarding: bool = False


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


# Email Verification schemas
class VerifyEmailRequest(BaseModel):
    token: str


class ResendVerificationRequest(BaseModel):
    email: str


# Password Reset schemas
class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


# Session Management schemas
class SessionResponse(BaseModel):
    id: int
    device_info: Optional[str]
    ip_address: Optional[str]
    created_at: datetime
    last_used_at: datetime
    is_current: bool = False

    class Config:
        from_attributes = True


class RevokeSessionRequest(BaseModel):
    session_id: int


# Vault schemas
class VaultSetup(BaseModel):
    master_password: str


class VaultUnlock(BaseModel):
    master_password: str
    mfa_code: Optional[str] = None  # Required if user has MFA enabled


class VaultStatus(BaseModel):
    is_setup: bool
    is_unlocked: bool
    mfa_required: Optional[bool] = False  # True if user has MFA enabled


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
    business_ids: Optional[List[int]] = None  # Multi-business associations


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
    business_ids: Optional[List[int]] = None  # Multi-business associations


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
    businesses: List[BusinessBrief] = []  # Associated businesses
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
    businesses: List[BusinessBrief] = []  # Associated businesses
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
    business_ids: Optional[List[int]] = None  # Multi-business associations


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
    business_ids: Optional[List[int]] = None  # Multi-business associations


class ProductOfferedResponse(ProductOfferedBase):
    id: int
    businesses: List[BusinessBrief] = []  # Associated businesses
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
    business_ids: Optional[List[int]] = None  # Multi-business associations


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
    business_ids: Optional[List[int]] = None  # Multi-business associations


class ProductUsedResponse(ProductUsedBase):
    id: int
    businesses: List[BusinessBrief] = []  # Associated businesses
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
    business_ids: Optional[List[int]] = None  # Multi-business associations


class WebLinkUpdate(BaseModel):
    title: Optional[str] = None
    url: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    is_favorite: Optional[bool] = None
    business_ids: Optional[List[int]] = None  # Multi-business associations


class WebLinkResponse(WebLinkBase):
    id: int
    last_visited: Optional[datetime] = None
    businesses: List[BusinessBrief] = []  # Associated businesses
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


# ============ Cap Table Schemas ============

# Shareholder schemas
class ShareholderBase(BaseModel):
    name: str
    email: Optional[str] = None
    shareholder_type: str = "other"  # founder, investor, employee, advisor, board_member, other
    contact_id: Optional[int] = None
    title: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None


class ShareholderCreate(ShareholderBase):
    pass


class ShareholderUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    shareholder_type: Optional[str] = None
    contact_id: Optional[int] = None
    title: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class ShareholderResponse(ShareholderBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    # Computed fields (populated by API)
    total_shares: Optional[int] = 0
    total_options: Optional[int] = 0
    ownership_percentage: Optional[float] = 0.0
    fully_diluted_percentage: Optional[float] = 0.0

    class Config:
        from_attributes = True


# Share Class schemas
class ShareClassBase(BaseModel):
    name: str
    class_type: str = "common"  # common, preferred
    prefix: Optional[str] = None
    authorized_shares: Optional[int] = None
    par_value: float = 0.0001
    price_per_share: Optional[float] = None
    liquidation_preference: float = 1.0
    participation_cap: Optional[float] = None
    is_participating: bool = False
    dividend_rate: Optional[float] = None
    is_cumulative_dividend: bool = False
    conversion_ratio: float = 1.0
    is_auto_convert_on_ipo: bool = True
    anti_dilution_type: Optional[str] = None
    votes_per_share: float = 1.0
    board_seats: int = 0
    notes: Optional[str] = None
    display_order: int = 0


class ShareClassCreate(ShareClassBase):
    pass


class ShareClassUpdate(BaseModel):
    name: Optional[str] = None
    class_type: Optional[str] = None
    prefix: Optional[str] = None
    authorized_shares: Optional[int] = None
    par_value: Optional[float] = None
    price_per_share: Optional[float] = None
    liquidation_preference: Optional[float] = None
    participation_cap: Optional[float] = None
    is_participating: Optional[bool] = None
    dividend_rate: Optional[float] = None
    is_cumulative_dividend: Optional[bool] = None
    conversion_ratio: Optional[float] = None
    is_auto_convert_on_ipo: Optional[bool] = None
    anti_dilution_type: Optional[str] = None
    votes_per_share: Optional[float] = None
    board_seats: Optional[int] = None
    notes: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


class ShareClassResponse(ShareClassBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    # Computed
    issued_shares: Optional[int] = 0
    outstanding_options: Optional[int] = 0

    class Config:
        from_attributes = True


# Equity Grant schemas
class EquityGrantBase(BaseModel):
    shareholder_id: int
    share_class_id: int
    shares: int
    price_per_share: Optional[float] = None
    grant_date: date
    certificate_number: Optional[str] = None
    vesting_schedule: str = "immediate"
    vesting_start_date: Optional[date] = None
    vesting_end_date: Optional[date] = None
    cliff_months: int = 0
    vesting_period_months: int = 0
    custom_vesting_schedule: Optional[str] = None
    has_repurchase_right: bool = False
    repurchase_price: Optional[float] = None
    filed_83b: bool = False
    filed_83b_date: Optional[date] = None
    notes: Optional[str] = None


class EquityGrantCreate(EquityGrantBase):
    pass


class EquityGrantUpdate(BaseModel):
    shareholder_id: Optional[int] = None
    share_class_id: Optional[int] = None
    shares: Optional[int] = None
    price_per_share: Optional[float] = None
    grant_date: Optional[date] = None
    certificate_number: Optional[str] = None
    vesting_schedule: Optional[str] = None
    vesting_start_date: Optional[date] = None
    vesting_end_date: Optional[date] = None
    cliff_months: Optional[int] = None
    vesting_period_months: Optional[int] = None
    custom_vesting_schedule: Optional[str] = None
    has_repurchase_right: Optional[bool] = None
    repurchase_price: Optional[float] = None
    filed_83b: Optional[bool] = None
    filed_83b_date: Optional[date] = None
    status: Optional[str] = None
    cancelled_date: Optional[date] = None
    cancelled_shares: Optional[int] = None
    notes: Optional[str] = None


class EquityGrantResponse(EquityGrantBase):
    id: int
    status: str
    cancelled_date: Optional[date] = None
    cancelled_shares: int
    created_at: datetime
    updated_at: datetime
    # Joined data
    shareholder_name: Optional[str] = None
    share_class_name: Optional[str] = None
    # Computed
    vested_shares: Optional[int] = 0
    unvested_shares: Optional[int] = 0

    class Config:
        from_attributes = True


# Stock Option schemas
class StockOptionBase(BaseModel):
    shareholder_id: int
    share_class_id: int
    option_type: str = "ISO"  # ISO, NSO
    shares_granted: int
    exercise_price: float
    grant_date: date
    expiration_date: Optional[date] = None
    vesting_schedule: str = "standard_4y_1y_cliff"
    vesting_start_date: Optional[date] = None
    cliff_months: int = 12
    vesting_period_months: int = 48
    custom_vesting_schedule: Optional[str] = None
    allows_early_exercise: bool = False
    notes: Optional[str] = None


class StockOptionCreate(StockOptionBase):
    pass


class StockOptionUpdate(BaseModel):
    shareholder_id: Optional[int] = None
    share_class_id: Optional[int] = None
    option_type: Optional[str] = None
    shares_granted: Optional[int] = None
    exercise_price: Optional[float] = None
    grant_date: Optional[date] = None
    expiration_date: Optional[date] = None
    vesting_schedule: Optional[str] = None
    vesting_start_date: Optional[date] = None
    cliff_months: Optional[int] = None
    vesting_period_months: Optional[int] = None
    custom_vesting_schedule: Optional[str] = None
    shares_exercised: Optional[int] = None
    shares_cancelled: Optional[int] = None
    allows_early_exercise: Optional[bool] = None
    early_exercised_shares: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class StockOptionResponse(StockOptionBase):
    id: int
    shares_exercised: int
    shares_cancelled: int
    early_exercised_shares: int
    status: str
    created_at: datetime
    updated_at: datetime
    # Joined data
    shareholder_name: Optional[str] = None
    share_class_name: Optional[str] = None
    # Computed
    vested_options: Optional[int] = 0
    unvested_options: Optional[int] = 0
    exercisable_options: Optional[int] = 0

    class Config:
        from_attributes = True


# SAFE Note schemas
class SafeNoteBase(BaseModel):
    shareholder_id: int
    safe_type: str = "post_money"  # post_money, pre_money, mfn
    investment_amount: float
    valuation_cap: Optional[float] = None
    discount_rate: Optional[float] = None
    has_mfn: bool = False
    has_pro_rata: bool = False
    signed_date: date
    document_id: Optional[int] = None
    notes: Optional[str] = None


class SafeNoteCreate(SafeNoteBase):
    pass


class SafeNoteUpdate(BaseModel):
    shareholder_id: Optional[int] = None
    safe_type: Optional[str] = None
    investment_amount: Optional[float] = None
    valuation_cap: Optional[float] = None
    discount_rate: Optional[float] = None
    has_mfn: Optional[bool] = None
    has_pro_rata: Optional[bool] = None
    signed_date: Optional[date] = None
    is_converted: Optional[bool] = None
    converted_date: Optional[date] = None
    converted_shares: Optional[int] = None
    converted_share_class_id: Optional[int] = None
    conversion_price: Optional[float] = None
    document_id: Optional[int] = None
    notes: Optional[str] = None


class SafeNoteResponse(SafeNoteBase):
    id: int
    is_converted: bool
    converted_date: Optional[date] = None
    converted_shares: Optional[int] = None
    converted_share_class_id: Optional[int] = None
    conversion_price: Optional[float] = None
    created_at: datetime
    updated_at: datetime
    # Joined
    shareholder_name: Optional[str] = None

    class Config:
        from_attributes = True


# Convertible Note schemas
class ConvertibleNoteBase(BaseModel):
    shareholder_id: int
    principal_amount: float
    interest_rate: float
    valuation_cap: Optional[float] = None
    discount_rate: Optional[float] = None
    issue_date: date
    maturity_date: date
    qualified_financing_amount: Optional[float] = None
    document_id: Optional[int] = None
    notes: Optional[str] = None


class ConvertibleNoteCreate(ConvertibleNoteBase):
    pass


class ConvertibleNoteUpdate(BaseModel):
    shareholder_id: Optional[int] = None
    principal_amount: Optional[float] = None
    interest_rate: Optional[float] = None
    valuation_cap: Optional[float] = None
    discount_rate: Optional[float] = None
    issue_date: Optional[date] = None
    maturity_date: Optional[date] = None
    qualified_financing_amount: Optional[float] = None
    is_converted: Optional[bool] = None
    converted_date: Optional[date] = None
    converted_shares: Optional[int] = None
    converted_share_class_id: Optional[int] = None
    conversion_price: Optional[float] = None
    accrued_interest_at_conversion: Optional[float] = None
    document_id: Optional[int] = None
    notes: Optional[str] = None


class ConvertibleNoteResponse(ConvertibleNoteBase):
    id: int
    is_converted: bool
    converted_date: Optional[date] = None
    converted_shares: Optional[int] = None
    converted_share_class_id: Optional[int] = None
    conversion_price: Optional[float] = None
    accrued_interest_at_conversion: Optional[float] = None
    created_at: datetime
    updated_at: datetime
    # Joined
    shareholder_name: Optional[str] = None
    # Computed
    accrued_interest: Optional[float] = 0.0
    total_owed: Optional[float] = 0.0

    class Config:
        from_attributes = True


# Funding Round schemas
class FundingRoundBase(BaseModel):
    name: str
    round_type: Optional[str] = None  # pre_seed, seed, series_a, etc.
    pre_money_valuation: Optional[float] = None
    post_money_valuation: Optional[float] = None
    amount_raised: Optional[float] = None
    target_amount: Optional[float] = None
    price_per_share: Optional[float] = None
    lead_investor_id: Optional[int] = None
    announced_date: Optional[date] = None
    closed_date: Optional[date] = None
    status: str = "planned"  # planned, in_progress, closed, cancelled
    notes: Optional[str] = None


class FundingRoundCreate(FundingRoundBase):
    pass


class FundingRoundUpdate(BaseModel):
    name: Optional[str] = None
    round_type: Optional[str] = None
    pre_money_valuation: Optional[float] = None
    post_money_valuation: Optional[float] = None
    amount_raised: Optional[float] = None
    target_amount: Optional[float] = None
    price_per_share: Optional[float] = None
    lead_investor_id: Optional[int] = None
    announced_date: Optional[date] = None
    closed_date: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class FundingRoundResponse(FundingRoundBase):
    id: int
    created_at: datetime
    updated_at: datetime
    # Joined
    lead_investor_name: Optional[str] = None

    class Config:
        from_attributes = True


# 409A Valuation Schemas
class Valuation409ABase(BaseModel):
    valuation_date: date
    effective_date: date
    expiration_date: date
    fmv_per_share: float
    total_common_shares: Optional[int] = None
    implied_company_value: Optional[float] = None
    provider_name: Optional[str] = None
    provider_type: str = "external"  # external, internal
    report_document_id: Optional[int] = None
    status: str = "draft"  # draft, pending_review, final, superseded
    valuation_method: Optional[str] = None  # OPM, PWERM, Backsolve
    discount_for_lack_of_marketability: Optional[float] = None
    trigger_event: Optional[str] = None  # annual, funding_round, material_event, initial
    notes: Optional[str] = None


class Valuation409ACreate(Valuation409ABase):
    pass


class Valuation409AUpdate(BaseModel):
    valuation_date: Optional[date] = None
    effective_date: Optional[date] = None
    expiration_date: Optional[date] = None
    fmv_per_share: Optional[float] = None
    total_common_shares: Optional[int] = None
    implied_company_value: Optional[float] = None
    provider_name: Optional[str] = None
    provider_type: Optional[str] = None
    report_document_id: Optional[int] = None
    status: Optional[str] = None
    valuation_method: Optional[str] = None
    discount_for_lack_of_marketability: Optional[float] = None
    trigger_event: Optional[str] = None
    notes: Optional[str] = None


class Valuation409AResponse(Valuation409ABase):
    id: int
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    # Computed fields
    is_expired: Optional[bool] = None
    days_until_expiration: Optional[int] = None
    created_by_name: Optional[str] = None

    class Config:
        from_attributes = True


# Cap Table Summary
class CapTableSummary(BaseModel):
    """Overall cap table summary with ownership breakdown."""
    total_authorized_shares: int
    total_issued_shares: int
    total_outstanding_options: int
    total_reserved_options: int  # Option pool
    fully_diluted_shares: int

    # Ownership by type
    founders_percentage: float
    investors_percentage: float
    employees_percentage: float
    option_pool_percentage: float

    # Valuation
    latest_price_per_share: Optional[float] = None
    implied_valuation: Optional[float] = None

    # Convertibles
    total_safe_amount: float
    total_convertible_amount: float

    # By share class
    share_class_breakdown: List[dict] = []

    # Top shareholders
    top_shareholders: List[dict] = []


class DilutionScenario(BaseModel):
    """What-if modeling for dilution."""
    new_money: float
    pre_money_valuation: float
    option_pool_increase: float = 0.0  # Additional pool %

    # Outputs (computed)
    post_money_valuation: Optional[float] = None
    new_shares_issued: Optional[int] = None
    new_investor_percentage: Optional[float] = None
    founder_dilution: Optional[float] = None
    existing_investor_dilution: Optional[float] = None


# ============ Investor Update Schemas ============

class InvestorUpdateBase(BaseModel):
    title: str
    subject_line: Optional[str] = None
    greeting: Optional[str] = None
    highlights: Optional[List[str]] = None  # Key bullet points
    body_content: Optional[str] = None
    closing: Optional[str] = None
    signature_name: Optional[str] = None
    signature_title: Optional[str] = None
    included_metrics: Optional[List[str]] = None  # ['mrr', 'runway', 'cash', ...]
    recipient_types: Optional[List[str]] = None  # ['investor', 'board_member']
    recipient_ids: Optional[List[int]] = None  # Specific shareholder IDs


class InvestorUpdateCreate(InvestorUpdateBase):
    pass


class InvestorUpdateUpdate(BaseModel):
    title: Optional[str] = None
    subject_line: Optional[str] = None
    greeting: Optional[str] = None
    highlights: Optional[List[str]] = None
    body_content: Optional[str] = None
    closing: Optional[str] = None
    signature_name: Optional[str] = None
    signature_title: Optional[str] = None
    included_metrics: Optional[List[str]] = None
    recipient_types: Optional[List[str]] = None
    recipient_ids: Optional[List[int]] = None
    scheduled_at: Optional[datetime] = None


class InvestorUpdateRecipientResponse(BaseModel):
    id: int
    shareholder_id: Optional[int] = None
    email: str
    name: Optional[str] = None
    status: str
    sent_at: Optional[datetime] = None
    opened_at: Optional[datetime] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class InvestorUpdateResponse(InvestorUpdateBase):
    id: int
    status: str
    scheduled_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    recipient_count: int
    sent_count: int
    failed_count: int
    opened_count: int
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InvestorUpdateWithRecipients(InvestorUpdateResponse):
    recipients: List[InvestorUpdateRecipientResponse] = []


class InvestorUpdatePreview(BaseModel):
    """Preview of what the email will look like."""
    subject: str
    html_content: str
    recipient_count: int
    recipients: List[dict] = []  # [{name, email, type}]


class InvestorUpdateMetrics(BaseModel):
    """Metrics that can be included in an investor update."""
    mrr: Optional[float] = None
    arr: Optional[float] = None
    runway_months: Optional[float] = None
    cash_on_hand: Optional[float] = None
    burn_rate: Optional[float] = None
    customers: Optional[int] = None
    revenue: Optional[float] = None
    growth_rate: Optional[float] = None  # MoM growth %


# ============================================
# DATA ROOM SCHEMAS
# ============================================

class DataRoomFolderBase(BaseModel):
    name: str
    description: Optional[str] = None
    parent_id: Optional[int] = None
    display_order: int = 0
    visibility: str = "internal"  # internal, investors, custom


class DataRoomFolderCreate(DataRoomFolderBase):
    pass


class DataRoomFolderUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[int] = None
    display_order: Optional[int] = None
    visibility: Optional[str] = None
    is_active: Optional[bool] = None


class DataRoomFolderResponse(DataRoomFolderBase):
    id: int
    organization_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    document_count: int = 0

    class Config:
        from_attributes = True


class DataRoomFolderWithChildren(DataRoomFolderResponse):
    children: List["DataRoomFolderWithChildren"] = []
    documents: List["DataRoomDocumentResponse"] = []


class DataRoomDocumentBase(BaseModel):
    document_id: int
    folder_id: Optional[int] = None
    display_name: Optional[str] = None
    display_order: int = 0
    visibility: str = "internal"


class DataRoomDocumentCreate(DataRoomDocumentBase):
    pass


class DataRoomDocumentUpdate(BaseModel):
    folder_id: Optional[int] = None
    display_name: Optional[str] = None
    display_order: Optional[int] = None
    visibility: Optional[str] = None
    is_active: Optional[bool] = None


class DataRoomDocumentResponse(DataRoomDocumentBase):
    id: int
    organization_id: int
    view_count: int
    download_count: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    # From linked document
    document_name: Optional[str] = None
    document_category: Optional[str] = None
    file_path: Optional[str] = None

    class Config:
        from_attributes = True


class ShareableLinkBase(BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None
    folder_id: Optional[int] = None
    document_id: Optional[int] = None
    shareholder_id: Optional[int] = None
    expires_at: Optional[datetime] = None
    access_limit: Optional[int] = None


class ShareableLinkCreate(ShareableLinkBase):
    password: Optional[str] = None  # Plain text, will be hashed


class ShareableLinkUpdate(BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None
    expires_at: Optional[datetime] = None
    access_limit: Optional[int] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None  # New password (optional)


class ShareableLinkResponse(BaseModel):
    id: int
    organization_id: int
    folder_id: Optional[int] = None
    document_id: Optional[int] = None
    shareholder_id: Optional[int] = None
    token: str
    name: Optional[str] = None
    notes: Optional[str] = None
    has_password: bool = False
    expires_at: Optional[datetime] = None
    access_limit: Optional[int] = None
    current_accesses: int
    is_active: bool
    created_by_id: Optional[int] = None
    created_at: datetime
    # Enriched data
    folder_name: Optional[str] = None
    document_name: Optional[str] = None
    shareholder_name: Optional[str] = None
    url: Optional[str] = None

    class Config:
        from_attributes = True


class DataRoomAccessBase(BaseModel):
    folder_id: Optional[int] = None
    document_id: Optional[int] = None
    shareable_link_id: Optional[int] = None
    user_id: Optional[int] = None
    shareholder_id: Optional[int] = None
    access_type: str  # view, download
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class DataRoomAccessResponse(DataRoomAccessBase):
    id: int
    organization_id: int
    created_at: datetime
    # Enriched data
    folder_name: Optional[str] = None
    document_name: Optional[str] = None
    user_email: Optional[str] = None
    shareholder_name: Optional[str] = None

    class Config:
        from_attributes = True


class DataRoomStats(BaseModel):
    """Summary statistics for the data room."""
    total_folders: int
    total_documents: int
    total_views: int
    total_downloads: int
    active_links: int
    recent_accesses: List[DataRoomAccessResponse] = []


class PublicDataRoomView(BaseModel):
    """What external users see when accessing via shareable link."""
    folder_name: Optional[str] = None
    documents: List[dict] = []  # [{id, name, category, can_download}]
    expires_at: Optional[datetime] = None
    requires_password: bool = False
    shareholder_name: Optional[str] = None  # Who this link is for


# Update forward refs
DataRoomFolderWithChildren.model_rebuild()


# ============================================
# BUDGET SCHEMAS
# ============================================

class BudgetCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    parent_id: Optional[int] = None
    display_order: int = 0
    plaid_categories: Optional[List[str]] = None
    merchant_keywords: Optional[List[str]] = None


class BudgetCategoryCreate(BudgetCategoryBase):
    pass


class BudgetCategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    parent_id: Optional[int] = None
    display_order: Optional[int] = None
    plaid_categories: Optional[List[str]] = None
    merchant_keywords: Optional[List[str]] = None
    is_active: Optional[bool] = None


class BudgetCategoryResponse(BudgetCategoryBase):
    id: int
    organization_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BudgetLineItemBase(BaseModel):
    category_id: int
    budgeted_amount: float
    notes: Optional[str] = None


class BudgetLineItemCreate(BudgetLineItemBase):
    pass


class BudgetLineItemUpdate(BaseModel):
    budgeted_amount: Optional[float] = None
    notes: Optional[str] = None


class BudgetLineItemResponse(BudgetLineItemBase):
    id: int
    organization_id: int
    budget_period_id: int
    actual_amount: float
    transaction_count: int
    variance_amount: Optional[float] = None
    variance_percent: Optional[float] = None
    status: str
    last_calculated_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    # Enriched
    category_name: Optional[str] = None
    category_color: Optional[str] = None
    category_icon: Optional[str] = None

    class Config:
        from_attributes = True


class BudgetPeriodBase(BaseModel):
    period_type: str  # monthly, quarterly, annual
    start_date: date
    end_date: date
    name: Optional[str] = None
    notes: Optional[str] = None


class BudgetPeriodCreate(BudgetPeriodBase):
    line_items: Optional[List[BudgetLineItemCreate]] = None


class BudgetPeriodUpdate(BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class BudgetPeriodResponse(BudgetPeriodBase):
    id: int
    organization_id: int
    total_budget: float
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BudgetPeriodWithLineItems(BudgetPeriodResponse):
    line_items: List[BudgetLineItemResponse] = []


class BudgetVarianceReport(BaseModel):
    """Budget vs Actual variance report."""
    period: BudgetPeriodResponse
    total_budgeted: float
    total_actual: float
    total_variance: float
    variance_percent: float
    status: str  # on_track, warning, over
    days_elapsed: int
    days_remaining: int
    percent_through: float
    line_items: List[BudgetLineItemResponse] = []


class BudgetForecast(BaseModel):
    """Projected spending forecast."""
    period: BudgetPeriodResponse
    days_elapsed: int
    days_remaining: int
    percent_through: float
    daily_burn_rate: float
    projected_total: float
    projected_variance: float
    risk_level: str  # safe, warning, critical
    at_risk_categories: List[str] = []


class BudgetSummary(BaseModel):
    """Quick summary for dashboard."""
    current_period: Optional[BudgetPeriodResponse] = None
    total_budgeted: float
    total_spent: float
    remaining: float
    percent_spent: float
    days_remaining: int
    status: str
    top_categories: List[dict] = []  # [{name, spent, budget, percent}]


# ============================================
# INVOICE SCHEMAS
# ============================================

class InvoiceLineItemBase(BaseModel):
    description: str
    quantity: float = 1.0
    unit_price: float
    product_id: Optional[int] = None


class InvoiceLineItemCreate(InvoiceLineItemBase):
    pass


class InvoiceLineItemResponse(InvoiceLineItemBase):
    id: int
    invoice_id: int
    amount: float
    sort_order: int
    created_at: datetime

    class Config:
        from_attributes = True


class InvoicePaymentBase(BaseModel):
    amount: float
    payment_date: date
    payment_method: str
    notes: Optional[str] = None


class InvoicePaymentCreate(InvoicePaymentBase):
    stripe_payment_intent_id: Optional[str] = None


class InvoicePaymentResponse(InvoicePaymentBase):
    id: int
    invoice_id: int
    stripe_payment_intent_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class InvoiceBase(BaseModel):
    contact_id: int
    due_date: date
    notes: Optional[str] = None
    terms: Optional[str] = None
    tax_rate: float = 0.0


class InvoiceCreate(InvoiceBase):
    line_items: List[InvoiceLineItemCreate]


class InvoiceUpdate(BaseModel):
    due_date: Optional[date] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    tax_rate: Optional[float] = None
    status: Optional[str] = None


class InvoiceResponse(BaseModel):
    id: int
    organization_id: int
    business_id: Optional[int] = None
    contact_id: int
    invoice_number: str
    issue_date: date
    due_date: date
    subtotal: float
    tax_rate: float
    tax_amount: float
    total_amount: float
    status: str
    payment_method: Optional[str] = None
    paid_at: Optional[datetime] = None
    paid_amount: float
    notes: Optional[str] = None
    terms: Optional[str] = None
    email_sent_at: Optional[datetime] = None
    viewed_at: Optional[datetime] = None
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    # Enriched data
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_company: Optional[str] = None

    class Config:
        from_attributes = True


class InvoiceWithLineItems(InvoiceResponse):
    line_items: List[InvoiceLineItemResponse] = []
    payments: List[InvoicePaymentResponse] = []


class InvoiceSummary(BaseModel):
    """Invoice dashboard summary."""
    total_outstanding: float
    total_overdue: float
    total_paid_this_month: float
    invoice_count: int
    overdue_count: int
    recent_invoices: List[InvoiceResponse] = []


# ============================================================================
# TEAM MANAGEMENT SCHEMAS
# ============================================================================

# Employee Schemas
class EmployeeBase(BaseModel):
    first_name: str
    last_name: str
    preferred_name: Optional[str] = None
    email: str
    personal_email: Optional[str] = None
    phone: Optional[str] = None
    employee_number: Optional[str] = None
    employment_type: str = "full_time"
    employment_status: str = "active"
    title: Optional[str] = None
    department: Optional[str] = None
    manager_id: Optional[int] = None
    hire_date: Optional[date] = None
    start_date: Optional[date] = None
    salary_cents: Optional[int] = None
    salary_frequency: Optional[str] = None
    hourly_rate_cents: Optional[int] = None
    work_location: Optional[str] = None
    office_location: Optional[str] = None
    timezone: Optional[str] = None
    is_contractor: bool = False
    tax_classification: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    linkedin_url: Optional[str] = None
    notes: Optional[str] = None
    user_id: Optional[int] = None
    shareholder_id: Optional[int] = None
    contact_id: Optional[int] = None


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    preferred_name: Optional[str] = None
    email: Optional[str] = None
    personal_email: Optional[str] = None
    phone: Optional[str] = None
    employee_number: Optional[str] = None
    employment_type: Optional[str] = None
    employment_status: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    manager_id: Optional[int] = None
    hire_date: Optional[date] = None
    start_date: Optional[date] = None
    termination_date: Optional[date] = None
    termination_reason: Optional[str] = None
    salary_cents: Optional[int] = None
    salary_frequency: Optional[str] = None
    hourly_rate_cents: Optional[int] = None
    work_location: Optional[str] = None
    office_location: Optional[str] = None
    timezone: Optional[str] = None
    is_contractor: Optional[bool] = None
    tax_classification: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    linkedin_url: Optional[str] = None
    notes: Optional[str] = None
    user_id: Optional[int] = None
    shareholder_id: Optional[int] = None
    contact_id: Optional[int] = None


class EmployeeResponse(EmployeeBase):
    id: int
    termination_date: Optional[date] = None
    termination_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # Computed/joined fields
    full_name: Optional[str] = None
    manager_name: Optional[str] = None
    direct_report_count: Optional[int] = None

    class Config:
        from_attributes = True


class OrgChartNode(BaseModel):
    """Node in organization chart."""
    id: int
    name: str
    title: Optional[str] = None
    department: Optional[str] = None
    avatar_url: Optional[str] = None
    children: List["OrgChartNode"] = []


OrgChartNode.model_rebuild()


# PTO Schemas
class PTOPolicyBase(BaseModel):
    name: str
    pto_type: str = "vacation"
    description: Optional[str] = None
    annual_days: float = 0
    requires_approval: bool = True
    applies_to_contractors: bool = False
    is_active: bool = True


class PTOPolicyCreate(PTOPolicyBase):
    pass


class PTOPolicyUpdate(BaseModel):
    name: Optional[str] = None
    pto_type: Optional[str] = None
    description: Optional[str] = None
    annual_days: Optional[float] = None
    requires_approval: Optional[bool] = None
    applies_to_contractors: Optional[bool] = None
    is_active: Optional[bool] = None


class PTOPolicyResponse(PTOPolicyBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PTOBalanceResponse(BaseModel):
    id: int
    employee_id: int
    policy_id: int
    available_days: float
    used_days: float
    pending_days: float
    balance_year: int
    policy_name: Optional[str] = None
    policy_type: Optional[str] = None

    class Config:
        from_attributes = True


class PTORequestBase(BaseModel):
    policy_id: int
    start_date: date
    end_date: date
    days_requested: float
    notes: Optional[str] = None


class PTORequestCreate(PTORequestBase):
    pass


class PTORequestUpdate(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    days_requested: Optional[float] = None
    notes: Optional[str] = None


class PTORequestResponse(PTORequestBase):
    id: int
    employee_id: int
    status: str
    reviewed_by_id: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # Joined fields
    employee_name: Optional[str] = None
    policy_name: Optional[str] = None
    reviewed_by_name: Optional[str] = None

    class Config:
        from_attributes = True


class PTOCalendarEntry(BaseModel):
    """Entry for PTO calendar view."""
    employee_id: int
    employee_name: str
    start_date: date
    end_date: date
    days: float
    policy_type: str
    status: str


# Onboarding Schemas
class OnboardingTaskTemplate(BaseModel):
    """Task definition within a template."""
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    due_days: Optional[int] = None
    assignee_type: Optional[str] = None


class OnboardingTemplateBase(BaseModel):
    name: str
    description: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    employment_type: Optional[str] = None
    tasks: List[OnboardingTaskTemplate] = []
    is_default: bool = False
    is_active: bool = True


class OnboardingTemplateCreate(OnboardingTemplateBase):
    pass


class OnboardingTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    employment_type: Optional[str] = None
    tasks: Optional[List[OnboardingTaskTemplate]] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None


class OnboardingTemplateResponse(OnboardingTemplateBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OnboardingTaskResponse(BaseModel):
    id: int
    checklist_id: int
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    due_date: Optional[date] = None
    due_days_after_start: Optional[int] = None
    assignee_type: Optional[str] = None
    assigned_to_id: Optional[int] = None
    is_completed: bool
    completed_at: Optional[datetime] = None
    completed_by_id: Optional[int] = None
    completion_notes: Optional[str] = None
    sort_order: int
    # Joined
    assigned_to_name: Optional[str] = None
    completed_by_name: Optional[str] = None

    class Config:
        from_attributes = True


class OnboardingChecklistBase(BaseModel):
    name: str
    start_date: date
    target_completion_date: Optional[date] = None


class OnboardingChecklistCreate(OnboardingChecklistBase):
    employee_id: int
    template_id: Optional[int] = None


class OnboardingChecklistResponse(OnboardingChecklistBase):
    id: int
    employee_id: int
    template_id: Optional[int] = None
    total_tasks: int
    completed_tasks: int
    is_completed: bool
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    # Joined
    employee_name: Optional[str] = None
    tasks: List[OnboardingTaskResponse] = []
    progress_percent: Optional[float] = None

    class Config:
        from_attributes = True


# Team Summary
class TeamSummary(BaseModel):
    """Team dashboard summary."""
    total_employees: int
    active_employees: int
    contractors: int
    on_leave: int
    pending_pto_requests: int
    active_onboarding: int
    by_department: dict = {}
    recent_hires: List[EmployeeResponse] = []


# ============================================================================
# AI FEATURES SCHEMAS
# ============================================================================

# AI Assistant
class AIDataCard(BaseModel):
    """Structured data display for AI responses."""
    type: str  # metric, chart, table, comparison
    title: str
    value: Optional[str] = None
    trend: Optional[str] = None  # up, down, stable
    data: Optional[dict] = None  # For charts/tables


class AISuggestedAction(BaseModel):
    """Suggested follow-up action."""
    label: str
    action: str  # navigate, query
    target: str  # URL path or follow-up question


class AIChatRequest(BaseModel):
    """Request to AI assistant."""
    message: str
    conversation_id: Optional[int] = None
    context: Optional[dict] = None  # Additional context (current_page, etc.)


class AIChatResponse(BaseModel):
    """Response from AI assistant."""
    response: str
    conversation_id: int
    message_id: int
    data_cards: List[AIDataCard] = []
    suggested_actions: List[AISuggestedAction] = []
    tokens_used: int
    model: str


class AIMessageResponse(BaseModel):
    """Individual AI message."""
    id: int
    role: str
    content: str
    tokens_used: Optional[int] = None
    model_used: Optional[str] = None
    data_cards: Optional[List[AIDataCard]] = None
    suggested_actions: Optional[List[AISuggestedAction]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AIConversationResponse(BaseModel):
    """AI conversation with messages."""
    id: int
    title: Optional[str] = None
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    messages: List[AIMessageResponse] = []

    class Config:
        from_attributes = True


class AIConversationListItem(BaseModel):
    """AI conversation list item (without full messages)."""
    id: int
    title: Optional[str] = None
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    message_count: int = 0
    last_message_preview: Optional[str] = None

    class Config:
        from_attributes = True


class AISuggestionsResponse(BaseModel):
    """Context-aware suggestions for AI assistant."""
    suggestions: List[str]
    context: str


# Document AI
class DocumentSummaryRequest(BaseModel):
    """Request to summarize a document."""
    document_id: int


class ExtractedDate(BaseModel):
    """Date extracted from document."""
    description: str
    date: str  # YYYY-MM-DD
    type: Optional[str] = None  # deadline, milestone, effective_date
    requires_action: bool = False
    confidence: str = "medium"  # high, medium, low
    source_text: Optional[str] = None


class KeyTerm(BaseModel):
    """Key term extracted from document."""
    term: str
    value: str


class DocumentSummaryResponse(BaseModel):
    """AI-generated document summary."""
    id: int
    document_id: int
    summary: Optional[str] = None
    document_type: Optional[str] = None
    key_terms: List[KeyTerm] = []
    extracted_dates: List[ExtractedDate] = []
    action_items: List[str] = []
    risk_flags: List[str] = []
    model_used: Optional[str] = None
    tokens_used: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DeadlineExtractionResponse(BaseModel):
    """Extracted deadlines from document."""
    document_id: int
    deadlines: List[ExtractedDate]
    recurring_dates: List[dict] = []


# Competitor Monitoring
class CompetitorBase(BaseModel):
    """Base competitor schema."""
    name: str
    website: Optional[str] = None
    description: Optional[str] = None
    keywords: Optional[List[str]] = None
    rss_urls: Optional[List[str]] = None
    industry: Optional[str] = None


class CompetitorCreate(CompetitorBase):
    pass


class CompetitorUpdate(BaseModel):
    name: Optional[str] = None
    website: Optional[str] = None
    description: Optional[str] = None
    keywords: Optional[List[str]] = None
    rss_urls: Optional[List[str]] = None
    industry: Optional[str] = None
    is_active: Optional[bool] = None


class CompetitorResponse(CompetitorBase):
    id: int
    is_active: bool
    last_checked_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    update_count: int = 0

    class Config:
        from_attributes = True


class CompetitorUpdateResponse(BaseModel):
    """News/update about a competitor."""
    id: int
    competitor_id: int
    update_type: str
    title: str
    summary: Optional[str] = None
    source_url: Optional[str] = None
    source_name: Optional[str] = None
    relevance_score: Optional[float] = None
    sentiment: Optional[str] = None
    is_read: bool
    is_starred: bool
    published_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CompetitorDigest(BaseModel):
    """Weekly competitor digest."""
    summary: str
    top_developments: List[dict]
    market_trends: List[str]
    action_items: List[str]


# AI Status and Providers
class AIProviderStatus(BaseModel):
    """Status of a single LLM provider."""
    provider: str
    available: bool
    configured: bool
    model: str


class AIProviderUsage(BaseModel):
    """Usage stats for a single provider."""
    requests: int = 0
    tokens: int = 0
    cost: float = 0.0


class AIStatus(BaseModel):
    """AI feature status - multi-provider support."""
    # Legacy field for backwards compatibility
    ollama_available: bool
    model: str

    # Multi-provider fields - dict with provider name as key
    providers: Dict[str, AIProviderStatus] = {}
    preferred_provider: Optional[str] = None
    fallback_enabled: bool = True

    # Usage
    ai_usage_this_month: int
    ai_usage_limit: Optional[int] = None
    usage_by_provider: Dict[str, AIProviderUsage] = {}

    # Features
    features_enabled: dict


class AIProviderPreference(BaseModel):
    """Request to set preferred AI provider."""
    provider: str  # ollama, openai, anthropic


class AIUsageResponse(BaseModel):
    """Detailed AI usage statistics."""
    total_requests: int
    total_tokens: int
    total_cost: float
    by_provider: Dict[str, AIProviderUsage]
    by_feature: Dict[str, int]
    period_start: datetime
    period_end: datetime


# =============================================================================
# TRANSCRIPT ANALYSIS SCHEMAS
# =============================================================================

class TranscriptActionItem(BaseModel):
    """Structured action item extracted from transcript."""
    task: str
    assignee: Optional[str] = None
    due_date: Optional[str] = None
    due_description: Optional[str] = None
    priority: str = "medium"
    context: Optional[str] = None


class TranscriptDecision(BaseModel):
    """Decision extracted from transcript."""
    decision: str
    made_by: Optional[str] = None
    rationale: Optional[str] = None
    conditions: List[str] = []
    follow_ups: List[str] = []


class TranscriptSpeaker(BaseModel):
    """Speaker analysis from transcript."""
    name: str
    word_count: int
    percentage: float
    main_topics: List[str] = []
    sentiment: str = "neutral"


class TranscriptActionItemsResponse(BaseModel):
    """Response for action items extraction."""
    transcript_id: int
    action_items: List[TranscriptActionItem]
    total_count: int


class TranscriptDecisionsResponse(BaseModel):
    """Response for decisions extraction."""
    transcript_id: int
    decisions: List[TranscriptDecision]


class TranscriptSpeakerAnalysisResponse(BaseModel):
    """Response for speaker analysis."""
    transcript_id: int
    speakers: List[TranscriptSpeaker]
    meeting_dynamics: Optional[str] = None
    suggestions: List[str] = []


class TranscriptCreateTasksRequest(BaseModel):
    """Request to create tasks from transcript action items."""
    board_id: int
    action_item_indices: Optional[List[int]] = None  # If None, create all


class TranscriptCreateTasksResponse(BaseModel):
    """Response for creating tasks from transcript."""
    transcript_id: int
    tasks_created: int
    task_ids: List[int]


# ============ Collaboration Schemas ============

# --- Comments ---

class CommentCreate(BaseModel):
    """Create a new comment on any entity."""
    entity_type: str
    entity_id: int
    content: str
    parent_id: Optional[int] = None


class CommentUpdate(BaseModel):
    """Update a comment."""
    content: str


class CommentResponse(BaseModel):
    """Comment response with user info."""
    id: int
    organization_id: int
    entity_type: str
    entity_id: int
    user_id: int
    user: Optional[UserBrief] = None
    content: str
    is_edited: bool
    mentioned_user_ids: Optional[List[int]] = None
    mentioned_users: Optional[List[UserBrief]] = None
    parent_id: Optional[int] = None
    reply_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CommentCountsRequest(BaseModel):
    """Request for batch comment counts."""
    entities: List[dict]  # [{"entity_type": "task", "entity_id": 1}, ...]


class CommentCountsResponse(BaseModel):
    """Response for batch comment counts."""
    counts: dict  # {"task:1": 5, "deadline:2": 3}


# --- Notifications ---

class NotificationResponse(BaseModel):
    """Notification response."""
    id: int
    notification_type: str
    title: str
    message: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    actor: Optional[UserBrief] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    """Paginated notification list."""
    items: List[NotificationResponse]
    unread_count: int
    total_count: int


class MarkNotificationsReadRequest(BaseModel):
    """Mark notifications as read."""
    notification_ids: Optional[List[int]] = None
    all: bool = False


# --- Activity Feed ---

class ActivityResponse(BaseModel):
    """Activity feed item response."""
    id: int
    user_id: int
    user: Optional[UserBrief] = None
    activity_type: str
    description: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    entity_title: Optional[str] = None
    extra_data: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ActivityListResponse(BaseModel):
    """Paginated activity list."""
    items: List[ActivityResponse]
    total_count: int


# --- Guest Users ---

class GuestUserCreate(BaseModel):
    """Invite a guest user."""
    email: str
    name: Optional[str] = None
    guest_type: str = "other"
    permissions: Optional[dict] = None  # {"data_room": ["view"], ...}
    shareholder_id: Optional[int] = None


class GuestUserUpdate(BaseModel):
    """Update a guest user."""
    name: Optional[str] = None
    guest_type: Optional[str] = None
    permissions: Optional[dict] = None
    is_active: Optional[bool] = None


class GuestUserResponse(BaseModel):
    """Guest user response."""
    id: int
    email: str
    name: Optional[str] = None
    guest_type: str
    shareholder_id: Optional[int] = None
    shareholder_name: Optional[str] = None
    permissions: Optional[dict] = None
    is_active: bool
    last_accessed_at: Optional[datetime] = None
    invited_at: datetime
    invite_url: Optional[str] = None

    class Config:
        from_attributes = True


class GuestLoginRequest(BaseModel):
    """Guest login via magic link token."""
    token: str


class GuestLoginResponse(BaseModel):
    """Guest login response."""
    access_token: str
    token_type: str = "bearer"
    guest: GuestUserResponse
