from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .schemas import Token, UserCreate, UserResponse, UserMe
from . import security

router = APIRouter()

# Bearer fallback
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/token", auto_error=False)


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = db.query(User).filter(User.email == email).first()
    if not user or not security.verify_password(password, user.hashed_password):
        return None
    return user


def get_current_user(
    db: Session = Depends(get_db),
    bearer: Optional[str] = Depends(oauth2_scheme),
    access_cookie: Optional[str] = Cookie(None, alias="access_token"),
) -> User:
    token = access_cookie or bearer or ""
    if hasattr(token, "value"):
        token = token.value
    if not isinstance(token, str):
        token = str(token)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    email = security.decode_access_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is inactive")
    return user


def get_current_user_optional(
    db: Session = Depends(get_db),
    bearer: Optional[str] = Depends(oauth2_scheme),
    access_cookie: Optional[str] = Cookie(None, alias="access_token"),
) -> Optional[User]:
    """Same as get_current_user but returns None instead of raising."""
    token = access_cookie or bearer or ""
    if hasattr(token, "value"):
        token = token.value
    if not isinstance(token, str):
        token = str(token)
    if not token:
        return None

    email = security.decode_access_token(token)
    if not email:
        return None

    user = db.query(User).filter(User.email == email).first()
    if not user or not user.is_active:
        return None
    return user


@router.post("/token", response_model=Token)
def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    access = security.create_access_token(user.email)
    refresh = security.create_refresh_token(user.email)
    security.set_auth_cookies(response, access, refresh)
    return {"access_token": access, "token_type": "bearer"}


@router.post("/token/refresh", response_model=Token)
def refresh_token(
    response: Response,
    db: Session = Depends(get_db),
    refresh_cookie: Optional[str] = Cookie(default=None, alias="refresh_token"),
):
    if not refresh_cookie:
        raise HTTPException(status_code=401, detail="Missing refresh token")
    try:
        payload = jwt.decode(
            refresh_cookie,
            security.SECRET_KEY,
            algorithms=[security.ALGORITHM]
        )
        if payload.get("typ") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        email: str = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    new_access = security.create_access_token(email)
    security.set_auth_cookies(response, new_access, refresh_cookie)
    return {"access_token": new_access, "token_type": "bearer"}


@router.post("/logout")
def logout(response: Response):
    security.clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me", response_model=UserMe)
def me(current_user: User = Depends(get_current_user)):
    return {"email": current_user.email, "name": current_user.name}


@router.post("/register", response_model=UserResponse)
def register(
    user_data: UserCreate,
    response: Response,
    db: Session = Depends(get_db),
):
    # Check if user exists
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    # Create user
    hashed_password = security.get_password_hash(user_data.password)
    user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        name=user_data.name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Auto-login after registration
    access = security.create_access_token(user.email)
    refresh = security.create_refresh_token(user.email)
    security.set_auth_cookies(response, access, refresh)

    return user
