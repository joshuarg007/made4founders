from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./made4founders.db")

# Extract database file path for backup operations
# Handles both sqlite:///./path and sqlite:////absolute/path formats
_db_path = DATABASE_URL.replace("sqlite:///", "")
DATABASE_PATH = os.path.abspath(_db_path)

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
