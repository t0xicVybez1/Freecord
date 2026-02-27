# FreeCord

A fully-featured, self-hosted Discord alternative. Open source, no subscriptions, no data harvesting.

---

## Features

### Messaging
- Real-time text messaging via WebSocket gateway
- Full Markdown formatting (bold, italic, code blocks, blockquotes, spoilers)
- File attachments — images, videos, audio, documents up to 100 MB
- Message editing and deletion with edit history
- Reply threads and inline message references
- Pinned messages per channel
- Message reactions with Unicode emoji and custom server emoji
- Bulk message deletion (moderator tool)
- Typing indicators with debounce
- Read states and unread message tracking per channel
- Full-text message search

### Servers (Guilds)
- Create and manage servers with full admin controls
- Server icon, banner image, and description
- Channel categories with drag-and-drop ordering
- Text channels, voice/video channels, and announcement channels
- Stage channels with speaker and audience roles
- Server emoji (static PNG and animated GIF)
- Server invites with configurable expiry and max-use limits
- Audit log for all moderation and configuration actions
- Server verification levels (email, phone, etc.)
- Member screening questionnaires

### Permissions and Roles
- Role-based permission system using Discord-compatible BigInt bitfields
- 41 permission flags including ADMINISTRATOR, MANAGE_GUILD, BAN_MEMBERS, KICK_MEMBERS, MANAGE_CHANNELS, MANAGE_MESSAGES, and more
- Per-channel permission overwrites (allow/deny per role and per member)
- Role hierarchy — higher roles override lower
- Role colors, hoisting in member list, and mentionable flag
- @everyone and @here mentions with rate limiting

### Voice and Video
- Voice channels powered by MediaSoup WebRTC SFU
- HD video up to 1080p (VP8, VP9, H264 codecs)
- Screen sharing with application window selection
- Adjustable audio bitrate and noise suppression
- User limit per voice channel
- Stage channels with speaker/audience roles and raise-hand queue
- Self-mute, self-deafen, server-mute (mod), server-deafen (mod)

### Direct Messages
- 1:1 direct message channels
- Group DMs with up to 10 participants
- DM channel name and icon customization
- Friend requests, friend list, and pending requests
- Block users (hides messages, blocks DMs)

### Users and Profiles
- Email/password registration and login
- Custom avatar (uploaded, processed and stored as WebP)
- Profile banner image
- Bio / about me section
- Custom status text with emoji
- Presence: Online, Idle, Do Not Disturb, Invisible
- Per-device notification preferences
- Two-factor authentication via TOTP (Google Authenticator compatible)
- Account settings (display name, locale, theme preference)

### Administration
- Ban / kick / timeout members
- Manage nicknames
- Full audit log with filtering
- Incoming webhooks (Discord-compatible payload format)
- Channel permission overwrites via roles and individual members

---

## Tech Stack

| Component       | Technology                                   |
|-----------------|----------------------------------------------|
| API             | Fastify + Prisma ORM + PostgreSQL 16          |
| Real-time       | WebSocket (ws library) + Redis pub/sub        |
| Voice / Video   | MediaSoup 3 (WebRTC SFU)                     |
| File Storage    | MinIO (S3-compatible) + Sharp (image proc.)  |
| Web Frontend    | React 18 + Vite + TailwindCSS                |
| State           | Zustand                                      |
| Desktop         | Electron + electron-vite                     |
| Monorepo        | pnpm workspaces + Turborepo                  |
| Infrastructure  | Docker Compose + Nginx                       |
| Auth            | JWT (access 15 min) + refresh token (7 d)    |
| IDs             | Snowflake (FreeCord epoch 2024-01-01)        |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                          Nginx                               │
│             (Reverse Proxy / TLS Termination)               │
└────┬──────────┬──────────┬─────────────┬──────────┬─────────┘
     │          │          │             │          │
     v          v          v             v          v
 ┌───────┐  ┌───────┐  ┌───────┐  ┌──────────┐ ┌──────────┐
 │  Web  │  │  API  │  │  GW   │  │  Voice   │ │   CDN    │
 │ :5173 │  │ :3000 │  │ :8080 │  │  :8081   │ │  :3001   │
 └───────┘  └───┬───┘  └───┬───┘  └──────────┘ └────┬─────┘
                │           │                        │
                v           v                        v
          ┌──────────┐ ┌───────┐              ┌──────────┐
          │ Postgres │ │ Redis │              │  MinIO   │
          └──────────┘ └───┬───┘              └──────────┘
                           │
                      pub/sub events
                           │
                      ┌────┴─────┐
                      │ Gateway  │
                      │ fan-out  │
                      └──────────┘
```

**Key design decision:** The API never writes directly to WebSocket connections.
It publishes events to Redis channels, and the Gateway process subscribes and
fans them out to the correct connected clients. This decouples horizontal
scaling of the API from the WebSocket layer.

---

## Quick Start — Development

### Prerequisites
- Linux (Ubuntu 22.04+ or Debian 12+ recommended)
- Active internet connection (packages are downloaded during setup)

### One-line setup

```bash
git clone https://github.com/yourusername/freecord.git
cd freecord
chmod +x scripts/setup.sh
./scripts/setup.sh
```

The setup script will:
1. Detect your OS and check for sudo
2. Install Node.js 20, pnpm 9, Docker, and Docker Compose
3. Generate a `.env` file with cryptographically-secure random secrets
4. Start PostgreSQL, Redis, and MinIO via Docker
5. Install all pnpm workspace dependencies
6. Build shared packages (types, permissions, snowflake, logger, markdown)
7. Run Prisma database migrations
8. Mark all other scripts as executable

### Run in development mode

```bash
pnpm dev
# or
./scripts/start-dev.sh
```

Open http://localhost:5173 to access the web app.

### Individual service URLs

| Service     | URL                              |
|-------------|----------------------------------|
| Web App     | http://localhost:5173            |
| API         | http://localhost:3000            |
| Gateway     | ws://localhost:8080/gateway      |
| Voice       | http://localhost:8081            |
| CDN         | http://localhost:3001            |
| MinIO UI    | http://localhost:9001            |
| PostgreSQL  | localhost:5432                   |
| Redis       | localhost:6379                   |

---

## Quick Start — Production / Self-Hosting

See **[SELF_HOSTING.md](SELF_HOSTING.md)** for the full production deployment guide, including:
- SSL/TLS with Let's Encrypt
- Firewall configuration for voice UDP ports
- Environment variable reference
- Database backup and restore
- Upgrade procedure
- Performance tuning

```bash
# Short version:
cp .env.example .env && nano .env   # Fill in your domain, IPs, secrets
./scripts/setup.sh
./scripts/start-prod.sh
```

---

## Project Structure

```
freecord/
├── apps/
│   ├── api/        # Fastify REST API (port 3000)
│   ├── gateway/    # WebSocket gateway (port 8080)
│   ├── voice/      # MediaSoup voice/video SFU (port 8081)
│   ├── cdn/        # File-serving CDN backed by MinIO (port 3001)
│   ├── web/        # React + Vite web application (port 5173)
│   └── desktop/    # Electron desktop client
├── packages/
│   ├── types/      # Shared TypeScript type definitions
│   ├── permissions/# BigInt permission bitfield system
│   ├── snowflake/  # Snowflake ID generation
│   ├── logger/     # Shared pino logger wrapper
│   └── markdown/   # Markdown renderer
├── infra/
│   ├── docker-compose.yml       # Development infra (DB, cache, storage)
│   ├── docker-compose.prod.yml  # Full production stack
│   └── nginx/
│       ├── nginx.conf           # Main reverse-proxy config
│       └── spa.conf             # SPA serving config for web container
├── scripts/
│   ├── setup.sh        # One-shot setup script
│   ├── start-dev.sh    # Start dev environment
│   ├── start-prod.sh   # Build and start production stack
│   └── reset-db.sh     # Wipe and re-migrate the database
└── docs/
    ├── ARCHITECTURE.md    # Detailed system architecture
    ├── GATEWAY_EVENTS.md  # WebSocket event protocol reference
    └── API.md             # REST API reference
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on setting up a dev environment, code style, commit conventions, and the pull request process.

---

## License

MIT License — see [LICENSE](LICENSE) for the full text.
