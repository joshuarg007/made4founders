"""
Tests for the Credential Vault feature.

Uses shared fixtures from conftest.py for authentication.
"""
import pytest
from app.vault import (
    generate_salt, derive_key, hash_master_password, verify_master_password,
    encrypt_value, decrypt_value, VaultSession
)


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

    def test_wrong_key_fails_decryption(self):
        """Decryption with wrong key should fail."""
        salt = generate_salt()
        correct_key = derive_key("password123", salt)
        wrong_key = derive_key("wrongpassword", salt)

        original = "sensitive data"
        encrypted = encrypt_value(original, correct_key)

        with pytest.raises(ValueError):
            decrypt_value(encrypted, wrong_key)

    def test_encrypted_data_is_different_each_time(self):
        """Due to random nonce, encrypted data should differ each encryption."""
        salt = generate_salt()
        key = derive_key("password123", salt)

        original = "same data"
        encrypted1 = encrypt_value(original, key)
        encrypted2 = encrypt_value(original, key)

        # Should be different due to random nonce
        assert encrypted1 != encrypted2
        # But both should decrypt to same value
        assert decrypt_value(encrypted1, key) == original
        assert decrypt_value(encrypted2, key) == original


class TestVaultSession:
    """Test vault session management."""

    def test_unlock_and_check(self):
        """Session should track unlock state."""
        VaultSession._sessions.clear()
        session_id = "test-session"
        key = b"test-key-32-bytes-long-enough!!"

        assert not VaultSession.is_unlocked(session_id)
        VaultSession.unlock(session_id, key)
        assert VaultSession.is_unlocked(session_id)

    def test_lock_session(self):
        """Locking should clear the key."""
        VaultSession._sessions.clear()
        session_id = "test-session"
        key = b"test-key-32-bytes-long-enough!!"

        VaultSession.unlock(session_id, key)
        assert VaultSession.is_unlocked(session_id)

        VaultSession.lock(session_id)
        assert not VaultSession.is_unlocked(session_id)
        assert VaultSession.get_key(session_id) is None

    def test_get_key_returns_correct_key(self):
        """Get key should return the stored key."""
        VaultSession._sessions.clear()
        session_id = "test-session"
        key = b"test-key-32-bytes-long-enough!!"

        VaultSession.unlock(session_id, key)
        retrieved = VaultSession.get_key(session_id)
        assert retrieved == key

    def test_multiple_sessions(self):
        """Multiple sessions should be independent."""
        VaultSession._sessions.clear()
        key1 = b"key1-32-bytes-long-enough!!!!!!!"
        key2 = b"key2-32-bytes-long-enough!!!!!!!"

        VaultSession.unlock("session1", key1)
        VaultSession.unlock("session2", key2)

        assert VaultSession.get_key("session1") == key1
        assert VaultSession.get_key("session2") == key2

        VaultSession.lock("session1")
        assert not VaultSession.is_unlocked("session1")
        assert VaultSession.is_unlocked("session2")


class TestVaultAPI:
    """Test vault API endpoints."""

    def test_vault_status_not_setup(self, client, auth_headers):
        """Vault should not be setup initially."""
        response = client.get("/api/vault/status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["is_setup"] is False
        assert data["is_unlocked"] is False

    def test_vault_setup(self, client, auth_headers):
        """Setting up vault should work."""
        response = client.post("/api/vault/setup", headers=auth_headers, json={
            "master_password": "mysecret123"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["is_setup"] is True
        assert data["is_unlocked"] is True

    def test_vault_setup_short_password(self, client, auth_headers):
        """Short passwords should be rejected."""
        response = client.post("/api/vault/setup", headers=auth_headers, json={
            "master_password": "short"
        })
        assert response.status_code == 400

    def test_vault_setup_already_exists(self, client, auth_headers):
        """Cannot setup vault twice."""
        client.post("/api/vault/setup", headers=auth_headers, json={
            "master_password": "mysecret123"
        })
        response = client.post("/api/vault/setup", headers=auth_headers, json={
            "master_password": "another123"
        })
        assert response.status_code == 400

    def test_vault_lock_unlock(self, client, auth_headers):
        """Lock and unlock should work."""
        # Setup
        client.post("/api/vault/setup", headers=auth_headers, json={
            "master_password": "mysecret123"
        })

        # Lock
        response = client.post("/api/vault/lock", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["is_unlocked"] is False

        # Unlock with wrong password
        response = client.post("/api/vault/unlock", headers=auth_headers, json={
            "master_password": "wrong"
        })
        assert response.status_code == 401

        # Unlock with correct password
        response = client.post("/api/vault/unlock", headers=auth_headers, json={
            "master_password": "mysecret123"
        })
        assert response.status_code == 200
        assert response.json()["is_unlocked"] is True


class TestCredentialsAPI:
    """Test credentials CRUD API."""

    def _setup_vault(self, client, auth_headers):
        """Helper to setup vault before each test."""
        client.post("/api/vault/setup", headers=auth_headers, json={
            "master_password": "testpass123"
        })

    def test_create_credential(self, client, auth_headers):
        """Creating a credential should work."""
        self._setup_vault(client, auth_headers)

        response = client.post("/api/credentials", headers=auth_headers, json={
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

    def test_create_credential_vault_locked(self, client, auth_headers):
        """Creating credential with locked vault should fail."""
        self._setup_vault(client, auth_headers)
        client.post("/api/vault/lock", headers=auth_headers)

        response = client.post("/api/credentials", headers=auth_headers, json={
            "name": "Test",
            "username": "user",
            "password": "pass"
        })
        assert response.status_code == 403

    def test_get_credentials_list(self, client, auth_headers):
        """Listing credentials should return masked data."""
        self._setup_vault(client, auth_headers)

        # Create some credentials
        client.post("/api/credentials", headers=auth_headers, json={
            "name": "Cred 1",
            "username": "user1",
            "password": "pass1"
        })
        client.post("/api/credentials", headers=auth_headers, json={
            "name": "Cred 2",
            "username": "user2"
        })

        response = client.get("/api/credentials", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_get_credential_decrypted(self, client, auth_headers):
        """Getting single credential should return decrypted data."""
        self._setup_vault(client, auth_headers)

        # Create credential
        create_resp = client.post("/api/credentials", headers=auth_headers, json={
            "name": "Test Cred",
            "username": "testuser",
            "password": "testpass",
            "notes": "some notes"
        })
        cred_id = create_resp.json()["id"]

        # Get decrypted
        response = client.get(f"/api/credentials/{cred_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "testuser"
        assert data["password"] == "testpass"
        assert data["notes"] == "some notes"

    def test_update_credential(self, client, auth_headers):
        """Updating credential should work."""
        self._setup_vault(client, auth_headers)

        # Create
        create_resp = client.post("/api/credentials", headers=auth_headers, json={
            "name": "Original",
            "username": "user1",
            "password": "pass1"
        })
        cred_id = create_resp.json()["id"]

        # Update
        response = client.patch(f"/api/credentials/{cred_id}", headers=auth_headers, json={
            "name": "Updated",
            "password": "newpass"
        })
        assert response.status_code == 200
        assert response.json()["name"] == "Updated"

        # Verify password changed
        get_resp = client.get(f"/api/credentials/{cred_id}", headers=auth_headers)
        assert get_resp.json()["password"] == "newpass"

    def test_delete_credential(self, client, auth_headers):
        """Deleting credential should work."""
        self._setup_vault(client, auth_headers)

        # Create
        create_resp = client.post("/api/credentials", headers=auth_headers, json={
            "name": "To Delete",
            "username": "user"
        })
        cred_id = create_resp.json()["id"]

        # Delete
        response = client.delete(f"/api/credentials/{cred_id}", headers=auth_headers)
        assert response.status_code == 200

        # Verify gone
        response = client.get(f"/api/credentials/{cred_id}", headers=auth_headers)
        assert response.status_code == 404

    def test_copy_credential_field(self, client, auth_headers):
        """Copying specific field should work."""
        self._setup_vault(client, auth_headers)

        # Create
        create_resp = client.post("/api/credentials", headers=auth_headers, json={
            "name": "Copy Test",
            "username": "copyuser",
            "password": "copypass"
        })
        cred_id = create_resp.json()["id"]

        # Copy username
        response = client.get(
            f"/api/credentials/{cred_id}/copy/username",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["value"] == "copyuser"

        # Copy password
        response = client.get(
            f"/api/credentials/{cred_id}/copy/password",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["value"] == "copypass"

    def test_vault_reset(self, client, auth_headers):
        """Resetting vault should clear everything."""
        self._setup_vault(client, auth_headers)

        # Create credential
        client.post("/api/credentials", headers=auth_headers, json={
            "name": "Will Be Gone",
            "password": "secret"
        })

        # Reset vault
        response = client.delete("/api/vault/reset", headers=auth_headers)
        assert response.status_code == 200

        # Verify vault is not setup
        status = client.get("/api/vault/status", headers=auth_headers).json()
        assert status["is_setup"] is False

        # Setup again and verify no credentials
        client.post("/api/vault/setup", headers=auth_headers, json={
            "master_password": "newpass123"
        })
        creds = client.get("/api/credentials", headers=auth_headers).json()
        assert len(creds) == 0
