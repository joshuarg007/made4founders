from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from .database import Base


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


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
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
    name = Column(String(255), nullable=False)
    title = Column(String(255), nullable=True)  # Job title
    company = Column(String(255), nullable=True)
    contact_type = Column(String(50), default=ContactType.OTHER.value)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    website = Column(String(500), nullable=True)
    responsibilities = Column(Text, nullable=True)  # What this contact handles for you
    notes = Column(Text, nullable=True)
    last_contacted = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Deadline(Base):
    __tablename__ = "deadlines"

    id = Column(Integer, primary_key=True, index=True)
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
    item_id = Column(String(100), nullable=False, unique=True)  # matches frontend item IDs
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


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"


class User(Base):
    """User authentication"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(255), nullable=True)
    role = Column(String(50), default=UserRole.VIEWER.value)
    is_active = Column(Boolean, default=True)
    calendar_token = Column(String(64), unique=True, nullable=True, index=True)  # For iCal feed auth
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class VaultConfig(Base):
    """Vault master password configuration"""
    __tablename__ = "vault_config"

    id = Column(Integer, primary_key=True, index=True)
    master_password_hash = Column(String(255), nullable=False)  # bcrypt hash
    salt = Column(String(255), nullable=False)  # For key derivation
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Credential(Base):
    """Encrypted credential storage"""
    __tablename__ = "credentials"

    id = Column(Integer, primary_key=True, index=True)
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
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WebLink(Base):
    """Important web links and bookmarks"""
    __tablename__ = "web_links"

    id = Column(Integer, primary_key=True, index=True)
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
