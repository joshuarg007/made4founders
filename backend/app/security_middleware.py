"""
Security Middleware for Made4Founders

Features:
- Security headers (HSTS, CSP, X-Frame-Options, etc.)
- Rate limiting
- Request validation
- Audit logging
"""
import os
import time
import hashlib
import logging
from datetime import datetime, UTC, UTC
from typing import Callable, Dict, Optional
from collections import defaultdict
from functools import wraps

from fastapi import Request, Response, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

# Configure security logging
security_logger = logging.getLogger("security")
security_logger.setLevel(logging.INFO)

# Environment
IS_PRODUCTION = os.getenv("ENVIRONMENT", "development") == "production"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Add security headers to all responses.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Strict-Transport-Security (HSTS)
        # Only in production with HTTPS
        if IS_PRODUCTION:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # XSS Protection (legacy but still useful)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions Policy (formerly Feature-Policy)
        response.headers["Permissions-Policy"] = (
            "accelerometer=(), "
            "camera=(), "
            "geolocation=(), "
            "gyroscope=(), "
            "magnetometer=(), "
            "microphone=(), "
            "payment=(), "
            "usb=()"
        )

        # Content-Security-Policy
        # Note: 'unsafe-inline' for styles is needed for React/Tailwind.
        # In production, consider using nonces for scripts where possible.
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "  # Removed unsafe-inline and unsafe-eval for better XSS protection
            "style-src 'self' 'unsafe-inline'; "  # Inline styles needed for Tailwind
            "img-src 'self' data: https:; "
            "font-src 'self' data: https:; "
            "connect-src 'self' https:; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'; "
            "upgrade-insecure-requests"
        )

        # Cache control for API responses
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"

        return response


class RateLimiter:
    """
    In-memory rate limiter with sliding window.
    For production, use Redis-based rate limiting.
    """

    def __init__(self):
        # Structure: {key: [(timestamp, count), ...]}
        self._requests: Dict[str, list] = defaultdict(list)
        self._cleanup_interval = 60  # seconds
        self._last_cleanup = time.time()

    def _cleanup_old_requests(self, window_seconds: int = 60):
        """Remove old request records."""
        now = time.time()
        if now - self._last_cleanup < self._cleanup_interval:
            return

        cutoff = now - window_seconds
        for key in list(self._requests.keys()):
            self._requests[key] = [
                (ts, count) for ts, count in self._requests[key]
                if ts > cutoff
            ]
            if not self._requests[key]:
                del self._requests[key]

        self._last_cleanup = now

    def is_rate_limited(
        self,
        key: str,
        max_requests: int,
        window_seconds: int = 60
    ) -> tuple[bool, int]:
        """
        Check if a key is rate limited.

        Returns:
            (is_limited, requests_remaining)
        """
        self._cleanup_old_requests(window_seconds)

        now = time.time()
        cutoff = now - window_seconds

        # Count requests in window
        request_count = sum(
            count for ts, count in self._requests[key]
            if ts > cutoff
        )

        remaining = max(0, max_requests - request_count)

        if request_count >= max_requests:
            return True, 0

        # Record this request
        self._requests[key].append((now, 1))

        return False, remaining - 1

    def get_client_key(self, request: Request, endpoint: str = "") -> str:
        """Generate a rate limit key for a client.

        Security: Only trust X-Forwarded-For when the direct client is a known
        reverse proxy (e.g., Nginx, load balancer). Configure TRUSTED_PROXIES
        in production.
        """
        # Get direct client IP first
        client_ip = request.client.host if request.client else "unknown"

        # Only trust X-Forwarded-For from known reverse proxies
        # In production, configure with actual proxy IPs: {"10.0.0.1", "172.16.0.1"}
        TRUSTED_PROXIES = {"127.0.0.1", "::1"}  # localhost only by default

        if client_ip in TRUSTED_PROXIES:
            forwarded = request.headers.get("X-Forwarded-For")
            if forwarded:
                # Take the first (client) IP from the chain
                client_ip = forwarded.split(",")[0].strip()

        # Hash for privacy
        ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()[:16]

        if endpoint:
            return f"{ip_hash}:{endpoint}"
        return ip_hash


# Global rate limiter instance
rate_limiter = RateLimiter()

# Rate limit configurations
RATE_LIMITS = {
    # Auth endpoints - stricter limits
    "/api/auth/login": {"max_requests": 5, "window_seconds": 60},
    "/api/auth/register": {"max_requests": 3, "window_seconds": 60},
    "/api/auth/forgot-password": {"max_requests": 3, "window_seconds": 60},
    "/api/auth/reset-password": {"max_requests": 5, "window_seconds": 60},
    "/api/vault/unlock": {"max_requests": 5, "window_seconds": 60},
    "/api/vault/setup": {"max_requests": 3, "window_seconds": 300},

    # Sensitive data endpoints - prevent enumeration attacks
    "/api/business-identifiers": {"max_requests": 30, "window_seconds": 60},
    "/api/credentials": {"max_requests": 30, "window_seconds": 60},
    "/api/documents": {"max_requests": 60, "window_seconds": 60},

    # Calendar feed - prevent token enumeration
    "/api/calendar/feed": {"max_requests": 10, "window_seconds": 60},

    # General API - more lenient
    "default": {"max_requests": 100, "window_seconds": 60}
}


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip rate limiting for health checks and static files
        if request.url.path in ["/api/health", "/docs", "/openapi.json"]:
            return await call_next(request)

        if request.url.path.startswith("/uploads/"):
            return await call_next(request)

        # Get rate limit config for this endpoint
        path = request.url.path
        config = RATE_LIMITS.get(path, RATE_LIMITS["default"])

        # Check rate limit
        key = rate_limiter.get_client_key(request, path)
        is_limited, remaining = rate_limiter.is_rate_limited(
            key,
            config["max_requests"],
            config["window_seconds"]
        )

        if is_limited:
            security_logger.warning(
                f"Rate limit exceeded: {key} on {path}",
                extra={"path": path, "client_key": key}
            )
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again later."},
                headers={
                    "Retry-After": str(config["window_seconds"]),
                    "X-RateLimit-Limit": str(config["max_requests"]),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(time.time() + config["window_seconds"]))
                }
            )

        response = await call_next(request)

        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(config["max_requests"])
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(time.time() + config["window_seconds"]))

        return response


class AuditLogMiddleware(BaseHTTPMiddleware):
    """
    Audit logging for sensitive operations.
    """

    AUDIT_PATHS = {
        "/api/auth/login",
        "/api/auth/logout",
        "/api/auth/register",
        "/api/vault/unlock",
        "/api/vault/lock",
        "/api/vault/setup",
        "/api/vault/reset",
        "/api/business-identifiers",
        "/api/credentials",
        "/api/users",
    }

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Check if this is an auditable path
        should_audit = any(
            request.url.path.startswith(path)
            for path in self.AUDIT_PATHS
        )

        if not should_audit:
            return await call_next(request)

        # Capture request details
        start_time = time.time()

        # Get client IP
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        else:
            client_ip = request.client.host if request.client else "unknown"

        response = await call_next(request)

        # Log the audit event
        duration_ms = (time.time() - start_time) * 1000

        audit_data = {
            "timestamp": datetime.now(UTC).isoformat(),
            "path": request.url.path,
            "method": request.method,
            "status_code": response.status_code,
            "client_ip": client_ip,
            "user_agent": request.headers.get("User-Agent", "unknown")[:100],
            "duration_ms": round(duration_ms, 2)
        }

        # Log level based on status code
        if response.status_code >= 400:
            security_logger.warning(f"Audit: {audit_data}")
        else:
            security_logger.info(f"Audit: {audit_data}")

        return response


class RequestValidationMiddleware(BaseHTTPMiddleware):
    """
    Validate incoming requests for security.
    """

    MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 MB max
    BLOCKED_USER_AGENTS = ["sqlmap", "nikto", "havij", "acunetix"]

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Check content length header (if provided)
        content_length = request.headers.get("Content-Length")
        if content_length:
            try:
                if int(content_length) > self.MAX_CONTENT_LENGTH:
                    return JSONResponse(
                        status_code=413,
                        content={"detail": "Request body too large"}
                    )
            except ValueError:
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Invalid Content-Length header"}
                )

        # For chunked transfers without Content-Length, we rely on
        # the web framework's built-in limits. FastAPI/Starlette
        # handle this at the ASGI server level (uvicorn default: 10MB).

        # Block known malicious user agents
        user_agent = request.headers.get("User-Agent", "").lower()
        for blocked in self.BLOCKED_USER_AGENTS:
            if blocked in user_agent:
                security_logger.warning(
                    f"Blocked malicious user agent: {user_agent}",
                    extra={"user_agent": user_agent}
                )
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Forbidden"}
                )

        # Block requests with suspicious characters in path
        path = request.url.path
        suspicious_patterns = ["../", "..\\", "<script", "javascript:", "data:"]
        for pattern in suspicious_patterns:
            if pattern.lower() in path.lower():
                security_logger.warning(
                    f"Blocked suspicious path: {path}",
                    extra={"path": path}
                )
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Invalid request"}
                )

        return await call_next(request)


def require_https(func: Callable):
    """
    Decorator to require HTTPS for a route (production only).
    """
    @wraps(func)
    async def wrapper(request: Request, *args, **kwargs):
        if IS_PRODUCTION:
            if request.headers.get("X-Forwarded-Proto", "http") != "https":
                raise HTTPException(
                    status_code=403,
                    detail="HTTPS required"
                )
        return await func(request, *args, **kwargs)
    return wrapper


def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Validate password meets security requirements.

    Returns:
        (is_valid, error_message)
    """
    if len(password) < 12:
        return False, "Password must be at least 12 characters"

    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    has_special = any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password)

    if not (has_upper and has_lower and has_digit and has_special):
        return False, "Password must contain uppercase, lowercase, digit, and special character"

    # Check for common passwords (basic check)
    common_passwords = ["password", "123456", "qwerty", "admin", "letmein"]
    if password.lower() in common_passwords:
        return False, "Password is too common"

    return True, ""
