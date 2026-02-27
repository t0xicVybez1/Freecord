# FreeCord API Reference

Base URL: `http://localhost:3000/api/v1` (development)

All authenticated endpoints require the `Authorization: Bearer <access_token>` header.

## Authentication

### POST /auth/register

Register a new account.

**Request:**
```json
{
  "username": "string",      // 2-32 chars, alphanumeric + _ -
  "email": "string",         // valid email
  "password": "string",      // 8-128 chars
  "displayName": "string"    // optional, 1-32 chars
}
```

**Response:** `201 Created`
```json
{
  "user": { ...User },
  "accessToken": "string",
  "refreshToken": "string"
}
```

### POST /auth/login

**Request:**
```json
{
  "email": "string",
  "password": "string",
  "totpCode": "string"  // required if 2FA enabled
}
```

**Response:** `200 OK`
```json
{
  "user": { ...User },
  "accessToken": "string",
  "refreshToken": "string"
}
```

### POST /auth/refresh

Rotate refresh token and get new access token.

**Request:**
```json
{ "refreshToken": "string" }
```

**Response:** `200 OK`
```json
{
  "accessToken": "string",
  "refreshToken": "string"
}
```

### POST /auth/logout

Revoke current session.

**Headers:** `Authorization: Bearer <token>`

**Response:** `204 No Content`

### POST /auth/2fa/enable

Enable two-factor authentication.

**Response:** `200 OK`
```json
{
  "secret": "string",      // TOTP secret (show to user for manual entry)
  "otpauthUrl": "string",  // QR code URL
  "backupCodes": ["string", ...]  // 8 backup codes
}
```

### POST /auth/2fa/verify

Confirm 2FA setup with a TOTP code.

**Request:** `{ "code": "123456" }`

**Response:** `200 OK` `{ "success": true }`

## Users

### GET /users/@me

Get the current user.

**Response:** `200 OK` — `PrivateUser` (includes email, settings)

### PATCH /users/@me

Update current user profile.

**Request:**
```json
{
  "displayName": "string",  // optional
  "email": "string",        // requires password
  "password": "string",     // current password (required when changing email/password)
  "newPassword": "string",  // optional
  "avatar": "string"        // CDN URL of new avatar
}
```

### GET /users/@me/relationships

Get all relationships (friends, pending, blocked).

**Response:** `200 OK` — `Relationship[]`

### PUT /users/@me/relationships/:userId

Send friend request or block a user.

**Request:** `{ "type": 1 }` (1 = friend, 2 = block)

### DELETE /users/@me/relationships/:userId

Remove friend, cancel/reject request, or unblock.

### GET /users/@me/channels

Get all open DM channels.

### POST /users/@me/channels

Open a DM with a user.

**Request:** `{ "recipientId": "string" }`

## Guilds

### GET /guilds/:guildId

Get guild details (must be a member).

### POST /guilds

Create a new guild.

**Request:** `{ "name": "string" }` (name: 2-100 chars)

### PATCH /guilds/:guildId

Update guild settings (requires MANAGE_GUILD).

**Request:** `{ "name": "string", "icon": "string", "description": "string", ... }`

### DELETE /guilds/:guildId

Delete a guild (owner only).

### GET /guilds/:guildId/channels

Get all channels in a guild.

### POST /guilds/:guildId/channels

Create a channel (requires MANAGE_CHANNELS).

**Request:**
```json
{
  "name": "string",      // 1-100 chars
  "type": 0,             // ChannelType enum value
  "parentId": "string",  // optional, category channel ID
  "topic": "string",     // optional, text channels only
  "slowmode": 0,         // optional, seconds
  "nsfw": false,
  "bitrate": 64000,      // optional, voice channels only
  "userLimit": 0         // optional, voice channels only
}
```

### GET /guilds/:guildId/members

Get guild members (paginated).

**Query:** `?limit=100&after=<memberId>`

### GET /guilds/:guildId/members/:userId

Get a specific guild member.

### DELETE /guilds/:guildId/members/:userId

Kick a member (requires KICK_MEMBERS).

### GET /guilds/:guildId/bans

Get guild bans (requires BAN_MEMBERS).

### PUT /guilds/:guildId/bans/:userId

Ban a user (requires BAN_MEMBERS).

**Request:** `{ "reason": "string", "deleteMessageDays": 0 }`

### DELETE /guilds/:guildId/bans/:userId

Unban a user (requires BAN_MEMBERS).

### GET /guilds/:guildId/roles

Get all roles.

### POST /guilds/:guildId/roles

Create a role (requires MANAGE_ROLES).

**Request:** `{ "name": "string", "color": 0, "hoist": false, "mentionable": false, "permissions": "0" }`

### PATCH /guilds/:guildId/roles/:roleId

Update a role (requires MANAGE_ROLES).

### DELETE /guilds/:guildId/roles/:roleId

Delete a role (requires MANAGE_ROLES).

### GET /guilds/:guildId/invites

Get all guild invites (requires MANAGE_GUILD).

### GET /guilds/:guildId/emojis

Get guild emojis.

### POST /guilds/:guildId/emojis

Create an emoji (requires MANAGE_EMOJIS).

### GET /guilds/:guildId/audit-logs

Get audit log entries (requires VIEW_AUDIT_LOG).

**Query:** `?userId=<id>&actionType=<type>&limit=50&before=<id>`

## Channels

### GET /channels/:channelId

Get a channel.

### PATCH /channels/:channelId

Update a channel (requires MANAGE_CHANNELS).

### DELETE /channels/:channelId

Delete a channel (requires MANAGE_CHANNELS).

### GET /channels/:channelId/messages

Get messages (requires VIEW_CHANNEL + READ_MESSAGE_HISTORY).

**Query:** `?limit=50&before=<id>&after=<id>&around=<id>`

**Response:** `200 OK` — `Message[]` (newest first)

### POST /channels/:channelId/messages

Send a message (requires SEND_MESSAGES).

**Request:**
```json
{
  "content": "string",          // 1-2000 chars
  "tts": false,
  "embeds": [],                 // optional
  "messageReference": {         // optional, for replies
    "messageId": "string"
  }
}
```

**Response:** `201 Created` — `Message`

### PATCH /channels/:channelId/messages/:messageId

Edit a message (own messages only, requires SEND_MESSAGES).

**Request:** `{ "content": "string" }`

### DELETE /channels/:channelId/messages/:messageId

Delete a message (own or requires MANAGE_MESSAGES).

### POST /channels/:channelId/messages/bulk-delete

Delete multiple messages (requires MANAGE_MESSAGES).

**Request:** `{ "messages": ["id1", "id2", ...] }` (2-100 IDs, max 14 days old)

### PUT /channels/:channelId/messages/:messageId/reactions/:emoji/@me

Add a reaction (requires ADD_REACTIONS).

### DELETE /channels/:channelId/messages/:messageId/reactions/:emoji/@me

Remove own reaction.

### DELETE /channels/:channelId/messages/:messageId/reactions/:emoji/:userId

Remove another user's reaction (requires MANAGE_MESSAGES).

### GET /channels/:channelId/pins

Get pinned messages.

### PUT /channels/:channelId/pins/:messageId

Pin a message (requires MANAGE_MESSAGES).

### DELETE /channels/:channelId/pins/:messageId

Unpin a message (requires MANAGE_MESSAGES).

### POST /channels/:channelId/typing

Send a typing indicator. The effect lasts ~10 seconds.

### GET /channels/:channelId/invites

Get channel invites.

### POST /channels/:channelId/invites

Create an invite.

**Request:**
```json
{
  "maxAge": 86400,      // seconds, 0 = never expire
  "maxUses": 0,         // 0 = unlimited
  "temporary": false,
  "unique": false
}
```

## Invites

### GET /invites/:code

Get invite info (no auth required).

### POST /invites/:code

Use an invite to join a guild (requires auth).

### DELETE /invites/:code

Delete an invite (requires MANAGE_GUILD).

## Webhooks

### POST /webhooks/:id/:token

Execute a webhook (no auth required).

**Request:**
```json
{
  "content": "string",
  "username": "string",
  "avatarUrl": "string",
  "embeds": []
}
```

## Voice

### GET /voice/regions

List available voice regions.

### PATCH /voice/guilds/:guildId/state

Update voice state (join/leave voice channel).

**Request:**
```json
{
  "channelId": "string",  // null to disconnect
  "selfMute": false,
  "selfDeaf": false
}
```

## Error Responses

All errors follow this format:

```json
{
  "code": 50013,
  "message": "Missing Permissions",
  "errors": {}    // optional, field-level validation errors
}
```

### Common Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| 10001 | 404 | Unknown account |
| 10002 | 404 | Unknown application |
| 10003 | 404 | Unknown channel |
| 10004 | 404 | Unknown guild |
| 10008 | 404 | Unknown message |
| 10013 | 404 | Unknown user |
| 20001 | 403 | Bots cannot use this endpoint |
| 40001 | 401 | Unauthorized |
| 40002 | 403 | Two-factor authentication required |
| 50001 | 403 | Missing access |
| 50013 | 403 | Missing permissions |
| 50035 | 400 | Invalid form body |
| 50043 | 400 | Cannot join a guild (already in 100 guilds) |
| 130000 | 429 | Rate limited |

## Rate Limits

Rate limits are applied per IP address. Default: 100 requests per 60 seconds.

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1640000000
Retry-After: 30   (only when rate limited, HTTP 429)
```
