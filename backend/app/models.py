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
