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
"""


def connect(database_path: Path) -> sqlite3.Connection:
    return sqlite3.connect(database_path)


def init_db(database_path: Path) -> None:
    """Delete any existing database and create a fresh one with the current schema."""
    database_path.parent.mkdir(parents=True, exist_ok=True)
    database_path.unlink(missing_ok=True)
    with closing(connect(database_path)) as conn:
        conn.executescript(SCHEMA)
