"""Runtime settings, read from environment variables so the container can configure them."""

import os
from dataclasses import dataclass
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
# The supported documents and their fields, shared with the frontend.
DEFAULT_DOCUMENTS_PATH = BACKEND_DIR.parent / "documents.json"

# LiteLLM model id, routed through OpenRouter. openai/gpt-oss-120b is no longer offered
# for free on OpenRouter, so the default is a comparable free 120B model with structured outputs.
DEFAULT_LLM_MODEL = "openrouter/nvidia/nemotron-3-super-120b-a12b:free"


@dataclass(frozen=True)
class Settings:
    database_path: Path
    static_dir: Path
    openrouter_api_key: str | None = None
    llm_model: str = DEFAULT_LLM_MODEL
    documents_path: Path = DEFAULT_DOCUMENTS_PATH

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            database_path=Path(os.environ.get("PRELEGAL_DB_PATH", BACKEND_DIR / "data" / "prelegal.db")),
            static_dir=Path(os.environ.get("PRELEGAL_STATIC_DIR", BACKEND_DIR.parent / "frontend" / "out")),
            documents_path=Path(os.environ.get("PRELEGAL_DOCUMENTS_PATH", DEFAULT_DOCUMENTS_PATH)),
            openrouter_api_key=os.environ.get("OPEN_ROUTER_API_KEY") or None,
            llm_model=os.environ.get("PRELEGAL_LLM_MODEL") or DEFAULT_LLM_MODEL,
        )
