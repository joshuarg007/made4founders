"""
Vault encryption utilities for secure credential storage.
Uses Fernet symmetric encryption with key derived from master password.
"""
import os
import base64
import hashlib
from typing import Optional
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import bcrypt


def generate_salt() -> str:
    """Generate a random salt for key derivation."""
    return base64.b64encode(os.urandom(32)).decode('utf-8')


def derive_key(master_password: str, salt: str) -> bytes:
    """Derive an encryption key from master password using PBKDF2."""
    salt_bytes = base64.b64decode(salt.encode('utf-8'))
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt_bytes,
        iterations=480000,  # OWASP recommended minimum
    )
    key = base64.urlsafe_b64encode(kdf.derive(master_password.encode('utf-8')))
    return key


def hash_master_password(password: str) -> str:
    """Hash the master password for verification."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_master_password(password: str, hashed: str) -> bool:
    """Verify master password against stored hash."""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def encrypt_value(value: str, key: bytes) -> str:
    """Encrypt a string value and return base64-encoded ciphertext."""
    if not value:
        return ""
    f = Fernet(key)
    encrypted = f.encrypt(value.encode('utf-8'))
    return base64.b64encode(encrypted).decode('utf-8')


def decrypt_value(encrypted_value: str, key: bytes) -> str:
    """Decrypt a base64-encoded ciphertext and return plaintext."""
    if not encrypted_value:
        return ""
    f = Fernet(key)
    ciphertext = base64.b64decode(encrypted_value.encode('utf-8'))
    decrypted = f.decrypt(ciphertext)
    return decrypted.decode('utf-8')


def mask_value(value: str, show_last: int = 4) -> str:
    """Mask a value, showing only the last N characters."""
    if not value:
        return ""
    if len(value) <= show_last:
        return "*" * len(value)
    return "*" * (len(value) - show_last) + value[-show_last:]


# In-memory vault session storage (per-request)
# In production, use Redis or similar for distributed sessions
class VaultSession:
    """Manages vault unlock state and encryption key."""

    _sessions: dict[str, bytes] = {}  # session_id -> encryption_key

    @classmethod
    def unlock(cls, session_id: str, key: bytes) -> None:
        """Store encryption key for session."""
        cls._sessions[session_id] = key

    @classmethod
    def lock(cls, session_id: str) -> None:
        """Remove encryption key from session."""
        cls._sessions.pop(session_id, None)

    @classmethod
    def get_key(cls, session_id: str) -> Optional[bytes]:
        """Get encryption key for session if unlocked."""
        return cls._sessions.get(session_id)

    @classmethod
    def is_unlocked(cls, session_id: str) -> bool:
        """Check if vault is unlocked for session."""
        return session_id in cls._sessions
