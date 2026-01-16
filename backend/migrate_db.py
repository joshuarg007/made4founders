#!/usr/bin/env python3
"""
Database migration script to add missing columns to the backup database.
Preserves all existing data while adding new schema requirements.
"""

import sqlite3
import sys

DB_PATH = "made4founders.db"

def get_table_columns(cursor, table_name):
    """Get list of column names for a table."""
    cursor.execute(f"PRAGMA table_info({table_name})")
    return [row[1] for row in cursor.fetchall()]

def add_column_if_missing(cursor, table, column, column_def):
    """Add a column to a table if it doesn't exist."""
    columns = get_table_columns(cursor, table)
    if column not in columns:
        try:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {column_def}")
            print(f"  ✓ Added {table}.{column}")
            return True
        except sqlite3.OperationalError as e:
            print(f"  ✗ Failed to add {table}.{column}: {e}")
            return False
    else:
        print(f"  - {table}.{column} already exists")
        return False

def migrate():
    print(f"Migrating database: {DB_PATH}\n")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    changes = 0

    # === USERS TABLE ===
    print("=== Users Table ===")
    user_columns = [
        ("organization_id", "INTEGER REFERENCES organizations(id)"),
        ("is_org_owner", "BOOLEAN DEFAULT 0"),
        ("oauth_provider", "VARCHAR(50)"),
        ("oauth_provider_id", "VARCHAR(255)"),
        ("avatar_url", "VARCHAR(500)"),
        ("email_verified", "BOOLEAN DEFAULT 0"),
        ("email_verification_token", "VARCHAR(255)"),
        ("email_verified_at", "DATETIME"),
        ("stripe_customer_id", "VARCHAR(255)"),
    ]
    for col, col_def in user_columns:
        if add_column_if_missing(cursor, "users", col, col_def):
            changes += 1

    # === ORGANIZATION_ID COLUMNS ===
    print("\n=== Adding organization_id to tables ===")
    tables_needing_org_id = [
        "bank_accounts",
        "business_identifiers",
        "business_info",
        "checklist_progress",
        "contacts",
        "credentials",
        "deadlines",
        "documents",
        "metrics",
        "products_offered",
        "products_used",
        "services",
        "task_boards",
        "vault_config",
        "web_links",
        "web_presence",
    ]

    for table in tables_needing_org_id:
        if add_column_if_missing(cursor, table, "organization_id", "INTEGER REFERENCES organizations(id)"):
            changes += 1

    # Commit and close
    conn.commit()

    # Verify users table
    print("\n=== Verification ===")
    cursor.execute("PRAGMA table_info(users)")
    user_cols = [row[1] for row in cursor.fetchall()]
    print(f"Users table columns ({len(user_cols)}): {user_cols}")

    # Check for any remaining issues
    expected_user_cols = [
        'id', 'email', 'hashed_password', 'name', 'role', 'is_active',
        'calendar_token', 'organization_id', 'is_org_owner', 'oauth_provider',
        'oauth_provider_id', 'avatar_url', 'email_verified',
        'email_verification_token', 'email_verified_at', 'stripe_customer_id',
        'created_at', 'updated_at'
    ]
    missing = set(expected_user_cols) - set(user_cols)
    if missing:
        print(f"\n⚠ Still missing from users: {missing}")
    else:
        print("\n✓ All expected user columns present")

    conn.close()

    print(f"\n=== Migration complete: {changes} changes made ===")
    return changes

if __name__ == "__main__":
    migrate()
