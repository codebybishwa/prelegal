"""SQLite storage. The database is temporary: it is rebuilt from scratch on every startup."""

import sqlite3
from contextlib import closing
from pathlib import Path

SCHEMA = """
CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Only a hash of each session token is stored, so a leaked database can't sign anyone in.
CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
);

-- A document a user has drafted through the chat, saved after every turn.
CREATE TABLE drafts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id   TEXT NOT NULL,
    values_json   TEXT NOT NULL,
    messages_json TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX drafts_by_user ON drafts(user_id, updated_at DESC);
"""


def connect(database_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(database_path)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(database_path: Path) -> None:
    """Delete any existing database and create a fresh one with the current schema."""
    database_path.parent.mkdir(parents=True, exist_ok=True)
    database_path.unlink(missing_ok=True)
    with closing(connect(database_path)) as conn:
        conn.executescript(SCHEMA)
