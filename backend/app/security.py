import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Response
from jose import jwt, JWTError
from passlib.context import CryptContext

# JWT settings (env-driven with defaults)
SECRET_KEY = os.getenv("SECRET_KEY", "founderos-dev-secret-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

# Cookie security (env-driven)
COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", "false").lower() == "true"
COOKIE_SAMESITE: str = os.getenv("COOKIE_SAMESITE", "lax").lower()
COOKIE_DOMAIN: Optional[str] = os.getenv("COOKIE_DOMAIN")

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(sub: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return jwt.encode({"sub": sub, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(sub: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.utcnow() + (expires_delta or timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))
    return jwt.encode({"sub": sub, "exp": expire, "typ": "refresh"}, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[str]:
    """Return email (sub) if valid access token; otherwise None."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("typ") in (None, "access"):
            return payload.get("sub")
        return None
    except JWTError:
        return None


def set_auth_cookies(resp: Response, access_token: str, refresh_token: str) -> None:
    def _set(key: str, value: str, max_age: int):
        kwargs = dict(
            httponly=True,
            secure=COOKIE_SECURE,
            samesite=COOKIE_SAMESITE,
            path="/",
            max_age=max_age,
        )
        if COOKIE_DOMAIN:
            kwargs["domain"] = COOKIE_DOMAIN
        resp.set_cookie(key=key, value=value, **kwargs)

    _set("access_token", access_token, ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    _set("refresh_token", refresh_token, REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600)


def clear_auth_cookies(resp: Response) -> None:
    kwargs = {"path": "/"}
    if COOKIE_DOMAIN:
        kwargs["domain"] = COOKIE_DOMAIN
    resp.delete_cookie("access_token", **kwargs)
    resp.delete_cookie("refresh_token", **kwargs)
