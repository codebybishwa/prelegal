import sqlite3
from contextlib import closing
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import DEFAULT_DOCUMENTS_PATH, DEFAULT_LLM_MODEL, Settings
from app.main import create_app


@pytest.fixture
def static_dir(tmp_path: Path) -> Path:
    """A minimal stand-in for the Next.js static export (trailingSlash: true layout)."""
    out = tmp_path / "out"
    (out / "create").mkdir(parents=True)
    (out / "index.html").write_text("<h1>login</h1>")
    (out / "create" / "index.html").write_text("<h1>create</h1>")
    (out / "404.html").write_text("<h1>not found</h1>")
    return out


@pytest.fixture
def settings(tmp_path: Path, static_dir: Path) -> Settings:
    return Settings(database_path=tmp_path / "data" / "prelegal.db", static_dir=static_dir)


@pytest.fixture
def client(settings: Settings):
    with TestClient(create_app(settings)) as client:
        yield client


def table_columns(database_path: Path, table: str) -> list[str]:
    with closing(sqlite3.connect(database_path)) as conn:
        return [row[1] for row in conn.execute(f"PRAGMA table_info({table})")]


def test_health(client: TestClient):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_startup_creates_users_table(client: TestClient, settings: Settings):
    assert table_columns(settings.database_path, "users") == ["id", "email", "password_hash", "created_at"]


def test_startup_recreates_database_from_scratch(settings: Settings):
    settings.database_path.parent.mkdir(parents=True)
    with closing(sqlite3.connect(settings.database_path)) as conn:
        conn.execute("CREATE TABLE leftover (x)")
        conn.commit()

    with TestClient(create_app(settings)):
        pass

    with closing(sqlite3.connect(settings.database_path)) as conn:
        tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    assert "leftover" not in tables
    assert "users" in tables


@pytest.mark.parametrize(
    ("path", "body"),
    [("/", "<h1>login</h1>"), ("/create/", "<h1>create</h1>"), ("/create", "<h1>create</h1>")],
)
def test_serves_frontend_pages(client: TestClient, path: str, body: str):
    response = client.get(path)
    assert response.status_code == 200
    assert response.text == body


def test_unknown_path_serves_404_page(client: TestClient):
    response = client.get("/does-not-exist")
    assert response.status_code == 404
    assert response.text == "<h1>not found</h1>"


def test_settings_from_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    monkeypatch.setenv("PRELEGAL_DB_PATH", str(tmp_path / "x.db"))
    monkeypatch.setenv("PRELEGAL_STATIC_DIR", str(tmp_path / "static"))
    monkeypatch.setenv("OPEN_ROUTER_API_KEY", "sk-test")
    monkeypatch.setenv("PRELEGAL_LLM_MODEL", "openrouter/some/model:free")
    monkeypatch.setenv("PRELEGAL_DOCUMENTS_PATH", str(tmp_path / "documents.json"))
    assert Settings.from_env() == Settings(
        database_path=tmp_path / "x.db",
        static_dir=tmp_path / "static",
        openrouter_api_key="sk-test",
        llm_model="openrouter/some/model:free",
        documents_path=tmp_path / "documents.json",
    )


def test_settings_default_documents_path_is_repo_definitions(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("PRELEGAL_DOCUMENTS_PATH", raising=False)
    assert Settings.from_env().documents_path == DEFAULT_DOCUMENTS_PATH
    assert DEFAULT_DOCUMENTS_PATH.is_file()


def test_settings_llm_defaults(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("OPEN_ROUTER_API_KEY", raising=False)
    monkeypatch.delenv("PRELEGAL_LLM_MODEL", raising=False)
    settings = Settings.from_env()
    assert settings.openrouter_api_key is None
    assert settings.llm_model == DEFAULT_LLM_MODEL
    assert settings.llm_model.endswith(":free")


def test_api_still_works_without_frontend_build(tmp_path: Path):
    settings = Settings(database_path=tmp_path / "prelegal.db", static_dir=tmp_path / "missing")
    with TestClient(create_app(settings)) as client:
        assert client.get("/api/health").status_code == 200
        assert client.get("/").status_code == 404
