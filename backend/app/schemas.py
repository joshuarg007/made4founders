from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


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


class DocumentResponse(DocumentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Contact schemas
class ContactBase(BaseModel):
    name: str
    title: Optional[str] = None  # Job title
    company: Optional[str] = None
    contact_type: str = "other"
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
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
    phone: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
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
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserMe(BaseModel):
    email: str
    name: Optional[str]


# Vault schemas
class VaultSetup(BaseModel):
    master_password: str


class VaultUnlock(BaseModel):
    master_password: str


class VaultStatus(BaseModel):
    is_setup: bool
    is_unlocked: bool


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


class CredentialUpdate(BaseModel):
    name: Optional[str] = None
    service_url: Optional[str] = None
    category: Optional[str] = None
    icon: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    notes: Optional[str] = None
    totp_secret: Optional[str] = None
    related_service_id: Optional[int] = None


class CredentialMasked(CredentialBase):
    """Credential with masked sensitive fields (when vault is locked)"""
    id: int
    has_username: bool
    has_password: bool
    has_notes: bool
    has_totp: bool
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
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
