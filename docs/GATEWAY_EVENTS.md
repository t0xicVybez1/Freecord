# Gateway Events Reference

FreeCord uses a WebSocket gateway for real-time event delivery. This document describes the gateway protocol and all events.

## Connection

Connect to the gateway WebSocket endpoint:
```
ws://localhost:8080/gateway
wss://gateway.yourdomain.com/gateway  (production)
```

## Opcodes

| Opcode | Name | Direction | Description |
|--------|------|-----------|-------------|
| 0 | DISPATCH | Server→Client | Dispatches an event |
| 1 | HEARTBEAT | Client→Server | Client heartbeat |
| 2 | IDENTIFY | Client→Server | Client authentication |
| 3 | PRESENCE_UPDATE | Client→Server | Update presence status |
| 4 | VOICE_STATE_UPDATE | Client→Server | Join/leave voice channel |
| 10 | HELLO | Server→Client | Sent on connection with heartbeat interval |
| 11 | HEARTBEAT_ACK | Server→Client | Heartbeat acknowledgment |

## Connection Flow

```
[Client connects]
Server → Client: { op: 10, d: { heartbeatInterval: 41250 } }

[Client identifies]
Client → Server: { op: 2, d: { token: "JWT_TOKEN", properties: { os: "linux", browser: "freecord-web", device: "freecord-web" } } }

[Server sends initial state]
Server → Client: { op: 0, t: "READY", d: { v: 1, user: {...}, guilds: [...], presenceUpdates: [...], relationships: [...] } }

[Heartbeat loop (every heartbeatInterval ms, with ±jitter)]
Client → Server: { op: 1, d: null }
Server → Client: { op: 11 }
```

## Dispatch Events (op: 0)

### Ready

Sent after successful IDENTIFY.

```typescript
{
  op: 0,
  t: "READY",
  d: {
    v: 1,                    // Gateway version
    user: User,              // The authenticated user
    guilds: Guild[],         // All guilds the user is in
    presenceUpdates: PresenceUpdate[], // Initial presences
    relationships: Relationship[],     // Friends, blocked users
    dmChannels: Channel[],   // Open DM channels
    sessionId: string,       // Session identifier
  }
}
```

### Guild Events

| Event | Description |
|-------|-------------|
| `GUILD_CREATE` | User joined a guild (or guild became available) |
| `GUILD_UPDATE` | Guild settings changed |
| `GUILD_DELETE` | User left/was removed from a guild |
| `GUILD_MEMBER_ADD` | New member joined the guild |
| `GUILD_MEMBER_UPDATE` | Member's roles/nickname changed |
| `GUILD_MEMBER_REMOVE` | Member left or was kicked/banned |
| `GUILD_ROLE_CREATE` | New role created |
| `GUILD_ROLE_UPDATE` | Role updated |
| `GUILD_ROLE_DELETE` | Role deleted |
| `GUILD_BAN_ADD` | User was banned |
| `GUILD_BAN_REMOVE` | User was unbanned |
| `GUILD_EMOJIS_UPDATE` | Guild emoji list changed |

### Channel Events

| Event | Description |
|-------|-------------|
| `CHANNEL_CREATE` | New channel created |
| `CHANNEL_UPDATE` | Channel settings changed |
| `CHANNEL_DELETE` | Channel deleted |
| `CHANNEL_PINS_UPDATE` | Pinned messages changed |
| `THREAD_CREATE` | Thread created |
| `THREAD_UPDATE` | Thread updated |
| `THREAD_DELETE` | Thread deleted |

### Message Events

| Event | Description |
|-------|-------------|
| `MESSAGE_CREATE` | New message sent |
| `MESSAGE_UPDATE` | Message edited |
| `MESSAGE_DELETE` | Message deleted |
| `MESSAGE_DELETE_BULK` | Multiple messages deleted |
| `MESSAGE_REACTION_ADD` | Reaction added |
| `MESSAGE_REACTION_REMOVE` | Reaction removed |
| `MESSAGE_REACTION_REMOVE_ALL` | All reactions removed |

#### MESSAGE_CREATE payload

```typescript
{
  op: 0,
  t: "MESSAGE_CREATE",
  d: {
    id: string,
    channelId: string,
    guildId?: string,
    author: User,
    content: string,
    attachments: MessageAttachment[],
    embeds: MessageEmbed[],
    reactions: MessageReaction[],
    mentions: User[],
    mentionRoles: string[],
    mentionEveryone: boolean,
    type: MessageType,
    flags: number,
    referencedMessage?: Message,
    createdAt: string,        // ISO 8601
    editedAt: string | null,
  }
}
```

### Presence Events

| Event | Description |
|-------|-------------|
| `PRESENCE_UPDATE` | User's status or activity changed |
| `TYPING_START` | User started typing |

#### TYPING_START payload

```typescript
{
  op: 0,
  t: "TYPING_START",
  d: {
    channelId: string,
    guildId?: string,
    userId: string,
    timestamp: number,  // Unix timestamp (seconds)
    member?: GuildMember,
  }
}
```

### Voice Events

| Event | Description |
|-------|-------------|
| `VOICE_STATE_UPDATE` | User joined/left/moved voice channel |
| `VOICE_SERVER_UPDATE` | Voice server connection info |

#### VOICE_STATE_UPDATE payload

```typescript
{
  op: 0,
  t: "VOICE_STATE_UPDATE",
  d: {
    guildId?: string,
    channelId: string | null,  // null = disconnected
    userId: string,
    member?: GuildMember,
    sessionId: string,
    deaf: boolean,
    mute: boolean,
    selfDeaf: boolean,
    selfMute: boolean,
    selfVideo: boolean,
    selfStream: boolean,
    suppress: boolean,
  }
}
```

### User Events

| Event | Description |
|-------|-------------|
| `USER_UPDATE` | Current user's settings changed |
| `RELATIONSHIP_ADD` | Friend request sent/received, or user blocked |
| `RELATIONSHIP_REMOVE` | Friend removed, request cancelled, or user unblocked |

## Client → Server Messages

### PRESENCE_UPDATE (op: 3)

Update your status and activity.

```typescript
{
  op: 3,
  d: {
    status: "online" | "idle" | "dnd" | "invisible",
    activities: Activity[],
    afk: boolean,
    since: number | null,  // Unix ms timestamp when AFK started
  }
}
```

### VOICE_STATE_UPDATE (op: 4)

Join, leave, or update voice channel state.

```typescript
{
  op: 4,
  d: {
    guildId: string | null,
    channelId: string | null,  // null = disconnect from voice
    selfMute: boolean,
    selfDeaf: boolean,
  }
}
```

## Error Handling

If the gateway closes the connection, the close code indicates the reason:

| Code | Reason | Reconnectable |
|------|--------|---------------|
| 4000 | Unknown error | Yes |
| 4001 | Unknown opcode | Yes |
| 4002 | Decode error | Yes |
| 4003 | Not authenticated | No |
| 4004 | Authentication failed | No |
| 4005 | Already authenticated | Yes |
| 4007 | Invalid sequence | Yes |
| 4008 | Rate limited | Yes |
| 4009 | Session timed out | Yes |
| 4010 | Invalid shard | No |

The client should implement exponential backoff with jitter for reconnection, capped at ~5 minutes.
