# Self-Hosting FreeCord

This guide covers how to self-host FreeCord on a Linux server.

## Requirements

- Linux (Ubuntu 22.04+ or Debian 12+ recommended)
- 2+ CPU cores, 4 GB+ RAM
- 20 GB+ storage
- Ports 80 and 443 open (or configure a different reverse proxy)
- A domain name (required for voice/WebRTC to work over HTTPS)

## Quick Start (Dev)

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourorg/freecord.git
   cd freecord
   ```

2. **Run the setup script**
   ```bash
   chmod +x scripts/setup.sh
   ./scripts/setup.sh
   ```
   The script will:
   - Install Node.js 20, pnpm, Docker, and Docker Compose
   - Copy `.env.example` to `.env` and generate secure secrets
   - Start PostgreSQL, Redis, and MinIO via Docker Compose
   - Run database migrations
   - Build all packages

3. **Start development servers**
   ```bash
   ./scripts/start-dev.sh
   ```

4. **Open the app**
   Navigate to `http://localhost:5173`

## Production Deployment

1. **Configure environment variables**

   Edit `.env` and set production values:
   ```bash
   NODE_ENV=production
   API_URL=https://api.yourdomain.com
   GATEWAY_URL=wss://gateway.yourdomain.com
   CDN_URL=https://cdn.yourdomain.com
   CORS_ORIGIN=https://yourdomain.com
   ```

2. **Configure DNS**

   Point these subdomains to your server:
   - `yourdomain.com` → web app
   - `api.yourdomain.com` → API (port 3000)
   - `gateway.yourdomain.com` → Gateway WebSocket (port 8080)
   - `cdn.yourdomain.com` → CDN (port 3001)
   - `voice.yourdomain.com` → Voice (port 8081)

3. **Set up TLS (required for WebRTC)**
   ```bash
   sudo apt install certbot
   sudo certbot certonly --standalone -d yourdomain.com -d api.yourdomain.com \
     -d gateway.yourdomain.com -d cdn.yourdomain.com -d voice.yourdomain.com
   ```
   Update `infra/nginx/nginx.conf` to use your certificate paths.

4. **Build and start all services**
   ```bash
   ./scripts/start-prod.sh
   ```

5. **Set up systemd service (optional)**
   ```bash
   sudo cp scripts/freecord.service /etc/systemd/system/
   sudo systemctl enable freecord
   sudo systemctl start freecord
   ```

## Architecture Overview

```
Client (Browser)
    │
    ├── HTTPS ──► Nginx Reverse Proxy
    │                   │
    │                   ├── /api/         ──► API Service    (Fastify + Prisma)
    │                   ├── /gateway      ──► Gateway        (WebSocket + Redis)
    │                   ├── /cdn/         ──► CDN Service    (Fastify + MinIO)
    │                   ├── /voice/       ──► Voice Service  (MediaSoup WebRTC)
    │                   └── /            ──► Web App         (React SPA)
    │
    └── Infrastructure
            ├── PostgreSQL  (persistent data)
            ├── Redis       (pub/sub, sessions, cache)
            └── MinIO       (file storage, S3-compatible)
```

## Configuration Reference

All configuration is done through environment variables. See `.env.example` for a full list.

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/freecord` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `JWT_SECRET` | Secret for access tokens (min 32 chars) | (generate with `openssl rand -hex 32`) |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens (min 32 chars) | (generate with `openssl rand -hex 32`) |
| `INTERNAL_TOKEN` | Shared secret between API and Gateway | (generate with `openssl rand -hex 32`) |
| `MINIO_ENDPOINT` | MinIO server endpoint | `localhost` |
| `MINIO_ACCESS_KEY` | MinIO access key | `minioadmin` |
| `MINIO_SECRET_KEY` | MinIO secret key | `minioadmin` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_PORT` | `3000` | API server port |
| `GATEWAY_PORT` | `8080` | WebSocket gateway port |
| `VOICE_PORT` | `8081` | Voice HTTP API port |
| `CDN_PORT` | `3001` | CDN server port |
| `VOICE_RTC_MIN_PORT` | `40000` | MediaSoup RTC port range start |
| `VOICE_RTC_MAX_PORT` | `49999` | MediaSoup RTC port range end |
| `MAX_FILE_SIZE` | `10485760` | Max upload size in bytes (default 10MB) |
| `RATE_LIMIT_MAX` | `100` | Max requests per minute |

## Backup and Restore

### Database Backup
```bash
docker exec freecord-postgres pg_dump -U freecord freecord > backup_$(date +%Y%m%d).sql
```

### Database Restore
```bash
docker exec -i freecord-postgres psql -U freecord freecord < backup_20240101.sql
```

### File Storage Backup
Use MinIO's `mc` client:
```bash
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mirror local/freecord-attachments ./backup/attachments
mc mirror local/freecord-avatars ./backup/avatars
```

## Troubleshooting

### Gateway won't connect
- Check that `INTERNAL_TOKEN` matches between API and Gateway `.env`
- Ensure Redis is running: `docker compose ps`
- Check gateway logs: `docker compose logs gateway`

### Voice not working
- WebRTC requires HTTPS in production — ensure TLS is configured
- Open UDP ports 40000-49999 in your firewall
- Set `VOICE_ANNOUNCED_IP` to your server's public IP address

### Database migration failed
```bash
./scripts/reset-db.sh  # WARNING: destroys all data
```

### Files not uploading
- Check MinIO is running: `docker compose ps`
- Verify `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` in `.env`
- Check CDN logs: `docker compose logs cdn`

## Updating

```bash
git pull origin main
pnpm install
pnpm run build
docker compose -f infra/docker-compose.prod.yml up --build -d
```
