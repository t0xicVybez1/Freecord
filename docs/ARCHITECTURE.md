# FreeCord Architecture

## System Overview

FreeCord is a monorepo containing five services and five shared packages, orchestrated via pnpm workspaces and Turborepo.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Browser)                          │
│  React 18 + Vite + Zustand + mediasoup-client + WebSocket       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS / WSS
                    ┌──────▼──────┐
                    │    Nginx    │   Reverse Proxy / TLS Termination
                    └──────┬──────┘
          ┌────────────────┼────────────────────┐
          │                │                    │
    ┌─────▼──────┐  ┌──────▼──────┐  ┌─────────▼──────┐
    │  API       │  │  Gateway    │  │  CDN            │
    │ :3000      │  │  :8080      │  │  :3001          │
    │ Fastify    │  │  ws         │  │  Fastify+MinIO  │
    └─────┬──────┘  └──────┬──────┘  └─────────────────┘
          │  publishes     │  subscribes
          │  events        │  to events
          └────────┬───────┘
                   │                    ┌─────────────────┐
            ┌──────▼──────┐             │  Voice          │
            │    Redis    │             │  :8081          │
            │  pub/sub    │             │  MediaSoup SFU  │
            └──────┬──────┘             └─────────────────┘
                   │
            ┌──────▼──────┐
            │  PostgreSQL │
            │  (Prisma)   │
            └─────────────┘
```

## Services

### API Service (`apps/api`)

The REST API handles all persistence and business logic.

- **Framework**: Fastify 5 with plugins: `@fastify/cors`, `@fastify/cookie`, `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/multipart`
- **ORM**: Prisma 5 with PostgreSQL
- **Auth**: JWT access tokens (15 min, HS256) + refresh tokens (7 days) with rotation. Tokens stored in the DB (`Session` model) for revocation.
- **Real-time**: Never touches WebSocket clients directly. Publishes events to Redis channel `gateway:events`, picked up by the Gateway.
- **Rate limiting**: 100 req/min per IP by default

Key route groups:
- `POST /api/v1/auth/*` — Register, login, logout, refresh, 2FA
- `GET/PATCH /api/v1/users/*` — User profile, settings, relationships, DMs
- `GET/POST/PATCH/DELETE /api/v1/guilds/*` — Server management, channels, roles, members, emojis, bans
- `GET/POST/PATCH/DELETE /api/v1/channels/*` — Messages, reactions, pins, typing, threads
- `GET/POST/DELETE /api/v1/invites/*` — Invite management
- `POST /api/v1/webhooks/:id/:token` — Webhook execution
- `GET /api/v1/internal/users/@me/ready` — Internal endpoint (Gateway IDENTIFY)

### Gateway Service (`apps/gateway`)

WebSocket server for real-time event delivery.

- **Transport**: `ws` library, single endpoint at `/gateway`
- **Protocol**: Discord-compatible opcode system (HELLO → IDENTIFY → READY → events)
- **Fan-out**: Subscribes to Redis `gateway:events`, routes events to relevant connected clients
- **Connection tracking**: In-memory Maps (user→connections, guild→connections, channel→connections)
- **Heartbeat**: 30-second interval with jitter, disconnects clients that miss heartbeats

Opcode flow:
```
Server → Client: HELLO (heartbeatInterval: 41250)
Client → Server: IDENTIFY (token, properties)
Server → Client: READY (user, guilds, relationships, presenceUpdates)
Client → Server: HEARTBEAT (seq)
Server → Client: HEARTBEAT_ACK
Client → Server: PRESENCE_UPDATE (status, activities)
Client → Server: VOICE_STATE_UPDATE (guildId, channelId, selfMute, selfDeaf)
```

### Voice Service (`apps/voice`)

WebRTC SFU (Selective Forwarding Unit) using MediaSoup.

- **Framework**: Fastify HTTP API for signaling, MediaSoup for media
- **Topology**: Each voice channel is a `Room`, each user has Send and Receive transports
- **Codecs**: Opus (audio), VP8/VP9/H264 (video)
- **Scaling**: Single-process with multiple MediaSoup workers (one per CPU core)

Signaling flow:
1. Client: `GET /rtp-capabilities` → Server returns router RTP capabilities
2. Client: `POST /transports` (direction: send/recv) → Server creates WebRTC transport
3. Client: `POST /transports/:id/connect` (dtlsParameters) → Complete DTLS handshake
4. Client: `POST /producers` (track) → Server creates producer
5. Client: `POST /consumers` (producerId) → Server creates consumer, client starts receiving

### CDN Service (`apps/cdn`)

File storage and delivery.

- **Storage**: MinIO (S3-compatible), local or distributed
- **Processing**: Sharp for image resizing/conversion to WebP
- **Buckets**: `freecord-attachments`, `freecord-avatars`, `freecord-icons`, `freecord-banners`, `freecord-emojis`
- **Limits**: 10 MB per file (configurable)

### Web App (`apps/web`)

Single-page application.

- **Framework**: React 18 + Vite 5
- **Routing**: React Router v6
- **State**: Zustand stores (auth, guilds, channels, messages, users, voice, ui)
- **Styling**: TailwindCSS with custom Discord color palette
- **WebSocket**: Custom `GatewayClient` class with reconnection + heartbeat
- **Voice**: `mediasoup-client` for WebRTC

## Shared Packages

| Package | Description |
|---------|-------------|
| `@freecord/types` | All TypeScript interfaces and enums (User, Guild, Channel, Message, Gateway events, etc.) |
| `@freecord/permissions` | BigInt permission bitfields, 41 permission flags, permission computation with role/channel overwrites |
| `@freecord/snowflake` | Twitter Snowflake ID generation (FreeCord epoch: 2024-01-01) |
| `@freecord/logger` | Pino logger wrapper with pretty-printing in dev |
| `@freecord/markdown` | Discord-flavored markdown renderer (marked + highlight.js + spoiler/mention handling) |

## Data Flow: Sending a Message

```
1. User types message → MessageInput component
2. POST /api/v1/channels/:id/messages (with JWT)
3. API validates permissions (channel overwrites, role permissions)
4. API creates Message in PostgreSQL
5. API publishes MESSAGE_CREATE event to Redis `gateway:events`
6. Gateway subscriber receives event, identifies guild/channel members
7. Gateway sends MESSAGE_CREATE payload to all connected clients in that channel
8. Client receives event in useGateway hook
9. useGateway calls messagesStore.addMessage()
10. MessageList re-renders with new message
```

## Permission System

Permissions use BigInt bitfields (compatible with Discord's permission system).

Computation order:
1. Start with `@everyone` role permissions
2. Apply each additional role the member has (OR bits)
3. If member has ADMINISTRATOR: grant all permissions
4. Apply channel-level `@everyone` deny overwrite
5. Apply channel-level role deny overwrites
6. Apply channel-level role allow overwrites
7. Apply channel-level member deny overwrite
8. Apply channel-level member allow overwrite

## ID Generation

All IDs are Twitter Snowflakes with a custom epoch (2024-01-01 00:00:00 UTC = 1704067200000ms).

Snowflake structure (64 bits):
```
| 42 bits: timestamp (ms since epoch) | 10 bits: worker ID | 12 bits: sequence |
```

This allows ~4096 IDs/ms/worker and IDs are naturally sortable by creation time.

## Security

- Passwords hashed with Argon2id (memory: 65536, iterations: 3, parallelism: 4)
- JWT tokens signed with HS256
- All refresh tokens stored in DB and rotated on use (prevents token reuse after logout)
- TOTP 2FA via `@otplib/preset-totp` with backup codes (8 × 8-char codes, stored as argon2id hashes)
- Rate limiting on all public endpoints
- Helmet middleware for security headers
- CORS configured to allowed origins only
- Input validation with Zod on all request bodies
- SQL injection impossible (Prisma parameterized queries)
- File uploads validated by type, limited by size, processed by Sharp before storage
