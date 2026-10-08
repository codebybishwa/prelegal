# prelegal
A platform for drafting common legal agreements.

## Status

🚧 **In progress.** This project is under active development and is expected to be completed within 1 week.

## Running

Requires Docker. The app is built into a single container: FastAPI serves the API under `/api` and the
statically built Next.js frontend at `/`, on http://localhost:8000.

| OS      | Start                         | Stop                         |
| ------- | ----------------------------- | ---------------------------- |
| Mac     | `scripts/start-mac.sh`        | `scripts/stop-mac.sh`        |
| Linux   | `scripts/start-linux.sh`      | `scripts/stop-linux.sh`      |
| Windows | `scripts/start-windows.ps1`   | `scripts/stop-windows.ps1`   |

The SQLite database is temporary and is recreated from scratch every time the container starts.
Sign-in is a placeholder for now: any email and password are accepted.

## Development

- `frontend/`: Next.js app (`npm run dev`, `npm test`, `npm run build` → `frontend/out`)
- `backend/`: FastAPI `uv` project (`uv run uvicorn app.main:app --reload`, `uv run pytest`); see `backend/README.md`
- `templates/`: agreement templates, listed in `catalog.json`
