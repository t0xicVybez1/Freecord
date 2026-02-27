#!/usr/bin/env bash
# FreeCord Setup Script
# Run with: chmod +x scripts/setup.sh && ./scripts/setup.sh
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

print_banner() {
  echo -e "${CYAN}"
  echo "  ___             ____               _"
  echo " | __| _ _  ___  / ___|  ___  _ _  __| |"
  echo " | _| | '_|/ -_) |     / _ \| '_|/ _\` |"
  echo " |_|  |_|  \___| \____|\\___/|_|  \__,_|"
  echo -e "${NC}"
  echo -e "${BLUE}FreeCord Setup Script${NC}"
  echo "================================="
  echo
}

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
log_step()  { echo -e "\n${CYAN}>> $1${NC}"; }

# ---------------------------------------------------------------------------
# OS detection
# ---------------------------------------------------------------------------
check_os() {
  log_step "Checking operating system..."
  if [[ "$(uname -s)" != "Linux" ]]; then
    log_error "This setup script only supports Linux. For other platforms, see SELF_HOSTING.md"
  fi

  if command -v lsb_release &>/dev/null; then
    OS_ID=$(lsb_release -si 2>/dev/null | tr '[:upper:]' '[:lower:]')
    OS_VERSION=$(lsb_release -sr 2>/dev/null)
    log_info "Detected: $OS_ID $OS_VERSION"
    case "$OS_ID" in
      ubuntu|debian|linuxmint|pop) ;;
      *)
        log_warn "Unsupported distro: $OS_ID. This script is optimized for Ubuntu/Debian."
        read -r -p "Continue anyway? [y/N] " reply
        [[ "$reply" =~ ^[Yy]$ ]] || exit 1
        ;;
    esac
  elif [[ -f /etc/os-release ]]; then
    # shellcheck source=/dev/null
    . /etc/os-release
    log_info "Detected: $NAME"
  fi
}

# ---------------------------------------------------------------------------
# Privilege check
# ---------------------------------------------------------------------------
check_sudo() {
  log_step "Checking permissions..."
  if [[ $EUID -eq 0 ]]; then
    SUDO=""
    log_info "Running as root"
  elif command -v sudo &>/dev/null; then
    SUDO="sudo"
    log_info "Using sudo for privileged commands"
    sudo -v || log_error "Could not acquire sudo privileges"
  else
    log_error "This script requires root or sudo access"
  fi
}

# ---------------------------------------------------------------------------
# Prerequisites (curl, gnupg, etc.)
# ---------------------------------------------------------------------------
install_prerequisites() {
  log_step "Installing prerequisites..."
  $SUDO apt-get update -qq
  $SUDO apt-get install -y -qq \
    curl \
    wget \
    gnupg \
    ca-certificates \
    apt-transport-https \
    git \
    build-essential \
    python3 \
    openssl \
    lsb-release
  log_info "Prerequisites installed"
}

# ---------------------------------------------------------------------------
# Node.js 20
# ---------------------------------------------------------------------------
install_nodejs() {
  log_step "Installing Node.js 20..."
  if command -v node &>/dev/null; then
    NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ "$NODE_VER" -ge 20 ]]; then
      log_info "Node.js $(node -v) is already installed"
      return
    fi
    log_warn "Node.js $(node -v) found but version 20+ required. Upgrading..."
  fi

  curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash -
  $SUDO apt-get install -y nodejs
  log_info "Node.js $(node -v) installed"
}

# ---------------------------------------------------------------------------
# pnpm
# ---------------------------------------------------------------------------
install_pnpm() {
  log_step "Installing pnpm..."
  if command -v pnpm &>/dev/null; then
    log_info "pnpm $(pnpm -v) is already installed"
    return
  fi
  npm install -g pnpm@9.15.0
  log_info "pnpm $(pnpm -v) installed"
}

# ---------------------------------------------------------------------------
# Docker + Docker Compose plugin (official repo)
# ---------------------------------------------------------------------------
install_docker() {
  log_step "Installing Docker..."
  if command -v docker &>/dev/null; then
    log_info "Docker $(docker -v | awk '{print $3}' | tr -d ',') is already installed"
    # Ensure user is in docker group
    if [[ $EUID -ne 0 ]] && ! groups "$USER" | grep -q docker; then
      $SUDO usermod -aG docker "$USER"
      log_warn "Added $USER to docker group. You may need to log out and back in."
    fi
    return
  fi

  # Remove conflicting old packages
  for pkg in docker docker.io docker-doc docker-compose podman-docker containerd runc; do
    $SUDO apt-get remove -y "$pkg" 2>/dev/null || true
  done

  # Add Docker's official GPG key
  $SUDO install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | $SUDO gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  $SUDO chmod a+r /etc/apt/keyrings/docker.gpg

  # Set up the repository
  # shellcheck source=/dev/null
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu \
$(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | $SUDO tee /etc/apt/sources.list.d/docker.list > /dev/null

  $SUDO apt-get update -qq
  $SUDO apt-get install -y \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin

  # Add current user to docker group (skip if root)
  if [[ $EUID -ne 0 ]]; then
    $SUDO usermod -aG docker "$USER"
    log_warn "Added $USER to docker group. You may need to run: newgrp docker"
  fi

  $SUDO systemctl enable docker
  $SUDO systemctl start docker

  log_info "Docker $(docker -v | awk '{print $3}' | tr -d ',') installed"
}

# ---------------------------------------------------------------------------
# Generate a cryptographically-secure random string
# ---------------------------------------------------------------------------
generate_secret() {
  openssl rand -base64 48 | tr -d '\n/+=' | head -c 64
}

# ---------------------------------------------------------------------------
# .env setup
# ---------------------------------------------------------------------------
setup_env() {
  log_step "Setting up environment configuration..."
  cd "$PROJECT_ROOT"

  if [[ -f .env ]]; then
    log_info ".env file already exists — skipping generation."
    return
  fi

  if [[ ! -f .env.example ]]; then
    log_warn ".env.example not found; creating a minimal .env skeleton."
    cat > .env << 'ENVEOF'
# FreeCord Environment Configuration
# Generated by setup.sh — review ALL values before production use.

# ---- PostgreSQL ----
POSTGRES_USER=freecord
POSTGRES_PASSWORD=change-me-in-production
POSTGRES_DB=freecord
DATABASE_URL=postgresql://freecord:change-me-in-production@localhost:5432/freecord

# ---- Redis ----
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# ---- Auth ----
JWT_SECRET=change-me-to-a-random-32-char-string
JWT_REFRESH_SECRET=change-me-to-another-random-32-char-string
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ---- API ----
API_PORT=3000
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development

# ---- Gateway ----
GATEWAY_PORT=8080
API_INTERNAL_URL=http://localhost:3000

# ---- Voice ----
VOICE_PORT=8081
VOICE_ANNOUNCED_IP=127.0.0.1
VOICE_RTC_MIN_PORT=40000
VOICE_RTC_MAX_PORT=49999

# ---- CDN / MinIO ----
CDN_PORT=3001
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=freecord

# ---- Web / Vite (build-time) ----
VITE_API_URL=http://localhost:3000
VITE_GATEWAY_URL=ws://localhost:8080/gateway
VITE_CDN_URL=http://localhost:3001
VITE_VOICE_URL=http://localhost:8081
ENVEOF
  else
    cp .env.example .env
  fi

  # ---- Inject generated secrets ----
  JWT_SECRET=$(generate_secret)
  JWT_REFRESH_SECRET=$(generate_secret)
  POSTGRES_PASSWORD=$(generate_secret | head -c 24)
  MINIO_SECRET=$(generate_secret | head -c 24)

  # Replace placeholder values
  sed -i "s|change-me-to-a-random-32-char-string|${JWT_SECRET}|" .env
  sed -i "s|change-me-to-another-random-32-char-string|${JWT_REFRESH_SECRET}|" .env
  # Update POSTGRES_PASSWORD line
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|" .env
  # Keep DATABASE_URL in sync with new password
  sed -i "s|postgresql://freecord:change-me-in-production|postgresql://freecord:${POSTGRES_PASSWORD}|" .env
  sed -i "s|^MINIO_SECRET_KEY=minioadmin|MINIO_SECRET_KEY=${MINIO_SECRET}|" .env

  log_info ".env created with generated secrets"
  echo
  echo -e "${YELLOW}Before going to production, review and update:${NC}"
  echo "   - VITE_API_URL, VITE_GATEWAY_URL, VITE_CDN_URL, VITE_VOICE_URL"
  echo "   - VOICE_ANNOUNCED_IP  (set to your server's public IP)"
  echo "   - CORS_ORIGIN         (set to your frontend domain)"
  echo "   - NODE_ENV=production"
  echo
  read -r -p "Press Enter to continue..."
}

# ---------------------------------------------------------------------------
# pnpm install
# ---------------------------------------------------------------------------
install_dependencies() {
  log_step "Installing Node.js dependencies..."
  cd "$PROJECT_ROOT"
  pnpm install --frozen-lockfile
  log_info "Dependencies installed"
}

# ---------------------------------------------------------------------------
# Build shared packages
# ---------------------------------------------------------------------------
build_packages() {
  log_step "Building shared packages..."
  cd "$PROJECT_ROOT"
  for pkg in types permissions snowflake logger markdown; do
    if pnpm list --filter "@freecord/${pkg}" 2>/dev/null | grep -q "@freecord/${pkg}"; then
      pnpm --filter "@freecord/${pkg}" build
      log_info "  Built @freecord/${pkg}"
    else
      log_warn "  Package @freecord/${pkg} not found — skipping"
    fi
  done
  log_info "Shared packages built"
}

# ---------------------------------------------------------------------------
# Start infra via Docker Compose
# ---------------------------------------------------------------------------
start_infra() {
  log_step "Starting infrastructure services (PostgreSQL, Redis, MinIO)..."
  cd "$PROJECT_ROOT"

  # Prefer the compose plugin (docker compose) over the legacy binary
  if docker compose version &>/dev/null 2>&1; then
    COMPOSE="docker compose"
  elif command -v docker-compose &>/dev/null; then
    COMPOSE="docker-compose"
    log_warn "Using legacy docker-compose binary. Consider upgrading to Docker Compose v2."
  else
    log_error "docker compose not found. Please install the Docker Compose plugin."
  fi

  $COMPOSE -f infra/docker-compose.yml up -d
  log_info "Infrastructure services started"

  # --- Wait for PostgreSQL ---
  log_step "Waiting for PostgreSQL to be ready..."
  MAX_TRIES=30
  TRIES=0
  until docker exec freecord-postgres pg_isready -U freecord &>/dev/null 2>&1; do
    TRIES=$((TRIES + 1))
    if [[ $TRIES -ge $MAX_TRIES ]]; then
      log_error "PostgreSQL failed to start after ${MAX_TRIES} attempts. Check: docker logs freecord-postgres"
    fi
    echo -n "."
    sleep 2
  done
  echo
  log_info "PostgreSQL is ready"

  # --- Wait for Redis ---
  log_step "Waiting for Redis to be ready..."
  TRIES=0
  until docker exec freecord-redis redis-cli ping &>/dev/null 2>&1; do
    TRIES=$((TRIES + 1))
    if [[ $TRIES -ge $MAX_TRIES ]]; then
      log_error "Redis failed to start after ${MAX_TRIES} attempts. Check: docker logs freecord-redis"
    fi
    echo -n "."
    sleep 2
  done
  echo
  log_info "Redis is ready"

  # --- Wait for MinIO ---
  log_step "Waiting for MinIO to be ready..."
  TRIES=0
  until curl -sf http://localhost:9000/minio/health/live &>/dev/null; do
    TRIES=$((TRIES + 1))
    if [[ $TRIES -ge $MAX_TRIES ]]; then
      log_error "MinIO failed to start after ${MAX_TRIES} attempts. Check: docker logs freecord-minio"
    fi
    echo -n "."
    sleep 2
  done
  echo
  log_info "MinIO is ready (console at http://localhost:9001)"
}

# ---------------------------------------------------------------------------
# Prisma: generate client + migrate
# ---------------------------------------------------------------------------
run_migrations() {
  log_step "Running database migrations..."
  cd "$PROJECT_ROOT"

  pnpm --filter @freecord/api run db:generate
  pnpm --filter @freecord/api run db:migrate

  log_info "Database migrations completed"
}

# ---------------------------------------------------------------------------
# Make all other scripts executable
# ---------------------------------------------------------------------------
make_scripts_executable() {
  log_step "Making scripts executable..."
  chmod +x "$SCRIPT_DIR/start-dev.sh"  2>/dev/null || true
  chmod +x "$SCRIPT_DIR/start-prod.sh" 2>/dev/null || true
  chmod +x "$SCRIPT_DIR/reset-db.sh"  2>/dev/null || true
  log_info "Scripts are executable"
}

# ---------------------------------------------------------------------------
# Success banner
# ---------------------------------------------------------------------------
print_success() {
  echo
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}  FreeCord Setup Complete!${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo
  echo -e "${CYAN}Start FreeCord in development mode:${NC}"
  echo "  cd $PROJECT_ROOT"
  echo "  pnpm dev"
  echo "  -- or --"
  echo "  ./scripts/start-dev.sh"
  echo
  echo -e "${CYAN}Services will be available at:${NC}"
  echo "  Web App:  http://localhost:5173"
  echo "  API:      http://localhost:3000"
  echo "  Gateway:  ws://localhost:8080/gateway"
  echo "  Voice:    http://localhost:8081"
  echo "  CDN:      http://localhost:3001"
  echo "  MinIO:    http://localhost:9001  (admin console)"
  echo
  echo -e "${CYAN}For production deployment, see:${NC}"
  echo "  SELF_HOSTING.md"
  echo
  echo -e "${YELLOW}Note: If you were added to the 'docker' group,${NC}"
  echo -e "${YELLOW}log out and back in (or run 'newgrp docker') for it to take effect.${NC}"
  echo
}

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
main() {
  print_banner
  check_os
  check_sudo
  install_prerequisites
  install_nodejs
  install_pnpm
  install_docker
  setup_env
  install_dependencies
  build_packages
  start_infra
  run_migrations
  make_scripts_executable
  print_success
}

main "$@"
