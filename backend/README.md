# PreLegal backend

FastAPI app that serves the JSON API under `/api` and the statically exported frontend at `/`.

```bash
uv sync
uv run uvicorn app.main:app --reload --port 8000   # http://localhost:8000
uv run pytest
```

The SQLite database is temporary: it is deleted and recreated on every startup.

| Variable              | Default                      | Purpose                         |
| --------------------- | ---------------------------- | ------------------------------- |
| `PRELEGAL_DB_PATH`    | `backend/data/prelegal.db`   | SQLite database file            |
| `PRELEGAL_STATIC_DIR` | `frontend/out`               | Built frontend (`npm run build`) |
| `OPEN_ROUTER_API_KEY` | _(unset)_                    | OpenRouter key for the AI chat (from `.env`) |
| `PRELEGAL_LLM_MODEL`  | `openrouter/nvidia/nemotron-3-super-120b-a12b:free` | LiteLLM model id; must be a `:free` model |

## AI chat

`POST /api/chat` takes `{messages, nda}` (the conversation and current NDA fields) and returns
`{reply, updates}`, where `updates` holds only the fields the AI changed. Calls go through
LiteLLM to OpenRouter with a strict JSON Schema response format. To keep costs at zero, the
backend refuses any model that isn't a `:free` OpenRouter model and never falls back to another
model: if the free model is unavailable or rate-limited, the endpoint returns `503` with a clear
message (`502` if the model's answer can't be parsed).

`openai/gpt-oss-120b:free` is no longer offered for free on OpenRouter, so the default is
NVIDIA Nemotron 3 Super 120B (free), which supports structured outputs.

Tests mock the LLM. To also run the live test against the real free model:
`PRELEGAL_LIVE_LLM_TESTS=1 OPEN_ROUTER_API_KEY=... uv run pytest -k live`.
