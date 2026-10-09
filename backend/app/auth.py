"""Accounts and sign-in sessions, using only the standard library.

Passwords are hashed with scrypt. A session is a random token held by the browser in an
HttpOnly cookie; the database keeps only its SHA-256, so a leaked database can't sign anyone in.
"""

import base64
import hashlib
import hmac
import secrets
import sqlite3
from dataclasses import dataclass

SESSION_COOKIE = "prelegal_session"
SESSION_DAYS = 7

# scrypt cost parameters (n=2^14, r=8, p=1: the interactive-login recommendation).
_SCRYPT_N, _SCRYPT_R, _SCRYPT_P = 2**14, 8, 1


class EmailTakenError(Exception):
    """An account with this email already exists."""


@dataclass(frozen=True)
class User:
    id: int
    email: str


def normalize_email(email: str) -> str:
    return email.strip().lower()


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


def _scrypt(password: str, salt: bytes, n: int, r: int, p: int) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=n, r=r, p=p, dklen=32)


def hash_password(password: str) -> str:
    """A self-describing hash: "scrypt$n$r$p$<salt>$<hash>" (base64 salt and hash)."""
    salt = secrets.token_bytes(16)
    digest = _scrypt(password, salt, _SCRYPT_N, _SCRYPT_R, _SCRYPT_P)
    return f"scrypt${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt, digest = stored.split("$")
        if scheme != "scrypt":
            return False
        actual = _scrypt(password, base64.b64decode(salt), int(n), int(r), int(p))
        return hmac.compare_digest(actual, base64.b64decode(digest))
    except ValueError:
        return False


# Checked against when the email is unknown, so a sign-in takes as long whether or not the account exists.
_DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


def create_user(conn: sqlite3.Connection, email: str, password: str) -> User:
    email = normalize_email(email)
    try:
        with conn:
            cursor = conn.execute(
                "INSERT INTO users (email, password_hash) VALUES (?, ?)", (email, hash_password(password))
            )
    except sqlite3.IntegrityError as exc:
        raise EmailTakenError("An account with this email already exists.") from exc
    return User(id=cursor.lastrowid, email=email)


def authenticate(conn: sqlite3.Connection, email: str, password: str) -> User | None:
    email = normalize_email(email)
    row = conn.execute("SELECT id, password_hash FROM users WHERE email = ?", (email,)).fetchone()
    if row is None:
        verify_password(password, _DUMMY_HASH)
        return None
    return User(id=row[0], email=email) if verify_password(password, row[1]) else None


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(conn: sqlite3.Connection, user: User) -> str:
    """Starts a session for the user and returns its token, to be set as the session cookie."""
    token = secrets.token_urlsafe(32)
    with conn:
        conn.execute(
            "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', ?))",
            (_token_hash(token), user.id, f"+{SESSION_DAYS} days"),
        )
    return token


def user_for_session(conn: sqlite3.Connection, token: str) -> User | None:
    row = conn.execute(
        "SELECT users.id, users.email FROM sessions JOIN users ON users.id = sessions.user_id "
        "WHERE sessions.token_hash = ? AND sessions.expires_at > datetime('now')",
        (_token_hash(token),),
    ).fetchone()
    return User(id=row[0], email=row[1]) if row else None


def delete_session(conn: sqlite3.Connection, token: str) -> None:
    with conn:
        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (_token_hash(token),))
