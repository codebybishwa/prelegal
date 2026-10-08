# ---------- Stage 1: build the frontend to static files ----------
FROM node:22-slim AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# The frontend reads agreement text from ../templates at build time.
COPY templates/ /build/templates/
RUN npm run build

# ---------- Stage 2: Python runtime serving the API and the static frontend ----------
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.11.28 /uv /usr/local/bin/uv
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend/app ./app
COPY --from=frontend /build/frontend/out /app/frontend/out

ENV PRELEGAL_STATIC_DIR=/app/frontend/out \
    PRELEGAL_DB_PATH=/app/data/prelegal.db \
    PATH="/app/backend/.venv/bin:$PATH"

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
