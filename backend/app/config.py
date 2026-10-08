"""Runtime settings, read from environment variables so the container can configure them."""

import os
from dataclasses import dataclass
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class Settings:
    database_path: Path
    static_dir: Path

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            database_path=Path(os.environ.get("PRELEGAL_DB_PATH", BACKEND_DIR / "data" / "prelegal.db")),
            static_dir=Path(os.environ.get("PRELEGAL_STATIC_DIR", BACKEND_DIR.parent / "frontend" / "out")),
        )
