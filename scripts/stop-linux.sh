#!/usr/bin/env bash
# Stop and remove the PreLegal container.
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose down
echo "PreLegal stopped"
