#!/bin/bash
#
# Made4Founders Database Backup Script
#
# This script creates backups of the SQLite database and uploads to S3.
# Run daily via cron: 0 2 * * * /path/to/backup.sh
#
# Requirements:
# - AWS CLI configured with appropriate credentials
# - S3 bucket created: s3://made4founders-backups/
#
# Usage:
#   ./backup.sh                    # Create backup and upload to S3
#   ./backup.sh --local-only       # Create local backup only (no S3)
#   ./backup.sh --restore <file>   # Restore from a backup file

set -e

# Configuration
BACKUP_DIR="/home/ubuntu/made4founders/backups"
DB_PATH="/home/ubuntu/made4founders/backend/data/made4founders.db"
UPLOADS_DIR="/home/ubuntu/made4founders/backend/uploads"
S3_BUCKET="s3://made4founders-backups"
RETENTION_DAYS=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_ONLY=$(date +%Y%m%d)

create_backup() {
    log_info "Starting backup at $(date)"

    # Create database backup
    DB_BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sqlite"
    if [ -f "$DB_PATH" ]; then
        # Use SQLite's backup command for consistency
        sqlite3 "$DB_PATH" ".backup '$DB_BACKUP_FILE'"
        log_info "Database backup created: $DB_BACKUP_FILE"
    else
        log_error "Database file not found: $DB_PATH"
        exit 1
    fi

    # Create uploads backup (tar.gz)
    UPLOADS_BACKUP_FILE="$BACKUP_DIR/uploads_backup_$TIMESTAMP.tar.gz"
    if [ -d "$UPLOADS_DIR" ]; then
        tar -czf "$UPLOADS_BACKUP_FILE" -C "$(dirname $UPLOADS_DIR)" "$(basename $UPLOADS_DIR)" 2>/dev/null || true
        log_info "Uploads backup created: $UPLOADS_BACKUP_FILE"
    else
        log_warn "Uploads directory not found: $UPLOADS_DIR"
    fi

    # Create combined backup archive
    COMBINED_BACKUP="$BACKUP_DIR/made4founders_backup_$TIMESTAMP.tar.gz"
    tar -czf "$COMBINED_BACKUP" -C "$BACKUP_DIR" \
        "db_backup_$TIMESTAMP.sqlite" \
        "uploads_backup_$TIMESTAMP.tar.gz" 2>/dev/null || \
    tar -czf "$COMBINED_BACKUP" -C "$BACKUP_DIR" "db_backup_$TIMESTAMP.sqlite"

    # Clean up individual files
    rm -f "$DB_BACKUP_FILE" "$UPLOADS_BACKUP_FILE"

    log_info "Combined backup created: $COMBINED_BACKUP"
    echo "$COMBINED_BACKUP"
}

upload_to_s3() {
    local backup_file="$1"

    if ! command -v aws &> /dev/null; then
        log_warn "AWS CLI not installed, skipping S3 upload"
        return 1
    fi

    log_info "Uploading to S3..."
    aws s3 cp "$backup_file" "$S3_BUCKET/$(basename $backup_file)" --quiet
    log_info "Uploaded to $S3_BUCKET/$(basename $backup_file)"
}

cleanup_old_backups() {
    log_info "Cleaning up backups older than $RETENTION_DAYS days..."

    # Clean local backups
    find "$BACKUP_DIR" -name "made4founders_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

    # Clean S3 backups (if AWS CLI available)
    if command -v aws &> /dev/null; then
        # List and delete old S3 objects
        CUTOFF_DATE=$(date -d "-$RETENTION_DAYS days" +%Y-%m-%d)
        aws s3 ls "$S3_BUCKET/" | while read -r line; do
            createDate=$(echo "$line" | awk '{print $1}')
            fileName=$(echo "$line" | awk '{print $4}')
            if [[ "$createDate" < "$CUTOFF_DATE" ]] && [[ -n "$fileName" ]]; then
                aws s3 rm "$S3_BUCKET/$fileName" --quiet
                log_info "Deleted old S3 backup: $fileName"
            fi
        done
    fi
}

restore_backup() {
    local backup_file="$1"

    if [ ! -f "$backup_file" ]; then
        # Try to download from S3
        if command -v aws &> /dev/null; then
            log_info "Attempting to download from S3..."
            aws s3 cp "$S3_BUCKET/$(basename $backup_file)" "$backup_file" --quiet || {
                log_error "Backup file not found locally or in S3: $backup_file"
                exit 1
            }
        else
            log_error "Backup file not found: $backup_file"
            exit 1
        fi
    fi

    log_warn "This will overwrite the current database!"
    read -p "Are you sure you want to continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restore cancelled"
        exit 0
    fi

    # Stop the application
    log_info "Stopping application..."
    cd /home/ubuntu/made4founders && docker compose down || true

    # Extract backup
    TEMP_DIR=$(mktemp -d)
    tar -xzf "$backup_file" -C "$TEMP_DIR"

    # Restore database
    DB_BACKUP=$(find "$TEMP_DIR" -name "db_backup_*.sqlite" | head -1)
    if [ -n "$DB_BACKUP" ]; then
        cp "$DB_BACKUP" "$DB_PATH"
        log_info "Database restored"
    fi

    # Restore uploads
    UPLOADS_BACKUP=$(find "$TEMP_DIR" -name "uploads_backup_*.tar.gz" | head -1)
    if [ -n "$UPLOADS_BACKUP" ]; then
        rm -rf "$UPLOADS_DIR"
        tar -xzf "$UPLOADS_BACKUP" -C "$(dirname $UPLOADS_DIR)"
        log_info "Uploads restored"
    fi

    # Cleanup
    rm -rf "$TEMP_DIR"

    # Restart application
    log_info "Restarting application..."
    cd /home/ubuntu/made4founders && docker compose up -d

    log_info "Restore complete!"
}

# Main
case "${1:-}" in
    --local-only)
        BACKUP_FILE=$(create_backup)
        log_info "Local backup complete: $BACKUP_FILE"
        ;;
    --restore)
        if [ -z "${2:-}" ]; then
            log_error "Usage: $0 --restore <backup_file>"
            exit 1
        fi
        restore_backup "$2"
        ;;
    --list)
        log_info "Local backups:"
        ls -lh "$BACKUP_DIR"/made4founders_backup_*.tar.gz 2>/dev/null || echo "  No local backups found"
        echo
        log_info "S3 backups:"
        aws s3 ls "$S3_BUCKET/" 2>/dev/null || echo "  AWS CLI not configured or bucket not accessible"
        ;;
    *)
        BACKUP_FILE=$(create_backup)
        upload_to_s3 "$BACKUP_FILE" || log_warn "S3 upload failed, local backup saved"
        cleanup_old_backups
        log_info "Backup complete!"
        ;;
esac
