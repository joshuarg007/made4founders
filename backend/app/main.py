from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List
import os
import shutil

from .database import engine, get_db, Base
from .models import Service, Document, Contact, Deadline, BusinessInfo, BusinessIdentifier, ChecklistProgress, User, VaultConfig, Credential
from .auth import router as auth_router
from .schemas import (
    ServiceCreate, ServiceUpdate, ServiceResponse,
    DocumentCreate, DocumentUpdate, DocumentResponse,
    ContactCreate, ContactUpdate, ContactResponse,
    DeadlineCreate, DeadlineUpdate, DeadlineResponse,
    DashboardStats,
    BusinessInfoCreate, BusinessInfoUpdate, BusinessInfoResponse,
    BusinessIdentifierCreate, BusinessIdentifierUpdate, BusinessIdentifierResponse, BusinessIdentifierMasked,
    ChecklistProgressCreate, ChecklistProgressUpdate, ChecklistProgressResponse,
    VaultSetup, VaultUnlock, VaultStatus,
    CredentialCreate, CredentialUpdate, CredentialMasked, CredentialDecrypted
)
from .vault import (
    generate_salt, derive_key, hash_master_password, verify_master_password,
    encrypt_value, decrypt_value, VaultSession
)

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="FounderOS API", version="1.0.0")

# CORS - configure from environment
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:3000,https://founder.axiondeep.com")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in CORS_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Include auth router
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])


# ============ Dashboard ============
@app.get("/api/dashboard/stats", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    thirty_days = now + timedelta(days=30)

    return DashboardStats(
        total_services=db.query(Service).count(),
        total_documents=db.query(Document).count(),
        total_contacts=db.query(Contact).count(),
        upcoming_deadlines=db.query(Deadline).filter(
            Deadline.is_completed == False,
            Deadline.due_date >= now,
            Deadline.due_date <= thirty_days
        ).count(),
        expiring_documents=db.query(Document).filter(
            Document.expiration_date != None,
            Document.expiration_date <= thirty_days
        ).count(),
        overdue_deadlines=db.query(Deadline).filter(
            Deadline.is_completed == False,
            Deadline.due_date < now
        ).count()
    )


# ============ Services ============
@app.get("/api/services", response_model=List[ServiceResponse])
def get_services(category: str = None, db: Session = Depends(get_db)):
    query = db.query(Service)
    if category:
        query = query.filter(Service.category == category)
    return query.order_by(Service.is_favorite.desc(), Service.name).all()


@app.post("/api/services", response_model=ServiceResponse)
def create_service(service: ServiceCreate, db: Session = Depends(get_db)):
    db_service = Service(**service.model_dump())
    db.add(db_service)
    db.commit()
    db.refresh(db_service)
    return db_service


@app.get("/api/services/{service_id}", response_model=ServiceResponse)
def get_service(service_id: int, db: Session = Depends(get_db)):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return service


@app.patch("/api/services/{service_id}", response_model=ServiceResponse)
def update_service(service_id: int, service: ServiceUpdate, db: Session = Depends(get_db)):
    db_service = db.query(Service).filter(Service.id == service_id).first()
    if not db_service:
        raise HTTPException(status_code=404, detail="Service not found")

    for key, value in service.model_dump(exclude_unset=True).items():
        setattr(db_service, key, value)

    db.commit()
    db.refresh(db_service)
    return db_service


@app.delete("/api/services/{service_id}")
def delete_service(service_id: int, db: Session = Depends(get_db)):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    db.delete(service)
    db.commit()
    return {"ok": True}


@app.post("/api/services/{service_id}/visit")
def record_service_visit(service_id: int, db: Session = Depends(get_db)):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    service.last_visited = datetime.utcnow()
    db.commit()
    return {"ok": True}


# ============ Documents ============
@app.get("/api/documents", response_model=List[DocumentResponse])
def get_documents(category: str = None, db: Session = Depends(get_db)):
    query = db.query(Document)
    if category:
        query = query.filter(Document.category == category)
    return query.order_by(Document.created_at.desc()).all()


@app.post("/api/documents", response_model=DocumentResponse)
def create_document(document: DocumentCreate, db: Session = Depends(get_db)):
    db_document = Document(**document.model_dump())
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    return db_document


@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Save file
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Create document record
    db_document = Document(
        name=file.filename,
        file_path=f"/uploads/{file.filename}",
        category="other"
    )
    db.add(db_document)
    db.commit()
    db.refresh(db_document)
    return db_document


@app.get("/api/documents/{document_id}", response_model=DocumentResponse)
def get_document(document_id: int, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@app.patch("/api/documents/{document_id}", response_model=DocumentResponse)
def update_document(document_id: int, document: DocumentUpdate, db: Session = Depends(get_db)):
    db_document = db.query(Document).filter(Document.id == document_id).first()
    if not db_document:
        raise HTTPException(status_code=404, detail="Document not found")

    for key, value in document.model_dump(exclude_unset=True).items():
        setattr(db_document, key, value)

    db.commit()
    db.refresh(db_document)
    return db_document


@app.delete("/api/documents/{document_id}")
def delete_document(document_id: int, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(document)
    db.commit()
    return {"ok": True}


# ============ Contacts ============
@app.get("/api/contacts", response_model=List[ContactResponse])
def get_contacts(contact_type: str = None, db: Session = Depends(get_db)):
    query = db.query(Contact)
    if contact_type:
        query = query.filter(Contact.contact_type == contact_type)
    return query.order_by(Contact.name).all()


@app.post("/api/contacts", response_model=ContactResponse)
def create_contact(contact: ContactCreate, db: Session = Depends(get_db)):
    db_contact = Contact(**contact.model_dump())
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)
    return db_contact


@app.get("/api/contacts/{contact_id}", response_model=ContactResponse)
def get_contact(contact_id: int, db: Session = Depends(get_db)):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


@app.patch("/api/contacts/{contact_id}", response_model=ContactResponse)
def update_contact(contact_id: int, contact: ContactUpdate, db: Session = Depends(get_db)):
    db_contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not db_contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    for key, value in contact.model_dump(exclude_unset=True).items():
        setattr(db_contact, key, value)

    db.commit()
    db.refresh(db_contact)
    return db_contact


@app.delete("/api/contacts/{contact_id}")
def delete_contact(contact_id: int, db: Session = Depends(get_db)):
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
    db: Session = Depends(get_db)
):
    query = db.query(Deadline)
    if deadline_type:
        query = query.filter(Deadline.deadline_type == deadline_type)
    if not include_completed:
        query = query.filter(Deadline.is_completed == False)
    return query.order_by(Deadline.due_date).all()


@app.post("/api/deadlines", response_model=DeadlineResponse)
def create_deadline(deadline: DeadlineCreate, db: Session = Depends(get_db)):
    db_deadline = Deadline(**deadline.model_dump())
    db.add(db_deadline)
    db.commit()
    db.refresh(db_deadline)
    return db_deadline


@app.get("/api/deadlines/{deadline_id}", response_model=DeadlineResponse)
def get_deadline(deadline_id: int, db: Session = Depends(get_db)):
    deadline = db.query(Deadline).filter(Deadline.id == deadline_id).first()
    if not deadline:
        raise HTTPException(status_code=404, detail="Deadline not found")
    return deadline


@app.patch("/api/deadlines/{deadline_id}", response_model=DeadlineResponse)
def update_deadline(deadline_id: int, deadline: DeadlineUpdate, db: Session = Depends(get_db)):
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
def delete_deadline(deadline_id: int, db: Session = Depends(get_db)):
    deadline = db.query(Deadline).filter(Deadline.id == deadline_id).first()
    if not deadline:
        raise HTTPException(status_code=404, detail="Deadline not found")
    db.delete(deadline)
    db.commit()
    return {"ok": True}


@app.post("/api/deadlines/{deadline_id}/complete")
def complete_deadline(deadline_id: int, db: Session = Depends(get_db)):
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
    return {"status": "ok", "service": "founderos"}


# ============ Daily Brief ============
@app.get("/api/daily-brief")
def get_daily_brief(db: Session = Depends(get_db)):
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

    # Build the brief
    overdue = [format_deadline(d) for d in overdue_deadlines] + [format_document(d) for d in expired_documents]
    today = [format_deadline(d) for d in today_deadlines]
    this_week = [format_deadline(d) for d in week_deadlines] + [format_document(d) for d in expiring_this_week]
    heads_up = [format_deadline(d) for d in upcoming_deadlines] + [format_document(d) for d in expiring_soon]
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
def get_business_info(db: Session = Depends(get_db)):
    info = db.query(BusinessInfo).first()
    if not info:
        # Create default record if none exists
        info = BusinessInfo()
        db.add(info)
        db.commit()
        db.refresh(info)
    return info


@app.put("/api/business-info", response_model=BusinessInfoResponse)
def update_business_info(info: BusinessInfoUpdate, db: Session = Depends(get_db)):
    db_info = db.query(BusinessInfo).first()
    if not db_info:
        db_info = BusinessInfo()
        db.add(db_info)

    for key, value in info.model_dump(exclude_unset=True).items():
        setattr(db_info, key, value)

    db.commit()
    db.refresh(db_info)
    return db_info


# ============ Business Identifiers ============
def mask_identifier(value: str, identifier_type: str) -> str:
    """Mask sensitive identifier values, showing only last few characters"""
    if not value:
        return ""
    if identifier_type == "ein":
        # EIN format: XX-XXXXXXX, show last 4: XX-XXX1234
        if len(value) >= 4:
            return "XX-XXX" + value[-4:]
        return "X" * len(value)
    elif identifier_type == "duns":
        # D-U-N-S format: XX-XXX-XXXX, show last 4
        if len(value) >= 4:
            return "XX-XXX-" + value[-4:]
        return "X" * len(value)
    else:
        # Generic masking - show last 4 if long enough
        if len(value) > 4:
            return "X" * (len(value) - 4) + value[-4:]
        return "X" * len(value)


@app.get("/api/business-identifiers", response_model=List[BusinessIdentifierMasked])
def get_business_identifiers(db: Session = Depends(get_db)):
    identifiers = db.query(BusinessIdentifier).order_by(BusinessIdentifier.identifier_type).all()
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
def get_business_identifier(identifier_id: int, db: Session = Depends(get_db)):
    """Get full (unmasked) identifier - use with caution"""
    ident = db.query(BusinessIdentifier).filter(BusinessIdentifier.id == identifier_id).first()
    if not ident:
        raise HTTPException(status_code=404, detail="Identifier not found")
    return ident


@app.get("/api/business-identifiers/{identifier_id}/value")
def get_business_identifier_value(identifier_id: int, db: Session = Depends(get_db)):
    """Get just the value for copying"""
    ident = db.query(BusinessIdentifier).filter(BusinessIdentifier.id == identifier_id).first()
    if not ident:
        raise HTTPException(status_code=404, detail="Identifier not found")
    return {"value": ident.value}


@app.post("/api/business-identifiers", response_model=BusinessIdentifierResponse)
def create_business_identifier(identifier: BusinessIdentifierCreate, db: Session = Depends(get_db)):
    db_ident = BusinessIdentifier(**identifier.model_dump())
    db.add(db_ident)
    db.commit()
    db.refresh(db_ident)
    return db_ident


@app.patch("/api/business-identifiers/{identifier_id}", response_model=BusinessIdentifierResponse)
def update_business_identifier(identifier_id: int, identifier: BusinessIdentifierUpdate, db: Session = Depends(get_db)):
    db_ident = db.query(BusinessIdentifier).filter(BusinessIdentifier.id == identifier_id).first()
    if not db_ident:
        raise HTTPException(status_code=404, detail="Identifier not found")

    for key, value in identifier.model_dump(exclude_unset=True).items():
        setattr(db_ident, key, value)

    db.commit()
    db.refresh(db_ident)
    return db_ident


@app.delete("/api/business-identifiers/{identifier_id}")
def delete_business_identifier(identifier_id: int, db: Session = Depends(get_db)):
    ident = db.query(BusinessIdentifier).filter(BusinessIdentifier.id == identifier_id).first()
    if not ident:
        raise HTTPException(status_code=404, detail="Identifier not found")
    db.delete(ident)
    db.commit()
    return {"ok": True}


# ============ Checklist Progress ============
@app.get("/api/checklist", response_model=List[ChecklistProgressResponse])
def get_checklist_progress(db: Session = Depends(get_db)):
    return db.query(ChecklistProgress).all()


@app.get("/api/checklist/bulk")
def get_checklist_progress_bulk(db: Session = Depends(get_db)):
    """Get all checklist items as a dict keyed by item_id"""
    items = db.query(ChecklistProgress).all()
    return {"items": {item.item_id: ChecklistProgressResponse.model_validate(item).model_dump() for item in items}}


@app.get("/api/checklist/{item_id}", response_model=ChecklistProgressResponse)
def get_checklist_item(item_id: str, db: Session = Depends(get_db)):
    item = db.query(ChecklistProgress).filter(ChecklistProgress.item_id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    return item


@app.post("/api/checklist", response_model=ChecklistProgressResponse)
def create_or_update_checklist_item(progress: ChecklistProgressCreate, db: Session = Depends(get_db)):
    # Check if item already exists
    existing = db.query(ChecklistProgress).filter(ChecklistProgress.item_id == progress.item_id).first()

    if existing:
        # Update existing
        for key, value in progress.model_dump(exclude_unset=True).items():
            setattr(existing, key, value)
        if progress.is_completed and not existing.completed_at:
            existing.completed_at = datetime.utcnow()
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
        return db_item


@app.patch("/api/checklist/{item_id}", response_model=ChecklistProgressResponse)
def update_checklist_item(item_id: str, progress: ChecklistProgressUpdate, db: Session = Depends(get_db)):
    db_item = db.query(ChecklistProgress).filter(ChecklistProgress.item_id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Checklist item not found")

    update_data = progress.model_dump(exclude_unset=True)

    if update_data.get("is_completed") and not db_item.is_completed:
        update_data["completed_at"] = datetime.utcnow()
    elif update_data.get("is_completed") is False:
        update_data["completed_at"] = None

    for key, value in update_data.items():
        setattr(db_item, key, value)

    db.commit()
    db.refresh(db_item)
    return db_item


@app.delete("/api/checklist/{item_id}")
def delete_checklist_item(item_id: str, db: Session = Depends(get_db)):
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
def get_vault_status(db: Session = Depends(get_db)):
    """Check if vault is set up and unlocked."""
    config = db.query(VaultConfig).first()
    session_id = get_session_id()
    return VaultStatus(
        is_setup=config is not None,
        is_unlocked=VaultSession.is_unlocked(session_id)
    )


@app.post("/api/vault/setup", response_model=VaultStatus)
def setup_vault(setup: VaultSetup, db: Session = Depends(get_db)):
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
def unlock_vault(unlock: VaultUnlock, db: Session = Depends(get_db)):
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
def lock_vault(db: Session = Depends(get_db)):
    """Lock the vault."""
    session_id = get_session_id()
    VaultSession.lock(session_id)
    config = db.query(VaultConfig).first()
    return VaultStatus(is_setup=config is not None, is_unlocked=False)


@app.delete("/api/vault/reset")
def reset_vault(db: Session = Depends(get_db)):
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
def get_credentials(db: Session = Depends(get_db)):
    """Get all credentials (masked - doesn't require unlock)."""
    credentials = db.query(Credential).order_by(Credential.name).all()
    return [
        CredentialMasked(
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
            created_at=c.created_at,
            updated_at=c.updated_at
        )
        for c in credentials
    ]


@app.get("/api/credentials/{credential_id}", response_model=CredentialDecrypted)
def get_credential(credential_id: int, key: bytes = Depends(require_vault_unlocked), db: Session = Depends(get_db)):
    """Get a single credential with decrypted values (requires unlock)."""
    credential = db.query(Credential).filter(Credential.id == credential_id).first()
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")

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
        created_at=credential.created_at,
        updated_at=credential.updated_at
    )


@app.post("/api/credentials", response_model=CredentialMasked)
def create_credential(credential: CredentialCreate, key: bytes = Depends(require_vault_unlocked), db: Session = Depends(get_db)):
    """Create a new credential (requires unlock)."""
    db_credential = Credential(
        name=credential.name,
        service_url=credential.service_url,
        category=credential.category,
        icon=credential.icon,
        related_service_id=credential.related_service_id,
        encrypted_username=encrypt_value(credential.username, key) if credential.username else None,
        encrypted_password=encrypt_value(credential.password, key) if credential.password else None,
        encrypted_notes=encrypt_value(credential.notes, key) if credential.notes else None,
        encrypted_totp_secret=encrypt_value(credential.totp_secret, key) if credential.totp_secret else None
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
def copy_credential_field(credential_id: int, field: str, key: bytes = Depends(require_vault_unlocked), db: Session = Depends(get_db)):
    """Get a single decrypted field for copying (requires unlock)."""
    if field not in ['username', 'password', 'notes', 'totp_secret']:
        raise HTTPException(status_code=400, detail="Invalid field")

    credential = db.query(Credential).filter(Credential.id == credential_id).first()
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")

    encrypted_field = f"encrypted_{field}"
    encrypted_value = getattr(credential, encrypted_field)

    if not encrypted_value:
        return {"value": None}

    return {"value": decrypt_value(encrypted_value, key)}
