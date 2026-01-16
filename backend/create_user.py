#!/usr/bin/env python3
"""One-time script to create a user."""
import sys
sys.path.insert(0, '/home/joshua/projects/made4founders/backend')

from app.database import SessionLocal, engine
from app.models import Base, User
from app.security import get_password_hash

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

# User details
EMAIL = "joshuarg007@gmail.com"
PASSWORD = "Porange333!!!"
NAME = "Joshua"
ROLE = "admin"

db = SessionLocal()
try:
    # Check if user already exists
    existing = db.query(User).filter(User.email == EMAIL).first()
    if existing:
        print(f"User {EMAIL} already exists. Updating password...")
        existing.hashed_password = get_password_hash(PASSWORD)
        existing.role = ROLE
        db.commit()
        print("Password updated successfully!")
    else:
        user = User(
            email=EMAIL,
            hashed_password=get_password_hash(PASSWORD),
            name=NAME,
            role=ROLE,
            is_active=True
        )
        db.add(user)
        db.commit()
        print(f"User {EMAIL} created successfully with role: {ROLE}")
finally:
    db.close()
