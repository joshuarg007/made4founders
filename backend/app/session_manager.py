"""
Session management for tracking and revoking user sessions.

Features:
- Track active sessions with device/IP info
- Token blacklist with in-memory cache + DB persistence
- Session revocation (single, all, all-except-current)
- Automatic cleanup of expired sessions
"""
import threading
from datetime import datetime, UTC, timedelta
from typing import Optional, List, Dict

from sqlalchemy.orm import Session

from .models import User, UserSession, TokenBlacklist


class TokenBlacklistCache:
    """
    In-memory cache for revoked tokens.
    Provides fast O(1) lookups while synced with database for persistence.
    """

    def __init__(self):
        self._cache: Dict[str, datetime] = {}  # token_id -> expires_at
        self._lock = threading.RLock()
        self._last_cleanup = datetime.now(UTC)
        self._cleanup_interval = timedelta(minutes=5)

    def add(self, token_id: str, expires_at: datetime) -> None:
        """Add a token to the blacklist cache."""
        with self._lock:
            self._cache[token_id] = expires_at
            self._cleanup_if_needed()

    def is_blacklisted(self, token_id: str) -> bool:
        """Check if a token is in the blacklist cache."""
        with self._lock:
            return token_id in self._cache

    def _cleanup_if_needed(self) -> None:
        """Remove expired entries from cache."""
        now = datetime.now(UTC)
        if now - self._last_cleanup < self._cleanup_interval:
            return

        # Remove expired entries
        self._cache = {
            tid: exp for tid, exp in self._cache.items()
            if exp > now
        }
        self._last_cleanup = now

    def load_from_db(self, db: Session) -> int:
        """
        Load active blacklisted tokens from database.
        Returns count of tokens loaded.
        """
        now = datetime.now(UTC)
        entries = db.query(TokenBlacklist).filter(
            TokenBlacklist.expires_at > now
        ).all()

        with self._lock:
            for entry in entries:
                self._cache[entry.token_id] = entry.expires_at

        return len(entries)

    def clear(self) -> None:
        """Clear the cache (for testing)."""
        with self._lock:
            self._cache.clear()


# Global cache instance
token_blacklist_cache = TokenBlacklistCache()


def create_session(
    db: Session,
    user: User,
    token_id: str,
    device_info: Optional[str],
    ip_address: Optional[str],
    expires_at: datetime
) -> UserSession:
    """
    Create a new session record.

    Args:
        db: Database session
        user: User object
        token_id: JWT token ID (jti claim)
        device_info: User-Agent or parsed device info
        ip_address: Client IP address
        expires_at: When the token expires

    Returns:
        Created UserSession object
    """
    session = UserSession(
        user_id=user.id,
        token_id=token_id,
        device_info=device_info[:500] if device_info else None,
        ip_address=ip_address[:45] if ip_address else None,
        expires_at=expires_at,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def update_session_activity(db: Session, token_id: str) -> bool:
    """
    Update last_used_at for a session.

    Args:
        db: Database session
        token_id: JWT token ID (jti claim)

    Returns:
        True if session found and updated, False otherwise
    """
    session = db.query(UserSession).filter(
        UserSession.token_id == token_id,
        UserSession.is_revoked == False
    ).first()

    if session:
        session.last_used_at = datetime.now(UTC)
        db.commit()
        return True
    return False


def revoke_session(
    db: Session,
    session: UserSession,
    reason: str = "manual"
) -> bool:
    """
    Revoke a specific session and blacklist its token.

    Args:
        db: Database session
        session: UserSession to revoke
        reason: Reason for revocation

    Returns:
        True if successful
    """
    session.is_revoked = True
    session.revoked_at = datetime.now(UTC)
    session.revoked_reason = reason

    # Add to token blacklist in database
    blacklist_entry = TokenBlacklist(
        token_id=session.token_id,
        user_id=session.user_id,
        expires_at=session.expires_at,
        reason=reason
    )
    db.add(blacklist_entry)
    db.commit()

    # Update in-memory cache
    token_blacklist_cache.add(session.token_id, session.expires_at)

    return True


def revoke_all_sessions(
    db: Session,
    user_id: int,
    reason: str = "logout_all",
    exclude_token_id: Optional[str] = None
) -> int:
    """
    Revoke all sessions for a user.

    Args:
        db: Database session
        user_id: User ID
        reason: Reason for revocation
        exclude_token_id: Optional token ID to exclude (keep current session)

    Returns:
        Count of revoked sessions
    """
    query = db.query(UserSession).filter(
        UserSession.user_id == user_id,
        UserSession.is_revoked == False
    )

    if exclude_token_id:
        query = query.filter(UserSession.token_id != exclude_token_id)

    sessions = query.all()
    count = 0

    for session in sessions:
        revoke_session(db, session, reason)
        count += 1

    return count


def get_user_sessions(db: Session, user_id: int) -> List[UserSession]:
    """
    Get all active sessions for a user.

    Args:
        db: Database session
        user_id: User ID

    Returns:
        List of active UserSession objects, ordered by last_used_at desc
    """
    return db.query(UserSession).filter(
        UserSession.user_id == user_id,
        UserSession.is_revoked == False,
        UserSession.expires_at > datetime.now(UTC)
    ).order_by(UserSession.last_used_at.desc()).all()


def get_session_by_id(db: Session, session_id: int, user_id: int) -> Optional[UserSession]:
    """
    Get a specific session by ID, ensuring it belongs to the user.

    Args:
        db: Database session
        session_id: Session ID
        user_id: User ID (for authorization)

    Returns:
        UserSession if found and belongs to user, None otherwise
    """
    return db.query(UserSession).filter(
        UserSession.id == session_id,
        UserSession.user_id == user_id,
        UserSession.is_revoked == False
    ).first()


def is_token_revoked(db: Session, token_id: str) -> bool:
    """
    Check if a token has been revoked.
    Uses cache for fast lookups, falls back to database.

    Args:
        db: Database session
        token_id: JWT token ID (jti claim)

    Returns:
        True if token is revoked, False otherwise
    """
    # Fast path: check in-memory cache
    if token_blacklist_cache.is_blacklisted(token_id):
        return True

    # Slow path: check database
    entry = db.query(TokenBlacklist).filter(
        TokenBlacklist.token_id == token_id,
        TokenBlacklist.expires_at > datetime.now(UTC)
    ).first()

    if entry:
        # Add to cache for future lookups
        token_blacklist_cache.add(entry.token_id, entry.expires_at)
        return True

    return False


def cleanup_expired_sessions(db: Session) -> dict:
    """
    Remove expired sessions and blacklist entries.
    Should be called periodically (e.g., hourly).

    Args:
        db: Database session

    Returns:
        Dict with counts of removed entries
    """
    now = datetime.now(UTC)

    # Delete expired sessions
    session_count = db.query(UserSession).filter(
        UserSession.expires_at < now
    ).delete()

    # Delete expired blacklist entries
    blacklist_count = db.query(TokenBlacklist).filter(
        TokenBlacklist.expires_at < now
    ).delete()

    db.commit()

    return {
        "sessions_removed": session_count,
        "blacklist_entries_removed": blacklist_count
    }


def parse_device_info(user_agent: str) -> str:
    """
    Parse User-Agent string into a human-readable device description.
    This is a simple implementation; can be enhanced with user-agents library.

    Args:
        user_agent: Raw User-Agent string

    Returns:
        Human-readable device description
    """
    if not user_agent:
        return "Unknown device"

    ua_lower = user_agent.lower()

    # Detect browser
    browser = "Unknown browser"
    if "chrome" in ua_lower and "edg" not in ua_lower:
        browser = "Chrome"
    elif "firefox" in ua_lower:
        browser = "Firefox"
    elif "safari" in ua_lower and "chrome" not in ua_lower:
        browser = "Safari"
    elif "edg" in ua_lower:
        browser = "Edge"
    elif "opera" in ua_lower or "opr" in ua_lower:
        browser = "Opera"

    # Detect OS
    os_name = "Unknown OS"
    if "windows" in ua_lower:
        os_name = "Windows"
    elif "mac os" in ua_lower or "macos" in ua_lower:
        os_name = "macOS"
    elif "linux" in ua_lower:
        os_name = "Linux"
    elif "android" in ua_lower:
        os_name = "Android"
    elif "iphone" in ua_lower or "ipad" in ua_lower:
        os_name = "iOS"

    return f"{browser} on {os_name}"
