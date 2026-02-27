#!/usr/bin/env bash
# FreeCord Uninstall Script
# Removes all FreeCord containers, volumes, and optionally the project directory.
# Run with: chmod +x scripts/uninstall.sh && ./scripts/uninstall.sh
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
log_step()  { echo -e "\n${CYAN}>> $1${NC}"; }

confirm() {
  local prompt="$1"
  read -r -p "$(echo -e "${YELLOW}${prompt} [y/N]${NC} ")" reply
  [[ "$reply" =~ ^[Yy]$ ]]
}

# ---------------------------------------------------------------------------
# Privilege check
# ---------------------------------------------------------------------------
check_sudo() {
  if [[ $EUID -eq 0 ]]; then
    SUDO=""
  elif command -v sudo &>/dev/null; then
    SUDO="sudo"
    sudo -v || log_error "Could not acquire sudo privileges"
  else
    log_error "This script requires root or sudo access"
  fi
}

# ---------------------------------------------------------------------------
# Stop running Node processes (dev mode)
# ---------------------------------------------------------------------------
stop_node_processes() {
  log_step "Stopping any running FreeCord Node processes..."
  # Kill turbo / pnpm dev if running from this project
  pkill -f "turbo run" 2>/dev/null || true
  pkill -f "vite"      2>/dev/null || true
  log_info "Node processes stopped (if any were running)"
}

# ---------------------------------------------------------------------------
# Stop and remove Docker containers + volumes
# ---------------------------------------------------------------------------
remove_docker_resources() {
  log_step "Removing Docker containers and volumes..."

  if ! command -v docker &>/dev/null; then
    log_warn "Docker not found — skipping container removal"
    return
  fi

  if $SUDO docker compose version &>/dev/null 2>&1; then
    COMPOSE="$SUDO docker compose"
  elif command -v docker-compose &>/dev/null; then
    COMPOSE="$SUDO docker-compose"
  else
    log_warn "docker compose not found — removing containers manually"
    COMPOSE=""
  fi

  if [[ -n "$COMPOSE" && -f "$PROJECT_ROOT/infra/docker-compose.yml" ]]; then
    cd "$PROJECT_ROOT"
    $COMPOSE -f infra/docker-compose.yml down --volumes --remove-orphans 2>/dev/null || true
    log_info "Compose stack removed (containers + volumes)"
  else
    # Fallback: remove by name
    for container in freecord-postgres freecord-redis freecord-minio; do
      if $SUDO docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
        $SUDO docker rm -f "$container" 2>/dev/null || true
        log_info "Removed container: $container"
      fi
    done
    # Remove named volumes
    for vol in infra_postgres_data infra_redis_data infra_minio_data \
               freecord_postgres_data freecord_redis_data freecord_minio_data; do
      $SUDO docker volume rm "$vol" 2>/dev/null || true
    done
    log_info "Docker volumes removed"
  fi

  # Remove prod containers if present
  if [[ -f "$PROJECT_ROOT/infra/docker-compose.prod.yml" ]]; then
    $SUDO docker compose -f "$PROJECT_ROOT/infra/docker-compose.prod.yml" down --volumes --remove-orphans 2>/dev/null || true
  fi
}

# ---------------------------------------------------------------------------
# Remove node_modules
# ---------------------------------------------------------------------------
remove_node_modules() {
  log_step "Removing node_modules..."
  find "$PROJECT_ROOT" -maxdepth 4 -name "node_modules" -type d -prune \
    -exec rm -rf {} + 2>/dev/null || true
  log_info "node_modules removed"
}

# ---------------------------------------------------------------------------
# Remove build artifacts
# ---------------------------------------------------------------------------
remove_build_artifacts() {
  log_step "Removing build artifacts..."
  find "$PROJECT_ROOT" -maxdepth 4 \( -name "dist" -o -name "build" \) -type d -prune \
    -exec rm -rf {} + 2>/dev/null || true
  rm -rf "$PROJECT_ROOT/.turbo" 2>/dev/null || true
  log_info "Build artifacts removed"
}

# ---------------------------------------------------------------------------
# Remove .env
# ---------------------------------------------------------------------------
remove_env() {
  if [[ -f "$PROJECT_ROOT/.env" ]]; then
    log_step "Removing .env file..."
    rm -f "$PROJECT_ROOT/.env"
    log_info ".env removed"
  fi
}

# ---------------------------------------------------------------------------
# Remove project directory entirely
# ---------------------------------------------------------------------------
remove_project_dir() {
  log_step "Removing project directory: $PROJECT_ROOT"
  cd /tmp  # step out before deleting cwd
  rm -rf "$PROJECT_ROOT"
  log_info "Project directory removed"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  echo -e "${RED}"
  echo "  ___             ____               _"
  echo " | __| _ _  ___  / ___|  ___  _ _  __| |"
  echo " | _| | '_|/ -_) |     / _ \| '_|/ _\` |"
  echo " |_|  |_|  \___| \____|\\___/|_|  \__,_|"
  echo -e "${NC}"
  echo -e "${RED}FreeCord Uninstall Script${NC}"
  echo "================================="
  echo
  echo -e "${YELLOW}This will remove FreeCord's Docker containers, volumes (ALL DATA), and build files.${NC}"
  echo

  confirm "Are you sure you want to uninstall FreeCord?" || { echo "Aborted."; exit 0; }

  check_sudo
  stop_node_processes
  remove_docker_resources
  remove_env
  remove_build_artifacts

  if confirm "Also remove node_modules (frees disk space, requires pnpm install to reinstall)?"; then
    remove_node_modules
  fi

  if confirm "Delete the entire project directory ($PROJECT_ROOT)? THIS IS IRREVERSIBLE."; then
    remove_project_dir
    echo
    echo -e "${GREEN}FreeCord has been completely removed.${NC}"
  else
    echo
    echo -e "${GREEN}FreeCord services and data removed. Project files kept at: $PROJECT_ROOT${NC}"
  fi
}

main "$@"
