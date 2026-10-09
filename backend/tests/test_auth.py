import sqlite3
from contextlib import closing
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.auth import SESSION_COOKIE, hash_password, verify_password
from app.config import Settings
from app.main import create_app

PASSWORD = "correct horse"


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(database_path=tmp_path / "prelegal.db", static_dir=tmp_path / "missing")


@pytest.fixture
def client(settings: Settings):
    with TestClient(create_app(settings)) as client:
        yield client


def sign_up(client: TestClient, email: str = "ada@acme.com", password: str = PASSWORD):
    return client.post("/api/auth/signup", json={"email": email, "password": password})


def sign_in(client: TestClient, email: str = "ada@acme.com", password: str = PASSWORD):
    return client.post("/api/auth/signin", json={"email": email, "password": password})


def query(settings: Settings, sql: str) -> list[tuple]:
    with closing(sqlite3.connect(settings.database_path)) as conn:
        return conn.execute(sql).fetchall()


# ---------- Sign up ----------


def test_sign_up_creates_account_and_signs_in(client: TestClient, settings: Settings):
    response = sign_up(client, "  Ada@Acme.com ")

    assert response.status_code == 201
    assert response.json() == {"email": "ada@acme.com"}
    cookie = response.headers["set-cookie"]
    assert cookie.startswith(f"{SESSION_COOKIE}=")
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie
    assert "Secure" not in cookie
    assert client.get("/api/auth/me").json() == {"email": "ada@acme.com"}

    [(email, password_hash)] = query(settings, "SELECT email, password_hash FROM users")
    assert email == "ada@acme.com"
    assert password_hash.startswith("scrypt$")
    assert PASSWORD not in password_hash


def test_sign_up_rejects_taken_email_in_any_case(client: TestClient):
    sign_up(client)

    response = sign_up(client, "ADA@acme.com", "another password")

    assert response.status_code == 409
    assert response.json() == {"detail": "An account with this email already exists."}


@pytest.mark.parametrize(
    ("email", "password"),
    [("ada@acme.com", "short"), ("not-an-email", PASSWORD), ("ada@acme.com", "x" * 129)],
)
def test_sign_up_validates_input(client: TestClient, email: str, password: str):
    assert sign_up(client, email, password).status_code == 422


def test_secure_cookie_when_configured(tmp_path: Path):
    settings = Settings(database_path=tmp_path / "x.db", static_dir=tmp_path / "missing", cookie_secure=True)
    with TestClient(create_app(settings)) as client:
        assert "Secure" in sign_up(client).headers["set-cookie"]


# ---------- Sign in / out ----------


def test_sign_in_with_any_email_case(client: TestClient):
    sign_up(client)
    client.cookies.clear()

    response = sign_in(client, "ADA@ACME.COM")

    assert response.status_code == 200
    assert response.json() == {"email": "ada@acme.com"}
    assert client.get("/api/auth/me").status_code == 200


@pytest.mark.parametrize(("email", "password"), [("ada@acme.com", "wrong password"), ("bob@acme.com", PASSWORD)])
def test_sign_in_rejects_bad_credentials_with_one_message(client: TestClient, email: str, password: str):
    sign_up(client)
    client.cookies.clear()

    response = sign_in(client, email, password)

    assert response.status_code == 401
    assert response.json() == {"detail": "Incorrect email or password."}
    assert "set-cookie" not in response.headers


def test_me_requires_a_session(client: TestClient):
    response = client.get("/api/auth/me")

    assert response.status_code == 401
    assert response.json() == {"detail": "Please sign in to continue."}


def test_forged_session_is_rejected(client: TestClient):
    client.cookies.set(SESSION_COOKIE, "made-up-token")

    assert client.get("/api/auth/me").status_code == 401


def test_sign_out_ends_the_session(client: TestClient, settings: Settings):
    sign_up(client)
    token = client.cookies[SESSION_COOKIE]

    response = client.post("/api/auth/signout")

    assert response.status_code == 204
    assert f'{SESSION_COOKIE}=""' in response.headers["set-cookie"]
    # Replaying the old cookie doesn't work either: the session is gone from the database.
    client.cookies.set(SESSION_COOKIE, token)
    assert client.get("/api/auth/me").status_code == 401
    assert query(settings, "SELECT * FROM sessions") == []


def test_sign_out_without_session_is_fine(client: TestClient):
    assert client.post("/api/auth/signout").status_code == 204


def test_sessions_store_only_a_token_hash(client: TestClient, settings: Settings):
    sign_up(client)
    token = client.cookies[SESSION_COOKIE]

    [(token_hash,)] = query(settings, "SELECT token_hash FROM sessions")
    assert token_hash != token
    assert len(token_hash) == 64


def test_expired_session_is_rejected(client: TestClient, settings: Settings):
    sign_up(client)
    with closing(sqlite3.connect(settings.database_path)) as conn:
        conn.execute("UPDATE sessions SET expires_at = datetime('now', '-1 second')")
        conn.commit()

    assert client.get("/api/auth/me").status_code == 401


def test_restart_wipes_accounts_and_sessions(settings: Settings):
    with TestClient(create_app(settings)) as client:
        sign_up(client)
        cookies = dict(client.cookies)

    with TestClient(create_app(settings), cookies=cookies) as client:
        assert client.get("/api/auth/me").status_code == 401
        assert sign_in(client).status_code == 401


def test_chat_requires_a_session(client: TestClient):
    response = client.post("/api/chat", json={"messages": [{"role": "user", "content": "Hi"}]})

    assert response.status_code == 401


def test_drafts_require_a_session(client: TestClient):
    assert client.get("/api/drafts").status_code == 401
    assert client.get("/api/drafts/1").status_code == 401


# ---------- Password hashing ----------


def test_password_hash_round_trip():
    stored = hash_password(PASSWORD)

    assert verify_password(PASSWORD, stored)
    assert not verify_password("wrong", stored)
    assert hash_password(PASSWORD) != stored  # salted


@pytest.mark.parametrize("stored", ["", "plain", "bcrypt$1$2$3$x$y", "scrypt$x$8$1$AA==$AA=="])
def test_malformed_hash_never_verifies(stored: str):
    assert not verify_password(PASSWORD, stored)
