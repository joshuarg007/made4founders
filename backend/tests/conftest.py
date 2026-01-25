"""
Pytest configuration and shared fixtures for Made4Founders tests.
"""
import pytest
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.testclient import TestClient

from app.database import Base, get_db
from app.main import app
from app.models import User, Organization
from app.security import get_password_hash, create_access_token, create_refresh_token
from app.vault import VaultSession
from app.security_middleware import rate_limiter


# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="function")
def test_db():
    """Create a fresh test database for each test."""
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # Create tables
    Base.metadata.create_all(bind=engine)

    # Create session
    db = TestingSessionLocal()

    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(test_db):
    """Create a test client with database dependency override."""
    def override_get_db():
        try:
            yield test_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    # Clear vault sessions
    VaultSession._sessions.clear()

    # Clear rate limiter state
    rate_limiter._requests.clear()

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    rate_limiter._requests.clear()


@pytest.fixture
def test_user(test_db):
    """Create a test user with verified email."""
    user = User(
        email="test@example.com",
        hashed_password=get_password_hash("TestPass123!"),
        name="Test User",
        role="viewer",
        is_active=True,
        email_verified=True,
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture
def admin_user(test_db):
    """Create an admin test user."""
    user = User(
        email="admin@example.com",
        hashed_password=get_password_hash("AdminPass123!"),
        name="Admin User",
        role="admin",
        is_active=True,
        email_verified=True,
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture
def editor_user(test_db):
    """Create an editor test user."""
    user = User(
        email="editor@example.com",
        hashed_password=get_password_hash("EditorPass123!"),
        name="Editor User",
        role="editor",
        is_active=True,
        email_verified=True,
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture
def unverified_user(test_db):
    """Create a user with unverified email."""
    user = User(
        email="unverified@example.com",
        hashed_password=get_password_hash("TestPass123!"),
        name="Unverified User",
        role="viewer",
        is_active=True,
        email_verified=False,
        email_verification_token="test-verification-token",
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture
def inactive_user(test_db):
    """Create an inactive user."""
    user = User(
        email="inactive@example.com",
        hashed_password=get_password_hash("TestPass123!"),
        name="Inactive User",
        role="viewer",
        is_active=False,
        email_verified=True,
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user):
    """Create authentication headers for test user."""
    access_token = create_access_token(test_user.email)
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
def admin_auth_headers(admin_user):
    """Create authentication headers for admin user."""
    access_token = create_access_token(admin_user.email)
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
def editor_auth_headers(editor_user):
    """Create authentication headers for editor user."""
    access_token = create_access_token(editor_user.email)
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
def auth_cookies(test_user):
    """Create authentication cookies for test user."""
    access_token = create_access_token(test_user.email)
    refresh_token = create_refresh_token(test_user.email)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
    }


@pytest.fixture
def admin_auth_cookies(admin_user):
    """Create authentication cookies for admin user."""
    access_token = create_access_token(admin_user.email)
    refresh_token = create_refresh_token(admin_user.email)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
    }
