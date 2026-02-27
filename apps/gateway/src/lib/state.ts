import type { AuthenticatedSocket } from '../main.js'

export class ConnectionManager {
  // userId -> Set of WebSocket connections (user can have multiple tabs)
  private userConnections: Map<string, Set<AuthenticatedSocket>> = new Map()
  // guildId -> Set of userIds
  private guildSubscriptions: Map<string, Set<string>> = new Map()
  // channelId -> Set of userIds (for DM channels)
  private channelSubscriptions: Map<string, Set<string>> = new Map()

  add(userId: string, socket: AuthenticatedSocket) {
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set())
    }
    this.userConnections.get(userId)!.add(socket)
  }

  remove(userId: string, socket: AuthenticatedSocket) {
    const connections = this.userConnections.get(userId)
    if (connections) {
      connections.delete(socket)
      if (connections.size === 0) {
        this.userConnections.delete(userId)
        // Remove from all guild subscriptions
        for (const [guildId, users] of this.guildSubscriptions) {
          users.delete(userId)
          if (users.size === 0) this.guildSubscriptions.delete(guildId)
        }
        for (const [channelId, users] of this.channelSubscriptions) {
          users.delete(userId)
          if (users.size === 0) this.channelSubscriptions.delete(channelId)
        }
      }
    }
  }

  subscribeToGuild(userId: string, guildId: string) {
    if (!this.guildSubscriptions.has(guildId)) {
      this.guildSubscriptions.set(guildId, new Set())
    }
    this.guildSubscriptions.get(guildId)!.add(userId)
  }

  subscribeToChannel(userId: string, channelId: string) {
    if (!this.channelSubscriptions.has(channelId)) {
      this.channelSubscriptions.set(channelId, new Set())
    }
    this.channelSubscriptions.get(channelId)!.add(userId)
  }

  unsubscribeFromGuild(userId: string, guildId: string) {
    this.guildSubscriptions.get(guildId)?.delete(userId)
  }

  getConnectionsForUser(userId: string): Set<AuthenticatedSocket> {
    return this.userConnections.get(userId) || new Set()
  }

  getUsersInGuild(guildId: string): Set<string> {
    return this.guildSubscriptions.get(guildId) || new Set()
  }

  getUsersInChannel(channelId: string): Set<string> {
    return this.channelSubscriptions.get(channelId) || new Set()
  }

  isUserOnline(userId: string): boolean {
    return (this.userConnections.get(userId)?.size ?? 0) > 0
  }

  getOnlineUserIds(): string[] {
    return Array.from(this.userConnections.keys())
  }

  // Send to all connections of a user
  sendToUser(userId: string, payload: unknown) {
    const connections = this.userConnections.get(userId)
    if (!connections) return
    const json = JSON.stringify(payload)
    for (const ws of connections) {
      if (ws.readyState === 1) { // OPEN
        ws.send(json)
      }
    }
  }

  // Send to all users in a guild who are online
  sendToGuild(guildId: string, payload: unknown, excludeUserId?: string) {
    const userIds = this.guildSubscriptions.get(guildId)
    if (!userIds) return
    const json = JSON.stringify(payload)
    for (const userId of userIds) {
      if (userId === excludeUserId) continue
      const connections = this.userConnections.get(userId)
      if (connections) {
        for (const ws of connections) {
          if (ws.readyState === 1) ws.send(json)
        }
      }
    }
  }

  // Send to all users in a channel (for DMs)
  sendToChannel(channelId: string, payload: unknown, excludeUserId?: string) {
    const userIds = this.channelSubscriptions.get(channelId)
    if (!userIds) return
    const json = JSON.stringify(payload)
    for (const userId of userIds) {
      if (userId === excludeUserId) continue
      const connections = this.userConnections.get(userId)
      if (connections) {
        for (const ws of connections) {
          if (ws.readyState === 1) ws.send(json)
        }
      }
    }
  }

  // Send to a list of specific user IDs
  sendToUsers(userIds: string[], payload: unknown) {
    const json = JSON.stringify(payload)
    for (const userId of userIds) {
      const connections = this.userConnections.get(userId)
      if (connections) {
        for (const ws of connections) {
          if (ws.readyState === 1) ws.send(json)
        }
      }
    }
  }
}
