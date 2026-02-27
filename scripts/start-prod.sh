#!/usr/bin/env bash
# FreeCord production startup script
# Usage: chmod +x scripts/start-prod.sh && ./scripts/start-prod.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

if [[ ! -f .env ]]; then
  echo "[ERROR] .env file not found. Run ./scripts/setup.sh first." >&2
  exit 1
fi

# Source .env so NODE_ENV etc. are available to build tools
set -a
# shellcheck source=/dev/null
. .env
set +a

# Select compose binary
if docker compose version &>/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE="docker-compose"
else
  echo "[ERROR] docker compose not found." >&2
  exit 1
fi

echo "[INFO] Building all applications..."
pnpm build

echo "[INFO] Running database migrations..."
pnpm --filter @freecord/api run db:migrate

echo "[INFO] Starting FreeCord production stack..."
$COMPOSE -f infra/docker-compose.prod.yml up -d

echo
echo "[INFO] FreeCord is running!"
echo "[INFO] Check logs with:"
echo "         $COMPOSE -f infra/docker-compose.prod.yml logs -f"
echo
echo "[INFO] To stop all services:"
echo "         $COMPOSE -f infra/docker-compose.prod.yml down"
