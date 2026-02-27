#!/usr/bin/env bash
# FreeCord database reset script — DESTRUCTIVE, use with care
# Usage: chmod +x scripts/reset-db.sh && ./scripts/reset-db.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "WARNING: This will permanently delete ALL FreeCord data!"
echo "         This includes all users, guilds, messages, and files."
echo
read -r -p "Type 'yes' to confirm: " confirm

if [[ "$confirm" != "yes" ]]; then
  echo "Aborted."
  exit 0
fi

# Select compose binary
if docker compose version &>/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE="docker-compose"
else
  echo "[ERROR] docker compose not found." >&2
  exit 1
fi

echo "[INFO] Stopping PostgreSQL..."
$COMPOSE -f infra/docker-compose.yml stop postgres || true

echo "[INFO] Removing PostgreSQL container..."
$COMPOSE -f infra/docker-compose.yml rm -f postgres || true

echo "[INFO] Removing PostgreSQL data volume..."
docker volume rm freecord_postgres_data 2>/dev/null || \
  docker volume rm "$(basename "$PROJECT_ROOT")_postgres_data" 2>/dev/null || \
  echo "[WARN] Could not remove volume (it may not exist or have a different name — that is OK)"

echo "[INFO] Restarting PostgreSQL..."
$COMPOSE -f infra/docker-compose.yml up -d postgres

echo "[INFO] Waiting for PostgreSQL to be ready..."
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

echo "[INFO] Re-running migrations..."
pnpm --filter @freecord/api run db:migrate

echo
echo "[INFO] Database reset complete."
