from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
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
    WebPresence, BankAccount
)
from .auth import router as auth_router, get_current_user
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
    BankAccountCreate, BankAccountUpdate, BankAccountResponse
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

app = FastAPI(
    title="FounderOS API",
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
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:3000,https://founders.axiondeep.com")
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
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
# NOTE: Static file mount removed for security - use /api/documents/{id}/download instead

# Include auth router
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])

# Startup validation
@app.on_event("startup")
async def startup_validation():
    """Validate security configuration on startup."""
    secret_key = os.getenv("SECRET_KEY", "")
    if not secret_key or secret_key == "founderos-dev-secret-change-in-production":
        if os.getenv("ENVIRONMENT") == "production":
            logger.error("CRITICAL: Using default SECRET_KEY in production!")
        else:
            logger.warning("Using default SECRET_KEY - set SECRET_KEY env var for production")

    app_key = os.getenv("APP_ENCRYPTION_KEY", "")
    if not app_key and os.getenv("ENVIRONMENT") == "production":
        logger.warning("APP_ENCRYPTION_KEY not set - using derived key")

    logger.info("FounderOS API started with security middleware enabled")


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
def get_documents(category: str = None, db: Session = Depends(get_db)):
    query = db.query(Document)
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
def create_document(document: DocumentCreate, db: Session = Depends(get_db)):
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


@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Secure file upload with validation.
    - Auth required
    - File extension whitelist
    - Filename sanitization
    - Unique storage name to prevent overwrites
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

    # Create document record (store original name for display, storage name for retrieval)
    db_document = Document(
        name=file.filename,
        file_path=storage_name,  # Now stores just the filename, not a URL path
        category="other"
    )
    db.add(db_document)
    db.commit()
    db.refresh(db_document)

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
def create_credential(credential: CredentialCreate, key: bytes = Depends(require_vault_unlocked), db: Session = Depends(get_db)):
    """Create a new credential (requires unlock)."""
    # Encrypt custom fields if present
    encrypted_custom_fields = None
    if credential.custom_fields:
        custom_fields_json = json.dumps([cf.model_dump() for cf in credential.custom_fields])
        encrypted_custom_fields = encrypt_value(custom_fields_json, key)

    db_credential = Credential(
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
            custom_fields_json = json.dumps([cf.model_dump() for cf in update_data['custom_fields']])
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
def get_products_offered(category: str = None, db: Session = Depends(get_db)):
    query = db.query(ProductOffered)
    if category:
        query = query.filter(ProductOffered.category == category)
    return query.order_by(ProductOffered.name).all()


@app.post("/api/products-offered", response_model=ProductOfferedResponse)
def create_product_offered(product: ProductOfferedCreate, db: Session = Depends(get_db)):
    db_product = ProductOffered(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


@app.get("/api/products-offered/{product_id}", response_model=ProductOfferedResponse)
def get_product_offered(product_id: int, db: Session = Depends(get_db)):
    product = db.query(ProductOffered).filter(ProductOffered.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@app.patch("/api/products-offered/{product_id}", response_model=ProductOfferedResponse)
def update_product_offered(product_id: int, product: ProductOfferedUpdate, db: Session = Depends(get_db)):
    db_product = db.query(ProductOffered).filter(ProductOffered.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    for key, value in product.model_dump(exclude_unset=True).items():
        setattr(db_product, key, value)

    db.commit()
    db.refresh(db_product)
    return db_product


@app.delete("/api/products-offered/{product_id}")
def delete_product_offered(product_id: int, db: Session = Depends(get_db)):
    product = db.query(ProductOffered).filter(ProductOffered.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
    return {"ok": True}


# ============ Products Used ============
@app.get("/api/products-used", response_model=List[ProductUsedResponse])
def get_products_used(category: str = None, is_paid: bool = None, db: Session = Depends(get_db)):
    query = db.query(ProductUsed)
    if category:
        query = query.filter(ProductUsed.category == category)
    if is_paid is not None:
        query = query.filter(ProductUsed.is_paid == is_paid)
    return query.order_by(ProductUsed.name).all()


@app.post("/api/products-used", response_model=ProductUsedResponse)
def create_product_used(product: ProductUsedCreate, db: Session = Depends(get_db)):
    db_product = ProductUsed(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


@app.get("/api/products-used/{product_id}", response_model=ProductUsedResponse)
def get_product_used(product_id: int, db: Session = Depends(get_db)):
    product = db.query(ProductUsed).filter(ProductUsed.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@app.patch("/api/products-used/{product_id}", response_model=ProductUsedResponse)
def update_product_used(product_id: int, product: ProductUsedUpdate, db: Session = Depends(get_db)):
    db_product = db.query(ProductUsed).filter(ProductUsed.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    for key, value in product.model_dump(exclude_unset=True).items():
        setattr(db_product, key, value)

    db.commit()
    db.refresh(db_product)
    return db_product


@app.delete("/api/products-used/{product_id}")
def delete_product_used(product_id: int, db: Session = Depends(get_db)):
    product = db.query(ProductUsed).filter(ProductUsed.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
    return {"ok": True}


# ============ Web Links ============
@app.get("/api/web-links", response_model=List[WebLinkResponse])
def get_web_links(category: str = None, db: Session = Depends(get_db)):
    query = db.query(WebLink)
    if category:
        query = query.filter(WebLink.category == category)
    return query.order_by(WebLink.is_favorite.desc(), WebLink.title).all()


@app.post("/api/web-links", response_model=WebLinkResponse)
def create_web_link(link: WebLinkCreate, db: Session = Depends(get_db)):
    db_link = WebLink(**link.model_dump())
    db.add(db_link)
    db.commit()
    db.refresh(db_link)
    return db_link


@app.get("/api/web-links/{link_id}", response_model=WebLinkResponse)
def get_web_link(link_id: int, db: Session = Depends(get_db)):
    link = db.query(WebLink).filter(WebLink.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Web link not found")
    return link


@app.patch("/api/web-links/{link_id}", response_model=WebLinkResponse)
def update_web_link(link_id: int, link: WebLinkUpdate, db: Session = Depends(get_db)):
    db_link = db.query(WebLink).filter(WebLink.id == link_id).first()
    if not db_link:
        raise HTTPException(status_code=404, detail="Web link not found")

    for key, value in link.model_dump(exclude_unset=True).items():
        setattr(db_link, key, value)

    db.commit()
    db.refresh(db_link)
    return db_link


@app.delete("/api/web-links/{link_id}")
def delete_web_link(link_id: int, db: Session = Depends(get_db)):
    link = db.query(WebLink).filter(WebLink.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Web link not found")
    db.delete(link)
    db.commit()
    return {"ok": True}


@app.post("/api/web-links/{link_id}/visit")
def record_web_link_visit(link_id: int, db: Session = Depends(get_db)):
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
    """Get all boards."""
    boards = db.query(TaskBoard).order_by(TaskBoard.is_default.desc(), TaskBoard.name).all()

    # If no boards exist, create a default one
    if not boards:
        default_board = TaskBoard(
            name="Main Board",
            description="Default task board",
            is_default=True,
            created_by_id=current_user.id
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
    db_board = TaskBoard(**board.model_dump(), created_by_id=current_user.id)
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
    """Get tasks with filters."""
    query = db.query(Task)
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
    query = db.query(Metric)
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
    db_metric = Metric(**metric.model_dump(), created_by_id=current_user.id)
    db.add(db_metric)
    db.commit()
    db.refresh(db_metric)
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


# ============ WEB PRESENCE ROUTES ============

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
        "additional_emails": json.loads(presence.additional_emails) if presence.additional_emails else None,
        "website_url": presence.website_url,
        "website_platform": presence.website_platform,
        "website_hosting": presence.website_hosting,
        "ssl_enabled": presence.ssl_enabled,
        "additional_websites": json.loads(presence.additional_websites) if presence.additional_websites else None,
        "linkedin_url": presence.linkedin_url,
        "twitter_url": presence.twitter_url,
        "instagram_url": presence.instagram_url,
        "facebook_url": presence.facebook_url,
        "youtube_url": presence.youtube_url,
        "github_url": presence.github_url,
        "tiktok_url": presence.tiktok_url,
        "additional_socials": json.loads(presence.additional_socials) if presence.additional_socials else None,
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
        "additional_listings": json.loads(presence.additional_listings) if presence.additional_listings else None,
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
            value = json.dumps([item.model_dump() if hasattr(item, 'model_dump') else item for item in value])
        setattr(presence, key, value)

    db.commit()
    db.refresh(presence)
    return serialize_web_presence(presence)


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
