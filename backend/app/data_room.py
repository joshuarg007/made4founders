"""
Data Room API - Secure document sharing for fundraising.

Features:
- Folder organization
- Shareable links with optional password/expiry
- Access tracking and analytics
- Integration with shareholders
"""

import secrets
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func

from .database import get_db
from .auth import get_current_user
from .security import pwd_context
from .models import (
    User, Document, Shareholder,
    DataRoomFolder, DataRoomDocument, ShareableLink, DataRoomAccess
)
from .schemas import (
    DataRoomFolderCreate, DataRoomFolderUpdate, DataRoomFolderResponse, DataRoomFolderWithChildren,
    DataRoomDocumentCreate, DataRoomDocumentUpdate, DataRoomDocumentResponse,
    ShareableLinkCreate, ShareableLinkUpdate, ShareableLinkResponse,
    DataRoomAccessResponse, DataRoomStats, PublicDataRoomView
)

router = APIRouter(prefix="/api/data-room", tags=["Data Room"])


# ============================================
# FOLDER ENDPOINTS
# ============================================

@router.get("/folders", response_model=List[DataRoomFolderResponse])
def list_folders(
    parent_id: Optional[int] = Query(None, description="Filter by parent folder"),
    include_inactive: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all folders (optionally filtered by parent)."""
    query = db.query(DataRoomFolder).filter(
        DataRoomFolder.organization_id == current_user.organization_id
    )

    if parent_id is not None:
        query = query.filter(DataRoomFolder.parent_id == parent_id)
    else:
        query = query.filter(DataRoomFolder.parent_id.is_(None))  # Root folders only

    if not include_inactive:
        query = query.filter(DataRoomFolder.is_active == True)

    folders = query.order_by(DataRoomFolder.display_order, DataRoomFolder.name).all()

    # Add document count
    result = []
    for folder in folders:
        folder_dict = {
            "id": folder.id,
            "organization_id": folder.organization_id,
            "name": folder.name,
            "description": folder.description,
            "parent_id": folder.parent_id,
            "display_order": folder.display_order,
            "visibility": folder.visibility,
            "is_active": folder.is_active,
            "created_at": folder.created_at,
            "updated_at": folder.updated_at,
            "document_count": db.query(DataRoomDocument).filter(
                DataRoomDocument.folder_id == folder.id,
                DataRoomDocument.is_active == True
            ).count()
        }
        result.append(folder_dict)

    return result


@router.get("/folders/tree", response_model=List[DataRoomFolderWithChildren])
def get_folder_tree(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get full folder tree with nested children and documents."""

    def build_tree(parent_id: Optional[int] = None) -> List[dict]:
        folders = db.query(DataRoomFolder).filter(
            DataRoomFolder.organization_id == current_user.organization_id,
            DataRoomFolder.parent_id == parent_id,
            DataRoomFolder.is_active == True
        ).order_by(DataRoomFolder.display_order, DataRoomFolder.name).all()

        result = []
        for folder in folders:
            # Get documents in this folder
            docs = db.query(DataRoomDocument).filter(
                DataRoomDocument.folder_id == folder.id,
                DataRoomDocument.is_active == True
            ).order_by(DataRoomDocument.display_order).all()

            doc_list = []
            for doc in docs:
                document = doc.document
                doc_list.append({
                    "id": doc.id,
                    "organization_id": doc.organization_id,
                    "document_id": doc.document_id,
                    "folder_id": doc.folder_id,
                    "display_name": doc.display_name,
                    "display_order": doc.display_order,
                    "visibility": doc.visibility,
                    "view_count": doc.view_count,
                    "download_count": doc.download_count,
                    "is_active": doc.is_active,
                    "created_at": doc.created_at,
                    "updated_at": doc.updated_at,
                    "document_name": document.name if document else None,
                    "document_category": document.category if document else None,
                    "file_path": document.file_path if document else None,
                })

            folder_dict = {
                "id": folder.id,
                "organization_id": folder.organization_id,
                "name": folder.name,
                "description": folder.description,
                "parent_id": folder.parent_id,
                "display_order": folder.display_order,
                "visibility": folder.visibility,
                "is_active": folder.is_active,
                "created_at": folder.created_at,
                "updated_at": folder.updated_at,
                "document_count": len(doc_list),
                "children": build_tree(folder.id),
                "documents": doc_list
            }
            result.append(folder_dict)

        return result

    return build_tree()


@router.post("/folders", response_model=DataRoomFolderResponse)
def create_folder(
    folder: DataRoomFolderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new folder."""
    # Validate parent folder if specified
    if folder.parent_id:
        parent = db.query(DataRoomFolder).filter(
            DataRoomFolder.id == folder.parent_id,
            DataRoomFolder.organization_id == current_user.organization_id
        ).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent folder not found")

    db_folder = DataRoomFolder(
        organization_id=current_user.organization_id,
        **folder.model_dump()
    )
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)

    return {
        **db_folder.__dict__,
        "document_count": 0
    }


@router.get("/folders/{folder_id}", response_model=DataRoomFolderWithChildren)
def get_folder(
    folder_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a folder with its children and documents."""
    folder = db.query(DataRoomFolder).filter(
        DataRoomFolder.id == folder_id,
        DataRoomFolder.organization_id == current_user.organization_id
    ).first()

    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    # Get children
    children = db.query(DataRoomFolder).filter(
        DataRoomFolder.parent_id == folder_id,
        DataRoomFolder.is_active == True
    ).order_by(DataRoomFolder.display_order).all()

    # Get documents
    docs = db.query(DataRoomDocument).filter(
        DataRoomDocument.folder_id == folder_id,
        DataRoomDocument.is_active == True
    ).order_by(DataRoomDocument.display_order).all()

    doc_list = []
    for doc in docs:
        document = doc.document
        doc_list.append({
            "id": doc.id,
            "organization_id": doc.organization_id,
            "document_id": doc.document_id,
            "folder_id": doc.folder_id,
            "display_name": doc.display_name,
            "display_order": doc.display_order,
            "visibility": doc.visibility,
            "view_count": doc.view_count,
            "download_count": doc.download_count,
            "is_active": doc.is_active,
            "created_at": doc.created_at,
            "updated_at": doc.updated_at,
            "document_name": document.name if document else None,
            "document_category": document.category if document else None,
            "file_path": document.file_path if document else None,
        })

    return {
        "id": folder.id,
        "organization_id": folder.organization_id,
        "name": folder.name,
        "description": folder.description,
        "parent_id": folder.parent_id,
        "display_order": folder.display_order,
        "visibility": folder.visibility,
        "is_active": folder.is_active,
        "created_at": folder.created_at,
        "updated_at": folder.updated_at,
        "document_count": len(doc_list),
        "children": [{**c.__dict__, "document_count": 0, "children": [], "documents": []} for c in children],
        "documents": doc_list
    }


@router.patch("/folders/{folder_id}", response_model=DataRoomFolderResponse)
def update_folder(
    folder_id: int,
    updates: DataRoomFolderUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a folder."""
    folder = db.query(DataRoomFolder).filter(
        DataRoomFolder.id == folder_id,
        DataRoomFolder.organization_id == current_user.organization_id
    ).first()

    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    update_data = updates.model_dump(exclude_unset=True)

    # Validate parent folder
    if "parent_id" in update_data and update_data["parent_id"]:
        if update_data["parent_id"] == folder_id:
            raise HTTPException(status_code=400, detail="Folder cannot be its own parent")
        parent = db.query(DataRoomFolder).filter(
            DataRoomFolder.id == update_data["parent_id"],
            DataRoomFolder.organization_id == current_user.organization_id
        ).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent folder not found")

    for key, value in update_data.items():
        setattr(folder, key, value)

    db.commit()
    db.refresh(folder)

    doc_count = db.query(DataRoomDocument).filter(
        DataRoomDocument.folder_id == folder.id,
        DataRoomDocument.is_active == True
    ).count()

    return {
        **folder.__dict__,
        "document_count": doc_count
    }


@router.delete("/folders/{folder_id}")
def delete_folder(
    folder_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a folder (soft delete)."""
    folder = db.query(DataRoomFolder).filter(
        DataRoomFolder.id == folder_id,
        DataRoomFolder.organization_id == current_user.organization_id
    ).first()

    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    folder.is_active = False
    db.commit()

    return {"message": "Folder deleted"}


# ============================================
# DOCUMENT ENDPOINTS
# ============================================

@router.get("/documents", response_model=List[DataRoomDocumentResponse])
def list_documents(
    folder_id: Optional[int] = Query(None),
    visibility: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List documents in the data room."""
    query = db.query(DataRoomDocument).filter(
        DataRoomDocument.organization_id == current_user.organization_id,
        DataRoomDocument.is_active == True
    )

    if folder_id is not None:
        query = query.filter(DataRoomDocument.folder_id == folder_id)

    if visibility:
        query = query.filter(DataRoomDocument.visibility == visibility)

    docs = query.order_by(DataRoomDocument.display_order).all()

    result = []
    for doc in docs:
        document = doc.document
        result.append({
            "id": doc.id,
            "organization_id": doc.organization_id,
            "document_id": doc.document_id,
            "folder_id": doc.folder_id,
            "display_name": doc.display_name,
            "display_order": doc.display_order,
            "visibility": doc.visibility,
            "view_count": doc.view_count,
            "download_count": doc.download_count,
            "is_active": doc.is_active,
            "created_at": doc.created_at,
            "updated_at": doc.updated_at,
            "document_name": document.name if document else None,
            "document_category": document.category if document else None,
            "file_path": document.file_path if document else None,
        })

    return result


@router.post("/documents", response_model=DataRoomDocumentResponse)
def add_document_to_data_room(
    doc: DataRoomDocumentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add an existing document to the data room."""
    # Verify document exists and belongs to org
    document = db.query(Document).filter(
        Document.id == doc.document_id,
        Document.organization_id == current_user.organization_id
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Check if already in data room
    existing = db.query(DataRoomDocument).filter(
        DataRoomDocument.document_id == doc.document_id,
        DataRoomDocument.organization_id == current_user.organization_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Document already in data room")

    # Verify folder if specified
    if doc.folder_id:
        folder = db.query(DataRoomFolder).filter(
            DataRoomFolder.id == doc.folder_id,
            DataRoomFolder.organization_id == current_user.organization_id
        ).first()
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")

    db_doc = DataRoomDocument(
        organization_id=current_user.organization_id,
        **doc.model_dump()
    )
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)

    return {
        "id": db_doc.id,
        "organization_id": db_doc.organization_id,
        "document_id": db_doc.document_id,
        "folder_id": db_doc.folder_id,
        "display_name": db_doc.display_name,
        "display_order": db_doc.display_order,
        "visibility": db_doc.visibility,
        "view_count": db_doc.view_count,
        "download_count": db_doc.download_count,
        "is_active": db_doc.is_active,
        "created_at": db_doc.created_at,
        "updated_at": db_doc.updated_at,
        "document_name": document.name,
        "document_category": document.category,
        "file_path": document.file_path,
    }


@router.patch("/documents/{doc_id}", response_model=DataRoomDocumentResponse)
def update_data_room_document(
    doc_id: int,
    updates: DataRoomDocumentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a data room document (move folder, rename, etc)."""
    doc = db.query(DataRoomDocument).filter(
        DataRoomDocument.id == doc_id,
        DataRoomDocument.organization_id == current_user.organization_id
    ).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found in data room")

    update_data = updates.model_dump(exclude_unset=True)

    # Validate folder if changing
    if "folder_id" in update_data and update_data["folder_id"]:
        folder = db.query(DataRoomFolder).filter(
            DataRoomFolder.id == update_data["folder_id"],
            DataRoomFolder.organization_id == current_user.organization_id
        ).first()
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")

    for key, value in update_data.items():
        setattr(doc, key, value)

    db.commit()
    db.refresh(doc)

    document = doc.document
    return {
        "id": doc.id,
        "organization_id": doc.organization_id,
        "document_id": doc.document_id,
        "folder_id": doc.folder_id,
        "display_name": doc.display_name,
        "display_order": doc.display_order,
        "visibility": doc.visibility,
        "view_count": doc.view_count,
        "download_count": doc.download_count,
        "is_active": doc.is_active,
        "created_at": doc.created_at,
        "updated_at": doc.updated_at,
        "document_name": document.name if document else None,
        "document_category": document.category if document else None,
        "file_path": document.file_path if document else None,
    }


@router.delete("/documents/{doc_id}")
def remove_document_from_data_room(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a document from the data room (doesn't delete the actual document)."""
    doc = db.query(DataRoomDocument).filter(
        DataRoomDocument.id == doc_id,
        DataRoomDocument.organization_id == current_user.organization_id
    ).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found in data room")

    doc.is_active = False
    db.commit()

    return {"message": "Document removed from data room"}


# ============================================
# SHAREABLE LINK ENDPOINTS
# ============================================

@router.get("/links", response_model=List[ShareableLinkResponse])
def list_shareable_links(
    folder_id: Optional[int] = Query(None),
    document_id: Optional[int] = Query(None),
    include_inactive: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List shareable links."""
    query = db.query(ShareableLink).filter(
        ShareableLink.organization_id == current_user.organization_id
    )

    if folder_id:
        query = query.filter(ShareableLink.folder_id == folder_id)
    if document_id:
        query = query.filter(ShareableLink.document_id == document_id)
    if not include_inactive:
        query = query.filter(ShareableLink.is_active == True)

    links = query.order_by(ShareableLink.created_at.desc()).all()

    result = []
    for link in links:
        folder = link.folder
        doc = link.data_room_document
        shareholder = link.shareholder

        result.append({
            "id": link.id,
            "organization_id": link.organization_id,
            "folder_id": link.folder_id,
            "document_id": link.document_id,
            "shareholder_id": link.shareholder_id,
            "token": link.token,
            "name": link.name,
            "notes": link.notes,
            "has_password": link.password_hash is not None,
            "expires_at": link.expires_at,
            "access_limit": link.access_limit,
            "current_accesses": link.current_accesses,
            "is_active": link.is_active,
            "created_by_id": link.created_by_id,
            "created_at": link.created_at,
            "folder_name": folder.name if folder else None,
            "document_name": doc.display_name or (doc.document.name if doc and doc.document else None),
            "shareholder_name": shareholder.name if shareholder else None,
            "url": f"/share/{link.token}"
        })

    return result


@router.post("/links", response_model=ShareableLinkResponse)
def create_shareable_link(
    link_data: ShareableLinkCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a shareable link for a folder or document."""
    if not link_data.folder_id and not link_data.document_id:
        raise HTTPException(status_code=400, detail="Must specify folder_id or document_id")

    # Validate folder
    if link_data.folder_id:
        folder = db.query(DataRoomFolder).filter(
            DataRoomFolder.id == link_data.folder_id,
            DataRoomFolder.organization_id == current_user.organization_id
        ).first()
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")

    # Validate document
    if link_data.document_id:
        doc = db.query(DataRoomDocument).filter(
            DataRoomDocument.id == link_data.document_id,
            DataRoomDocument.organization_id == current_user.organization_id
        ).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found in data room")

    # Validate shareholder
    if link_data.shareholder_id:
        shareholder = db.query(Shareholder).filter(
            Shareholder.id == link_data.shareholder_id,
            Shareholder.organization_id == current_user.organization_id
        ).first()
        if not shareholder:
            raise HTTPException(status_code=404, detail="Shareholder not found")

    # Generate secure token
    token = secrets.token_urlsafe(24)

    # Hash password if provided
    password_hash = None
    if link_data.password:
        password_hash = pwd_context.hash(link_data.password)

    db_link = ShareableLink(
        organization_id=current_user.organization_id,
        folder_id=link_data.folder_id,
        document_id=link_data.document_id,
        shareholder_id=link_data.shareholder_id,
        token=token,
        name=link_data.name,
        notes=link_data.notes,
        password_hash=password_hash,
        expires_at=link_data.expires_at,
        access_limit=link_data.access_limit,
        created_by_id=current_user.id
    )
    db.add(db_link)
    db.commit()
    db.refresh(db_link)

    folder = db_link.folder
    doc = db_link.data_room_document
    shareholder = db_link.shareholder

    return {
        "id": db_link.id,
        "organization_id": db_link.organization_id,
        "folder_id": db_link.folder_id,
        "document_id": db_link.document_id,
        "shareholder_id": db_link.shareholder_id,
        "token": db_link.token,
        "name": db_link.name,
        "notes": db_link.notes,
        "has_password": db_link.password_hash is not None,
        "expires_at": db_link.expires_at,
        "access_limit": db_link.access_limit,
        "current_accesses": db_link.current_accesses,
        "is_active": db_link.is_active,
        "created_by_id": db_link.created_by_id,
        "created_at": db_link.created_at,
        "folder_name": folder.name if folder else None,
        "document_name": doc.display_name or (doc.document.name if doc and doc.document else None),
        "shareholder_name": shareholder.name if shareholder else None,
        "url": f"/share/{db_link.token}"
    }


@router.patch("/links/{link_id}", response_model=ShareableLinkResponse)
def update_shareable_link(
    link_id: int,
    updates: ShareableLinkUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a shareable link."""
    link = db.query(ShareableLink).filter(
        ShareableLink.id == link_id,
        ShareableLink.organization_id == current_user.organization_id
    ).first()

    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    update_data = updates.model_dump(exclude_unset=True)

    # Handle password update
    if "password" in update_data:
        password = update_data.pop("password")
        if password:
            link.password_hash = pwd_context.hash(password)
        else:
            link.password_hash = None

    for key, value in update_data.items():
        setattr(link, key, value)

    db.commit()
    db.refresh(link)

    folder = link.folder
    doc = link.data_room_document
    shareholder = link.shareholder

    return {
        "id": link.id,
        "organization_id": link.organization_id,
        "folder_id": link.folder_id,
        "document_id": link.document_id,
        "shareholder_id": link.shareholder_id,
        "token": link.token,
        "name": link.name,
        "notes": link.notes,
        "has_password": link.password_hash is not None,
        "expires_at": link.expires_at,
        "access_limit": link.access_limit,
        "current_accesses": link.current_accesses,
        "is_active": link.is_active,
        "created_by_id": link.created_by_id,
        "created_at": link.created_at,
        "folder_name": folder.name if folder else None,
        "document_name": doc.display_name or (doc.document.name if doc and doc.document else None),
        "shareholder_name": shareholder.name if shareholder else None,
        "url": f"/share/{link.token}"
    }


@router.delete("/links/{link_id}")
def revoke_shareable_link(
    link_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revoke a shareable link."""
    link = db.query(ShareableLink).filter(
        ShareableLink.id == link_id,
        ShareableLink.organization_id == current_user.organization_id
    ).first()

    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    link.is_active = False
    db.commit()

    return {"message": "Link revoked"}


# ============================================
# ACCESS LOGS / ANALYTICS
# ============================================

@router.get("/access-logs", response_model=List[DataRoomAccessResponse])
def get_access_logs(
    folder_id: Optional[int] = Query(None),
    document_id: Optional[int] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get access logs for the data room."""
    query = db.query(DataRoomAccess).filter(
        DataRoomAccess.organization_id == current_user.organization_id
    )

    if folder_id:
        query = query.filter(DataRoomAccess.folder_id == folder_id)
    if document_id:
        query = query.filter(DataRoomAccess.document_id == document_id)

    logs = query.order_by(DataRoomAccess.created_at.desc()).offset(offset).limit(limit).all()

    result = []
    for log in logs:
        folder = log.folder
        doc = log.data_room_document
        user = log.user
        shareholder = log.shareholder

        result.append({
            "id": log.id,
            "organization_id": log.organization_id,
            "folder_id": log.folder_id,
            "document_id": log.document_id,
            "shareable_link_id": log.shareable_link_id,
            "user_id": log.user_id,
            "shareholder_id": log.shareholder_id,
            "access_type": log.access_type,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "created_at": log.created_at,
            "folder_name": folder.name if folder else None,
            "document_name": doc.display_name or (doc.document.name if doc and doc.document else None),
            "user_email": user.email if user else None,
            "shareholder_name": shareholder.name if shareholder else None,
        })

    return result


@router.get("/stats", response_model=DataRoomStats)
def get_data_room_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get summary statistics for the data room."""
    total_folders = db.query(DataRoomFolder).filter(
        DataRoomFolder.organization_id == current_user.organization_id,
        DataRoomFolder.is_active == True
    ).count()

    total_documents = db.query(DataRoomDocument).filter(
        DataRoomDocument.organization_id == current_user.organization_id,
        DataRoomDocument.is_active == True
    ).count()

    # Sum views and downloads
    stats = db.query(
        func.sum(DataRoomDocument.view_count),
        func.sum(DataRoomDocument.download_count)
    ).filter(
        DataRoomDocument.organization_id == current_user.organization_id,
        DataRoomDocument.is_active == True
    ).first()

    total_views = stats[0] or 0
    total_downloads = stats[1] or 0

    active_links = db.query(ShareableLink).filter(
        ShareableLink.organization_id == current_user.organization_id,
        ShareableLink.is_active == True
    ).count()

    # Recent accesses
    recent = db.query(DataRoomAccess).filter(
        DataRoomAccess.organization_id == current_user.organization_id
    ).order_by(DataRoomAccess.created_at.desc()).limit(10).all()

    recent_accesses = []
    for log in recent:
        folder = log.folder
        doc = log.data_room_document
        user = log.user
        shareholder = log.shareholder

        recent_accesses.append({
            "id": log.id,
            "organization_id": log.organization_id,
            "folder_id": log.folder_id,
            "document_id": log.document_id,
            "shareable_link_id": log.shareable_link_id,
            "user_id": log.user_id,
            "shareholder_id": log.shareholder_id,
            "access_type": log.access_type,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "created_at": log.created_at,
            "folder_name": folder.name if folder else None,
            "document_name": doc.display_name or (doc.document.name if doc and doc.document else None),
            "user_email": user.email if user else None,
            "shareholder_name": shareholder.name if shareholder else None,
        })

    return {
        "total_folders": total_folders,
        "total_documents": total_documents,
        "total_views": total_views,
        "total_downloads": total_downloads,
        "active_links": active_links,
        "recent_accesses": recent_accesses
    }


# ============================================
# PUBLIC ACCESS ENDPOINTS (NO AUTH)
# ============================================

public_router = APIRouter(prefix="/api/public/data-room", tags=["Data Room Public"])


@public_router.get("/{token}", response_model=PublicDataRoomView)
def access_shared_content(
    token: str,
    password: Optional[str] = Query(None),
    request: Request = None,
    db: Session = Depends(get_db)
):
    """Access shared content via a shareable link (no auth required)."""
    link = db.query(ShareableLink).filter(
        ShareableLink.token == token
    ).first()

    if not link:
        raise HTTPException(status_code=404, detail="Link not found or expired")

    if not link.is_active:
        raise HTTPException(status_code=410, detail="Link has been revoked")

    # Check expiry
    if link.expires_at and link.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Link has expired")

    # Check access limit
    if link.access_limit and link.current_accesses >= link.access_limit:
        raise HTTPException(status_code=410, detail="Link access limit reached")

    # Check password
    if link.password_hash:
        if not password:
            return {
                "folder_name": None,
                "documents": [],
                "expires_at": link.expires_at,
                "requires_password": True,
                "shareholder_name": link.shareholder.name if link.shareholder else None
            }
        if not pwd_context.verify(password, link.password_hash):
            raise HTTPException(status_code=401, detail="Invalid password")

    # Log access
    access_log = DataRoomAccess(
        organization_id=link.organization_id,
        folder_id=link.folder_id,
        document_id=link.document_id,
        shareable_link_id=link.id,
        shareholder_id=link.shareholder_id,
        access_type="view",
        ip_address=request.client.host if request else None,
        user_agent=request.headers.get("user-agent") if request else None
    )
    db.add(access_log)

    # Increment access count
    link.current_accesses += 1

    documents = []
    folder_name = None

    if link.folder_id:
        folder = link.folder
        folder_name = folder.name

        # Get all documents in folder (and subfolders?)
        docs = db.query(DataRoomDocument).filter(
            DataRoomDocument.folder_id == link.folder_id,
            DataRoomDocument.is_active == True,
            DataRoomDocument.visibility.in_(["internal", "investors"])
        ).all()

        for doc in docs:
            document = doc.document
            doc.view_count += 1
            documents.append({
                "id": doc.id,
                "name": doc.display_name or document.name,
                "category": document.category,
                "can_download": True
            })

    elif link.document_id:
        doc = link.data_room_document
        if doc:
            document = doc.document
            doc.view_count += 1
            documents.append({
                "id": doc.id,
                "name": doc.display_name or document.name,
                "category": document.category,
                "can_download": True
            })

    db.commit()

    return {
        "folder_name": folder_name,
        "documents": documents,
        "expires_at": link.expires_at,
        "requires_password": False,
        "shareholder_name": link.shareholder.name if link.shareholder else None
    }


@public_router.get("/{token}/download/{doc_id}")
def download_shared_document(
    token: str,
    doc_id: int,
    password: Optional[str] = Query(None),
    request: Request = None,
    db: Session = Depends(get_db)
):
    """Download a document via shareable link."""
    from fastapi.responses import FileResponse
    import os

    UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

    link = db.query(ShareableLink).filter(
        ShareableLink.token == token
    ).first()

    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    if not link.is_active:
        raise HTTPException(status_code=410, detail="Link has been revoked")

    if link.expires_at and link.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Link has expired")

    if link.access_limit and link.current_accesses >= link.access_limit:
        raise HTTPException(status_code=410, detail="Link access limit reached")

    # Verify password
    if link.password_hash:
        if not password or not pwd_context.verify(password, link.password_hash):
            raise HTTPException(status_code=401, detail="Invalid password")

    # Get document
    doc = db.query(DataRoomDocument).filter(
        DataRoomDocument.id == doc_id,
        DataRoomDocument.organization_id == link.organization_id,
        DataRoomDocument.is_active == True
    ).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Verify document is accessible via this link
    if link.document_id and link.document_id != doc_id:
        raise HTTPException(status_code=403, detail="Document not accessible via this link")

    if link.folder_id and doc.folder_id != link.folder_id:
        raise HTTPException(status_code=403, detail="Document not accessible via this link")

    # Get actual file
    document = doc.document
    if not document or not document.file_path:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = os.path.join(UPLOAD_DIR, document.file_path)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server")

    # Log download
    access_log = DataRoomAccess(
        organization_id=link.organization_id,
        folder_id=doc.folder_id,
        document_id=doc.id,
        shareable_link_id=link.id,
        shareholder_id=link.shareholder_id,
        access_type="download",
        ip_address=request.client.host if request else None,
        user_agent=request.headers.get("user-agent") if request else None
    )
    db.add(access_log)

    # Update stats
    doc.download_count += 1
    link.current_accesses += 1
    db.commit()

    return FileResponse(
        path=file_path,
        filename=document.name,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{document.name}"',
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store"
        }
    )
