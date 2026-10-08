#!/usr/bin/env bash
# Build and start PreLegal in Docker. The database is recreated on every start.
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose up -d --build
echo "PreLegal is running at http://localhost:8000"
