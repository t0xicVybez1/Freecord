#!/usr/bin/env bash
# FreeCord development startup script
# Usage: chmod +x scripts/start-dev.sh && ./scripts/start-dev.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Check if infra is running; bring it up if not
if ! docker exec freecord-postgres pg_isready -U freecord &>/dev/null 2>&1; then
  echo "[INFO] Infrastructure not running — starting it now..."
  if docker compose version &>/dev/null 2>&1; then
    docker compose -f infra/docker-compose.yml up -d
  else
    docker-compose -f infra/docker-compose.yml up -d
  fi

  echo "[INFO] Waiting for PostgreSQL..."
  TRIES=0
  until docker exec freecord-postgres pg_isready -U freecord &>/dev/null 2>&1; do
    TRIES=$((TRIES + 1))
    if [[ $TRIES -ge 30 ]]; then
      echo "[ERROR] PostgreSQL did not start in time." >&2
      exit 1
    fi
    echo -n "."
    sleep 2
  done
  echo
  echo "[INFO] Infrastructure is ready"
fi

echo "[INFO] Starting FreeCord in development mode..."
pnpm dev
