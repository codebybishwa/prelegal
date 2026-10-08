"""FastAPI entry point: serves the JSON API under /api and the statically exported frontend at /."""

from contextlib import asynccontextmanager, closing

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import Settings
from app.db import connect, init_db


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        init_db(settings.database_path)
        yield

    app = FastAPI(title="PreLegal", lifespan=lifespan)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        with closing(connect(settings.database_path)) as conn:
            conn.execute("SELECT 1")
        return {"status": "ok"}

    # Mounted last so it never shadows /api routes. Skipped when the frontend
    # hasn't been built (e.g. running the API alone during development).
    if settings.static_dir.is_dir():
        app.mount("/", StaticFiles(directory=settings.static_dir, html=True), name="frontend")

    return app


app = create_app()
