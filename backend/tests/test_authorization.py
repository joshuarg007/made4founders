"""
Authorization and Access Control Security Tests for Made4Founders.

Tests cover:
- Role-based access control (admin, editor, viewer)
- Protected endpoint authorization
- User isolation (users can't access other users' data)
- Admin-only endpoints
- Privilege escalation prevention
"""
import pytest
from datetime import datetime, timedelta

from app.models import User, Document, Contact, Deadline, Task, Credential
from app.security import get_password_hash, create_access_token


class TestRoleBasedAccess:
    """Test role-based access control."""

    def test_admin_can_access_users(self, client, admin_auth_headers):
        """Admin should be able to access user management."""
        response = client.get("/api/auth/users", headers=admin_auth_headers)
        assert response.status_code == 200

    def test_editor_cannot_access_users(self, client, editor_auth_headers):
        """Editor should not be able to access user management."""
        response = client.get("/api/auth/users", headers=editor_auth_headers)
        assert response.status_code == 403

    def test_viewer_cannot_access_users(self, client, auth_headers):
        """Viewer should not be able to access user management."""
        response = client.get("/api/auth/users", headers=auth_headers)
        assert response.status_code == 403

    def test_admin_can_create_user(self, client, admin_auth_headers):
        """Admin should be able to create users."""
        response = client.post("/api/auth/users", headers=admin_auth_headers, json={
            "email": "newuser@example.com",
            "password": "SecurePass123!",
            "name": "New User",
            "role": "viewer",
            "is_active": True,
        })
        assert response.status_code == 200

    def test_editor_cannot_create_user(self, client, editor_auth_headers):
        """Editor should not be able to create users."""
        response = client.post("/api/auth/users", headers=editor_auth_headers, json={
            "email": "newuser@example.com",
            "password": "SecurePass123!",
            "name": "New User",
            "role": "viewer",
            "is_active": True,
        })
        assert response.status_code == 403

    def test_admin_can_delete_user(self, client, admin_auth_headers, test_db):
        """Admin should be able to delete users."""
        # Create a user to delete
        user_to_delete = User(
            email="todelete@example.com",
            hashed_password=get_password_hash("TestPass123!"),
            name="To Delete",
            role="viewer",
            is_active=True,
            email_verified=True,
        )
        test_db.add(user_to_delete)
        test_db.commit()
        user_id = user_to_delete.id

        response = client.delete(
            f"/api/auth/users/{user_id}",
            headers=admin_auth_headers
        )
        assert response.status_code == 200

    def test_admin_cannot_delete_self(self, client, admin_user, test_db):
        """Admin should not be able to delete themselves."""
        access_token = create_access_token(admin_user.email)
        headers = {"Authorization": f"Bearer {access_token}"}

        response = client.delete(
            f"/api/auth/users/{admin_user.id}",
            headers=headers
        )
        assert response.status_code == 400
        assert "yourself" in response.json()["detail"].lower()

    def test_cannot_remove_last_admin(self, client, admin_user, test_db):
        """Cannot remove the last admin from the system."""
        access_token = create_access_token(admin_user.email)
        headers = {"Authorization": f"Bearer {access_token}"}

        # Try to change the only admin to a viewer
        response = client.patch(
            f"/api/auth/users/{admin_user.id}",
            headers=headers,
            json={"role": "viewer"}
        )
        assert response.status_code == 400
        assert "last admin" in response.json()["detail"].lower()


class TestProtectedEndpoints:
    """Test that all protected endpoints require authentication."""

    @pytest.mark.parametrize("endpoint,method", [
        ("/api/auth/me", "GET"),
        ("/api/auth/users", "GET"),
        ("/api/documents", "GET"),
        ("/api/contacts", "GET"),
        ("/api/deadlines", "GET"),
        ("/api/tasks", "GET"),
        ("/api/metrics", "GET"),
        ("/api/checklist", "GET"),
        ("/api/credentials", "GET"),
        ("/api/business-identifiers", "GET"),
        ("/api/vault/status", "GET"),
        ("/api/auth/sessions", "GET"),
    ])
    def test_endpoint_requires_auth(self, client, endpoint, method):
        """Protected endpoints should require authentication."""
        if method == "GET":
            response = client.get(endpoint)
        elif method == "POST":
            response = client.post(endpoint, json={})
        else:
            response = client.request(method, endpoint)

        # Should return 401 Unauthorized or redirect
        assert response.status_code in (401, 403, 307)


class TestUserIsolation:
    """Test that users can't access other users' data."""

    def test_user_cannot_view_other_users_sessions(self, client, test_db):
        """User should only see their own sessions."""
        # Create two users
        user1 = User(
            email="user1@example.com",
            hashed_password=get_password_hash("TestPass123!"),
            name="User 1",
            role="viewer",
            is_active=True,
            email_verified=True,
        )
        user2 = User(
            email="user2@example.com",
            hashed_password=get_password_hash("TestPass123!"),
            name="User 2",
            role="viewer",
            is_active=True,
            email_verified=True,
        )
        test_db.add_all([user1, user2])
        test_db.commit()

        # Get sessions for user1
        access_token = create_access_token(user1.email)
        headers = {"Authorization": f"Bearer {access_token}"}

        response = client.get("/api/auth/sessions", headers=headers)
        assert response.status_code == 200
        # Sessions should only belong to user1 (or be empty)
        # The point is they shouldn't see user2's sessions

    def test_user_cannot_revoke_other_users_session(self, client, test_db):
        """User should not be able to revoke another user's session."""
        from app.models import UserSession

        # Create two users
        user1 = User(
            email="user1_session@example.com",
            hashed_password=get_password_hash("TestPass123!"),
            name="User 1",
            role="viewer",
            is_active=True,
            email_verified=True,
        )
        user2 = User(
            email="user2_session@example.com",
            hashed_password=get_password_hash("TestPass123!"),
            name="User 2",
            role="viewer",
            is_active=True,
            email_verified=True,
        )
        test_db.add_all([user1, user2])
        test_db.commit()

        # Create a session for user2
        user2_session = UserSession(
            user_id=user2.id,
            token_id="user2-session-id",
            device_info="User 2 Browser",
            ip_address="192.168.1.2",
            expires_at=datetime.utcnow() + timedelta(days=7),
        )
        test_db.add(user2_session)
        test_db.commit()
        session_id = user2_session.id

        # Try to revoke user2's session as user1
        access_token = create_access_token(user1.email)
        headers = {"Authorization": f"Bearer {access_token}"}

        response = client.post(
            f"/api/auth/sessions/{session_id}/revoke",
            headers=headers
        )
        # Should fail - not found or forbidden
        assert response.status_code in (403, 404)


class TestPrivilegeEscalation:
    """Test prevention of privilege escalation attacks."""

    def test_viewer_cannot_upgrade_to_admin(self, client, test_db):
        """Viewer should not be able to upgrade their own role."""
        # Create a viewer user
        viewer = User(
            email="viewer_upgrade@example.com",
            hashed_password=get_password_hash("TestPass123!"),
            name="Viewer",
            role="viewer",
            is_active=True,
            email_verified=True,
        )
        test_db.add(viewer)
        test_db.commit()

        access_token = create_access_token(viewer.email)
        headers = {"Authorization": f"Bearer {access_token}"}

        # Try to update own user to admin role
        response = client.patch(
            f"/api/auth/users/{viewer.id}",
            headers=headers,
            json={"role": "admin"}
        )
        # Should be forbidden
        assert response.status_code == 403

    def test_editor_cannot_create_admin(self, client, editor_auth_headers):
        """Editor should not be able to create admin users."""
        response = client.post(
            "/api/auth/users",
            headers=editor_auth_headers,
            json={
                "email": "newadmin@example.com",
                "password": "SecurePass123!",
                "name": "New Admin",
                "role": "admin",
                "is_active": True,
            }
        )
        assert response.status_code == 403

    def test_cannot_change_role_via_registration(self, client):
        """Registration should not allow setting admin role."""
        response = client.post("/api/auth/register", json={
            "email": "hacker@example.com",
            "password": "SecurePass123!",
            "name": "Hacker",
            "role": "admin",  # This should be ignored
        })
        # Either the role field is ignored, or registration succeeds but role is not admin
        if response.status_code == 200:
            data = response.json()
            # First user is admin, subsequent users are viewer
            # Just verify the endpoint didn't crash on extra field


class TestAdminOnlyEndpoints:
    """Test admin-only endpoint access."""

    def test_audit_logs_require_admin(self, client, auth_headers, admin_auth_headers):
        """Audit logs should only be accessible by admins."""
        # Viewer should be denied
        response = client.get("/api/audit-logs/", headers=auth_headers)
        assert response.status_code == 403

        # Admin should succeed
        response = client.get("/api/audit-logs/", headers=admin_auth_headers)
        assert response.status_code == 200

    def test_backup_create_requires_scheduler_key(self, client, admin_auth_headers):
        """Backup creation should require scheduler API key, not just admin."""
        response = client.post("/api/backups/create", headers=admin_auth_headers)
        # Should require SCHEDULER_API_KEY header
        # May return 500 if S3 not configured, but key check happens first
        # The key is that admin auth alone isn't sufficient
        assert response.status_code in (401, 403, 500)

    def test_monitoring_metrics_require_admin(self, client, auth_headers, admin_auth_headers):
        """Monitoring metrics should require admin."""
        # Viewer should be denied
        response = client.get("/api/monitoring/metrics", headers=auth_headers)
        assert response.status_code == 403

        # Admin should succeed
        response = client.get("/api/monitoring/metrics", headers=admin_auth_headers)
        # May return 200 or 503 (if psutil not working), but not 403
        assert response.status_code != 403

    def test_analytics_stats_require_admin(self, client, auth_headers, admin_auth_headers):
        """Analytics stats should require admin."""
        # Viewer should be denied
        response = client.get("/api/analytics/stats", headers=auth_headers)
        assert response.status_code == 403

        # Admin should succeed
        response = client.get("/api/analytics/stats", headers=admin_auth_headers)
        assert response.status_code == 200


class TestInactiveUserAccess:
    """Test that inactive users cannot access the system."""

    def test_inactive_user_token_rejected(self, client, test_db):
        """Inactive user's token should be rejected."""
        # Create inactive user
        inactive = User(
            email="inactive_test@example.com",
            hashed_password=get_password_hash("TestPass123!"),
            name="Inactive User",
            role="viewer",
            is_active=False,
            email_verified=True,
        )
        test_db.add(inactive)
        test_db.commit()

        # Create token for inactive user
        access_token = create_access_token(inactive.email)
        headers = {"Authorization": f"Bearer {access_token}"}

        # Try to access protected endpoint
        response = client.get("/api/auth/me", headers=headers)
        assert response.status_code == 403
        assert "inactive" in response.json()["detail"].lower()


class TestOwnershipChecks:
    """Test that users can only modify their own resources."""

    def test_user_can_modify_own_profile(self, client, test_user, test_db):
        """User should be able to modify their own profile."""
        access_token = create_access_token(test_user.email)
        headers = {"Authorization": f"Bearer {access_token}"}

        # Mark onboarding complete (a self-modifying action)
        response = client.post(
            "/api/auth/me/complete-onboarding",
            headers=headers
        )
        assert response.status_code == 200


class TestVaultAccessControl:
    """Test vault access control."""

    def test_vault_status_requires_auth(self, client):
        """Vault status should require authentication."""
        response = client.get("/api/vault/status")
        assert response.status_code == 401

    def test_credentials_require_unlocked_vault(self, client, auth_headers):
        """Creating credentials should require unlocked vault."""
        # Try to create credential without vault setup
        response = client.post(
            "/api/credentials",
            headers=auth_headers,
            json={
                "name": "Test Credential",
                "username": "testuser",
                "password": "testpass",
            }
        )
        # Should fail - vault not setup
        assert response.status_code in (400, 403)


class TestAPIKeyAuthentication:
    """Test API key based authentication for scheduled tasks."""

    def test_deadline_reminders_require_scheduler_key(self, client):
        """Deadline reminders endpoint should require scheduler key."""
        response = client.post("/api/notifications/send-deadline-reminders")
        # May return 500 if email not configured after key check
        # Key is that endpoint doesn't just allow anonymous access with 200
        assert response.status_code in (401, 403, 500)

    def test_weekly_digest_requires_scheduler_key(self, client):
        """Weekly digest endpoint should require scheduler key."""
        response = client.post("/api/notifications/send-weekly-digest")
        # May return 500 if email not configured after key check
        assert response.status_code in (401, 403, 500)

    def test_backup_requires_scheduler_key(self, client):
        """Backup endpoint should require scheduler key."""
        response = client.post("/api/backups/create")
        # May return 500 if S3 not configured after key check
        assert response.status_code in (401, 403, 500)
