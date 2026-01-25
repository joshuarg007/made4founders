"""
Automated backup service for database and uploads.

Supports:
- Scheduled database backups to S3
- Configurable retention policy
- Manual backup/restore endpoints (admin only)

Endpoints:
- POST /api/backups/create (requires API key or admin)
- GET /api/backups/list (admin only)
- POST /api/backups/restore/{backup_id} (admin only)
- DELETE /api/backups/{backup_id} (admin only)
"""
import os
import logging
import shutil
import tempfile
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .database import get_db, DATABASE_PATH
from .auth import get_current_user
from .models import User

logger = logging.getLogger(__name__)

router = APIRouter()

# Configuration
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
BACKUP_BUCKET = os.getenv("BACKUP_S3_BUCKET", "")
BACKUP_PREFIX = os.getenv("BACKUP_S3_PREFIX", "backups/made4founders/")
BACKUP_RETENTION_DAYS = int(os.getenv("BACKUP_RETENTION_DAYS", "30"))
SCHEDULER_API_KEY = os.getenv("SCHEDULER_API_KEY", "")

# Lazy S3 client
_s3_client = None


def get_s3_client():
    """Get or create S3 client."""
    global _s3_client
    if _s3_client is None:
        try:
            import boto3
            _s3_client = boto3.client('s3', region_name=AWS_REGION)
        except ImportError:
            logger.warning("boto3 package not installed. S3 backups disabled.")
            return None
    return _s3_client


class BackupInfo(BaseModel):
    """Backup metadata."""
    key: str
    filename: str
    size_bytes: int
    created_at: datetime
    age_days: int


class BackupResponse(BaseModel):
    """Response for backup operations."""
    success: bool
    message: str
    backup_key: Optional[str] = None
    backup_size: Optional[int] = None


def verify_scheduler_key(x_api_key: str = Header(None)):
    """Verify the scheduler API key."""
    if not SCHEDULER_API_KEY:
        raise HTTPException(status_code=500, detail="Scheduler API key not configured")
    if x_api_key != SCHEDULER_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return True


def require_admin(current_user: User = Depends(get_current_user)):
    """Require admin role."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def create_database_backup() -> tuple[str, int]:
    """
    Create a backup of the SQLite database.
    Returns: (backup_file_path, size_bytes)
    """
    if not os.path.exists(DATABASE_PATH):
        raise HTTPException(status_code=500, detail="Database file not found")

    # Create timestamped backup filename
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"db_backup_{timestamp}.db"

    # Create temp copy (SQLite safe backup)
    temp_dir = tempfile.mkdtemp()
    backup_path = os.path.join(temp_dir, backup_filename)

    try:
        # Use SQLite backup API for consistency
        import sqlite3
        source = sqlite3.connect(DATABASE_PATH)
        dest = sqlite3.connect(backup_path)
        source.backup(dest)
        source.close()
        dest.close()

        size = os.path.getsize(backup_path)
        return backup_path, size
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Backup creation failed: {str(e)}")


def upload_to_s3(local_path: str, s3_key: str) -> bool:
    """Upload a file to S3."""
    s3 = get_s3_client()
    if not s3 or not BACKUP_BUCKET:
        logger.warning("S3 not configured, skipping upload")
        return False

    try:
        s3.upload_file(local_path, BACKUP_BUCKET, s3_key)
        logger.info(f"Uploaded backup to s3://{BACKUP_BUCKET}/{s3_key}")
        return True
    except Exception as e:
        logger.error(f"S3 upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"S3 upload failed: {str(e)}")


def list_s3_backups() -> List[BackupInfo]:
    """List all backups in S3."""
    s3 = get_s3_client()
    if not s3 or not BACKUP_BUCKET:
        return []

    try:
        response = s3.list_objects_v2(
            Bucket=BACKUP_BUCKET,
            Prefix=BACKUP_PREFIX
        )

        backups = []
        now = datetime.utcnow()

        for obj in response.get('Contents', []):
            key = obj['Key']
            if key.endswith('.db'):
                filename = key.split('/')[-1]
                created = obj['LastModified'].replace(tzinfo=None)
                age = (now - created).days

                backups.append(BackupInfo(
                    key=key,
                    filename=filename,
                    size_bytes=obj['Size'],
                    created_at=created,
                    age_days=age
                ))

        # Sort by date, newest first
        backups.sort(key=lambda x: x.created_at, reverse=True)
        return backups
    except Exception as e:
        logger.error(f"Failed to list S3 backups: {e}")
        return []


def delete_s3_backup(s3_key: str) -> bool:
    """Delete a backup from S3."""
    s3 = get_s3_client()
    if not s3 or not BACKUP_BUCKET:
        return False

    try:
        s3.delete_object(Bucket=BACKUP_BUCKET, Key=s3_key)
        logger.info(f"Deleted backup: s3://{BACKUP_BUCKET}/{s3_key}")
        return True
    except Exception as e:
        logger.error(f"Failed to delete backup: {e}")
        return False


def cleanup_old_backups() -> int:
    """Delete backups older than retention period. Returns count deleted."""
    backups = list_s3_backups()
    deleted = 0

    for backup in backups:
        if backup.age_days > BACKUP_RETENTION_DAYS:
            if delete_s3_backup(backup.key):
                deleted += 1

    return deleted


@router.post("/create", response_model=BackupResponse)
async def create_backup(
    _: bool = Depends(verify_scheduler_key),
):
    """
    Create a database backup and upload to S3.

    Should be called daily by a scheduler (e.g., cron, CloudWatch).
    Also cleans up backups older than retention period.
    """
    if not BACKUP_BUCKET:
        raise HTTPException(
            status_code=500,
            detail="BACKUP_S3_BUCKET environment variable not configured"
        )

    # Create backup
    backup_path, size = create_database_backup()

    try:
        # Generate S3 key
        filename = os.path.basename(backup_path)
        s3_key = f"{BACKUP_PREFIX}{filename}"

        # Upload to S3
        upload_to_s3(backup_path, s3_key)

        # Cleanup old backups
        deleted = cleanup_old_backups()

        message = f"Backup created successfully ({size:,} bytes)"
        if deleted > 0:
            message += f", deleted {deleted} old backup(s)"

        return BackupResponse(
            success=True,
            message=message,
            backup_key=s3_key,
            backup_size=size
        )
    finally:
        # Clean up temp file
        temp_dir = os.path.dirname(backup_path)
        shutil.rmtree(temp_dir, ignore_errors=True)


@router.post("/create-admin", response_model=BackupResponse)
async def create_backup_admin(
    current_user: User = Depends(require_admin),
):
    """Create a backup (admin only, no API key needed)."""
    if not BACKUP_BUCKET:
        raise HTTPException(
            status_code=500,
            detail="BACKUP_S3_BUCKET environment variable not configured"
        )

    backup_path, size = create_database_backup()

    try:
        filename = os.path.basename(backup_path)
        s3_key = f"{BACKUP_PREFIX}{filename}"
        upload_to_s3(backup_path, s3_key)

        return BackupResponse(
            success=True,
            message=f"Backup created successfully ({size:,} bytes)",
            backup_key=s3_key,
            backup_size=size
        )
    finally:
        temp_dir = os.path.dirname(backup_path)
        shutil.rmtree(temp_dir, ignore_errors=True)


@router.get("/list", response_model=List[BackupInfo])
async def list_backups(
    current_user: User = Depends(require_admin),
):
    """List all available backups (admin only)."""
    if not BACKUP_BUCKET:
        raise HTTPException(
            status_code=500,
            detail="BACKUP_S3_BUCKET not configured"
        )

    return list_s3_backups()


@router.delete("/{backup_key:path}")
async def delete_backup(
    backup_key: str,
    current_user: User = Depends(require_admin),
):
    """Delete a specific backup (admin only)."""
    if not backup_key.startswith(BACKUP_PREFIX):
        raise HTTPException(status_code=400, detail="Invalid backup key")

    if delete_s3_backup(backup_key):
        return {"success": True, "message": "Backup deleted"}
    else:
        raise HTTPException(status_code=500, detail="Failed to delete backup")


@router.post("/restore/{backup_key:path}")
async def restore_backup(
    backup_key: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Restore database from a backup (admin only).

    WARNING: This will replace the current database!
    The current database is backed up before restore.
    """
    s3 = get_s3_client()
    if not s3 or not BACKUP_BUCKET:
        raise HTTPException(status_code=500, detail="S3 not configured")

    if not backup_key.startswith(BACKUP_PREFIX):
        raise HTTPException(status_code=400, detail="Invalid backup key")

    # Download backup to temp location
    temp_dir = tempfile.mkdtemp()
    restore_path = os.path.join(temp_dir, "restore.db")

    try:
        # Download from S3
        s3.download_file(BACKUP_BUCKET, backup_key, restore_path)

        # Verify it's a valid SQLite database
        import sqlite3
        conn = sqlite3.connect(restore_path)
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        conn.close()

        if not tables:
            raise HTTPException(status_code=400, detail="Invalid backup file")

        # Backup current database first
        pre_restore_backup = f"{DATABASE_PATH}.pre_restore_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        shutil.copy2(DATABASE_PATH, pre_restore_backup)

        # Replace database
        # Note: In production, you'd want to stop the app, replace, and restart
        shutil.copy2(restore_path, DATABASE_PATH)

        return {
            "success": True,
            "message": f"Database restored from {backup_key}",
            "pre_restore_backup": pre_restore_backup,
            "note": "Application may need restart for changes to take effect"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Restore failed: {e}")
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@router.get("/health")
async def backup_health():
    """Health check for backup service."""
    s3 = get_s3_client()
    s3_configured = bool(s3 and BACKUP_BUCKET)

    return {
        "status": "healthy" if s3_configured else "degraded",
        "s3_configured": s3_configured,
        "bucket": BACKUP_BUCKET if BACKUP_BUCKET else None,
        "retention_days": BACKUP_RETENTION_DAYS,
        "scheduler_key_configured": bool(SCHEDULER_API_KEY),
    }
