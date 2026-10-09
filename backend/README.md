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
| `PRELEGAL_DOCUMENTS_PATH` | `documents.json` (repo root) | Supported documents and their fields |

## Supported documents

[`documents.json`](../documents.json) defines every document PreLegal can draft: its templates,
party roles and fields. The frontend reads the same file to render cover pages. Field values
are strings keyed by field key, with party fields prefixed per party (`party1.name`). `app/documents.py`
loads it and validates values (ISO dates, `term` fields as 1-10 years or `"none"`). Tests check
that it covers every template in `catalog.json` and every term each template references.

## AI chat

`POST /api/chat` takes `{messages, documentId, values}` (the conversation, the selected document
or `null`, and its current values) and returns `{reply, documentId, values}` after the turn. The
AI picks the document from the conversation, explains when a requested document isn't supported
and offers the closest one, and can switch documents later, which keeps the answers the two
documents share. The server owns that state: it ignores unknown documents and drops invalid
values from the AI, and returns `422` for an unknown `documentId`. Calls go through
LiteLLM to OpenRouter with a strict JSON Schema response format. To keep costs at zero, the
backend refuses any model that isn't a `:free` OpenRouter model and never falls back to another
model: if the free model is unavailable or rate-limited, the endpoint returns `503` with a clear
message (`502` if the model's answer can't be parsed).

`openai/gpt-oss-120b:free` is no longer offered for free on OpenRouter, so the default is
NVIDIA Nemotron 3 Super 120B (free), which supports structured outputs.

Tests mock the LLM. To also run the live tests against the real free model:
`PRELEGAL_LIVE_LLM_TESTS=1 OPEN_ROUTER_API_KEY=... uv run pytest -k live`.
