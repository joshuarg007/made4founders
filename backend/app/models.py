from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Enum, Float, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from .database import Base


# ============ MULTI-TENANCY & SUBSCRIPTION ENUMS ============

class SubscriptionTier(str, enum.Enum):
    FREE = "free"
    STARTER = "starter"
    PRO = "pro"
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

    # Settings
    settings = Column(JSON, nullable=True)  # JSON for flexible org settings

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="organization")
    subscription_history = relationship("SubscriptionHistory", back_populates="organization")


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

    provider = Column(String(50), nullable=False)  # quickbooks, xero, freshbooks, wave, zoho
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


# ============ BRANDING MODELS ============

class BrandColor(Base):
    """Brand color palette"""
    __tablename__ = "brand_colors"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(100), nullable=False)  # e.g., "Ocean Blue", "Sunset Orange"
    hex_value = Column(String(7), nullable=False)  # #RRGGBB
    rgb_value = Column(String(20), nullable=True)  # "255, 128, 0"
    hsl_value = Column(String(20), nullable=True)  # "30, 100%, 50%"
    color_type = Column(String(50), default=ColorType.CUSTOM.value)
    sort_order = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class BrandFont(Base):
    """Brand typography"""
    __tablename__ = "brand_fonts"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)

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

    name = Column(String(255), nullable=False)
    asset_type = Column(String(50), default=BrandAssetType.OTHER.value)
    file_path = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=True)  # bytes
    mime_type = Column(String(100), nullable=True)

    # Image dimensions
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)

    # For dark/light variants
    background_type = Column(String(20), nullable=True)  # "dark", "light", "transparent"

    description = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class BrandGuideline(Base):
    """Brand guidelines and voice"""
    __tablename__ = "brand_guidelines"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, unique=True)

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


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
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
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
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
    item_id = Column(String(100), nullable=False)  # matches frontend item IDs
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
    hashed_password = Column(String(255), nullable=True)  # Nullable for OAuth-only users
    name = Column(String(255), nullable=True)
    role = Column(String(50), default=UserRole.VIEWER.value)
    is_active = Column(Boolean, default=True)
    calendar_token = Column(String(64), unique=True, nullable=True, index=True)  # For iCal feed auth

    # Multi-tenancy
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    is_org_owner = Column(Boolean, default=False)  # Organization owner/creator

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

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="users")


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
