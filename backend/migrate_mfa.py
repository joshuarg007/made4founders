#!/usr/bin/env python3
"""
Migration script to add MFA columns to users table.
Run this once to add the necessary columns.
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "made4founders.db")

def migrate():
    print(f"Migrating database: {DB_PATH}")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Check existing columns
    cursor.execute("PRAGMA table_info(users)")
    existing_columns = {row[1] for row in cursor.fetchall()}

    # MFA columns to add
    mfa_columns = [
        ("mfa_enabled", "BOOLEAN DEFAULT 0"),
        ("mfa_secret", "VARCHAR(255)"),
        ("mfa_backup_codes", "TEXT"),
    ]

    for col_name, col_type in mfa_columns:
        if col_name not in existing_columns:
            print(f"  Adding column: {col_name}")
            cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
        else:
            print(f"  Column already exists: {col_name}")

    conn.commit()
    conn.close()
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
