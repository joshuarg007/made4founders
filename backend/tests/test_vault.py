"""Tests for the Credential Vault feature."""
import pytest
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.vault import (
    generate_salt, derive_key, hash_master_password, verify_master_password,
    encrypt_value, decrypt_value, VaultSession
)

# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


# Import app after setup
from app.main import app
from starlette.testclient import TestClient

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    """Reset database before each test."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    # Clear vault sessions
    VaultSession._sessions.clear()
    yield


class TestVaultCrypto:
    """Test encryption utilities."""

    def test_generate_salt(self):
        """Salt should be unique each time."""
        salt1 = generate_salt()
        salt2 = generate_salt()
        assert salt1 != salt2
        assert len(salt1) > 20  # Base64 encoded 32 bytes

    def test_derive_key(self):
        """Key derivation should be deterministic."""
        salt = generate_salt()
        key1 = derive_key("password123", salt)
        key2 = derive_key("password123", salt)
        assert key1 == key2

    def test_derive_key_different_passwords(self):
        """Different passwords should produce different keys."""
        salt = generate_salt()
        key1 = derive_key("password123", salt)
        key2 = derive_key("password456", salt)
        assert key1 != key2

    def test_hash_and_verify_password(self):
        """Password hashing and verification should work."""
        password = "mysecretpassword"
        hashed = hash_master_password(password)
        assert verify_master_password(password, hashed)
        assert not verify_master_password("wrongpassword", hashed)

    def test_encrypt_decrypt_value(self):
        """Encryption and decryption should be reversible."""
        salt = generate_salt()
        key = derive_key("password123", salt)

        original = "sensitive data here"
        encrypted = encrypt_value(original, key)
        decrypted = decrypt_value(encrypted, key)

        assert encrypted != original
        assert decrypted == original

    def test_encrypt_empty_value(self):
        """Empty values should return empty strings."""
        salt = generate_salt()
        key = derive_key("password123", salt)

        assert encrypt_value("", key) == ""
        assert decrypt_value("", key) == ""


class TestVaultSession:
    """Test vault session management."""

    def test_unlock_and_check(self):
        """Session should track unlock state."""
        session_id = "test-session"
        key = b"test-key-32-bytes-long-enough!!"

        assert not VaultSession.is_unlocked(session_id)
        VaultSession.unlock(session_id, key)
        assert VaultSession.is_unlocked(session_id)

    def test_lock_session(self):
        """Locking should clear the key."""
        session_id = "test-session"
        key = b"test-key-32-bytes-long-enough!!"

        VaultSession.unlock(session_id, key)
        assert VaultSession.is_unlocked(session_id)

        VaultSession.lock(session_id)
        assert not VaultSession.is_unlocked(session_id)
        assert VaultSession.get_key(session_id) is None


class TestVaultAPI:
    """Test vault API endpoints."""

    def test_vault_status_not_setup(self):
        """Vault should not be setup initially."""
        response = client.get("/api/vault/status")
        assert response.status_code == 200
        data = response.json()
        assert data["is_setup"] is False
        assert data["is_unlocked"] is False

    def test_vault_setup(self):
        """Setting up vault should work."""
        response = client.post("/api/vault/setup", json={
            "master_password": "mysecret123"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["is_setup"] is True
        assert data["is_unlocked"] is True

    def test_vault_setup_short_password(self):
        """Short passwords should be rejected."""
        response = client.post("/api/vault/setup", json={
            "master_password": "short"
        })
        assert response.status_code == 400

    def test_vault_setup_already_exists(self):
        """Cannot setup vault twice."""
        client.post("/api/vault/setup", json={"master_password": "mysecret123"})
        response = client.post("/api/vault/setup", json={"master_password": "another123"})
        assert response.status_code == 400

    def test_vault_lock_unlock(self):
        """Lock and unlock should work."""
        # Setup
        client.post("/api/vault/setup", json={"master_password": "mysecret123"})

        # Lock
        response = client.post("/api/vault/lock")
        assert response.status_code == 200
        assert response.json()["is_unlocked"] is False

        # Unlock with wrong password
        response = client.post("/api/vault/unlock", json={"master_password": "wrong"})
        assert response.status_code == 401

        # Unlock with correct password
        response = client.post("/api/vault/unlock", json={"master_password": "mysecret123"})
        assert response.status_code == 200
        assert response.json()["is_unlocked"] is True


class TestCredentialsAPI:
    """Test credentials CRUD API."""

    def setup_method(self):
        """Setup vault before each test."""
        client.post("/api/vault/setup", json={"master_password": "testpass123"})

    def test_create_credential(self):
        """Creating a credential should work."""
        response = client.post("/api/credentials", json={
            "name": "Bank Account",
            "service_url": "https://bank.com",
            "category": "banking",
            "username": "myuser",
            "password": "mypass123"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Bank Account"
        assert data["has_username"] is True
        assert data["has_password"] is True
        assert "username" not in data  # Masked response

    def test_create_credential_vault_locked(self):
        """Creating credential with locked vault should fail."""
        client.post("/api/vault/lock")
        response = client.post("/api/credentials", json={
            "name": "Test",
            "username": "user",
            "password": "pass"
        })
        assert response.status_code == 403

    def test_get_credentials_list(self):
        """Listing credentials should return masked data."""
        # Create some credentials
        client.post("/api/credentials", json={
            "name": "Cred 1",
            "username": "user1",
            "password": "pass1"
        })
        client.post("/api/credentials", json={
            "name": "Cred 2",
            "username": "user2"
        })

        response = client.get("/api/credentials")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_get_credential_decrypted(self):
        """Getting single credential should return decrypted data."""
        # Create credential
        create_resp = client.post("/api/credentials", json={
            "name": "Test Cred",
            "username": "testuser",
            "password": "testpass",
            "notes": "some notes"
        })
        cred_id = create_resp.json()["id"]

        # Get decrypted
        response = client.get(f"/api/credentials/{cred_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "testuser"
        assert data["password"] == "testpass"
        assert data["notes"] == "some notes"

    def test_update_credential(self):
        """Updating credential should work."""
        # Create
        create_resp = client.post("/api/credentials", json={
            "name": "Original",
            "username": "user1",
            "password": "pass1"
        })
        cred_id = create_resp.json()["id"]

        # Update
        response = client.patch(f"/api/credentials/{cred_id}", json={
            "name": "Updated",
            "password": "newpass"
        })
        assert response.status_code == 200
        assert response.json()["name"] == "Updated"

        # Verify password changed
        get_resp = client.get(f"/api/credentials/{cred_id}")
        assert get_resp.json()["password"] == "newpass"

    def test_delete_credential(self):
        """Deleting credential should work."""
        # Create
        create_resp = client.post("/api/credentials", json={
            "name": "To Delete",
            "username": "user"
        })
        cred_id = create_resp.json()["id"]

        # Delete
        response = client.delete(f"/api/credentials/{cred_id}")
        assert response.status_code == 200

        # Verify gone
        response = client.get(f"/api/credentials/{cred_id}")
        assert response.status_code == 404

    def test_copy_credential_field(self):
        """Copying specific field should work."""
        # Create
        create_resp = client.post("/api/credentials", json={
            "name": "Copy Test",
            "username": "copyuser",
            "password": "copypass"
        })
        cred_id = create_resp.json()["id"]

        # Copy username
        response = client.get(f"/api/credentials/{cred_id}/copy/username")
        assert response.status_code == 200
        assert response.json()["value"] == "copyuser"

        # Copy password
        response = client.get(f"/api/credentials/{cred_id}/copy/password")
        assert response.status_code == 200
        assert response.json()["value"] == "copypass"

    def test_vault_reset(self):
        """Resetting vault should clear everything."""
        # Create credential
        client.post("/api/credentials", json={
            "name": "Will Be Gone",
            "password": "secret"
        })

        # Reset vault
        response = client.delete("/api/vault/reset")
        assert response.status_code == 200

        # Verify vault is not setup
        status = client.get("/api/vault/status").json()
        assert status["is_setup"] is False

        # Setup again and verify no credentials
        client.post("/api/vault/setup", json={"master_password": "newpass123"})
        creds = client.get("/api/credentials").json()
        assert len(creds) == 0
