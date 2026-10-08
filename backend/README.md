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
