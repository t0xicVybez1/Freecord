export const PermissionFlagsBits = {
  CREATE_INSTANT_INVITE: 1n << 0n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  ADD_REACTIONS: 1n << 6n,
  VIEW_AUDIT_LOG: 1n << 7n,
  PRIORITY_SPEAKER: 1n << 8n,
  STREAM: 1n << 9n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  SEND_TTS_MESSAGES: 1n << 12n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  MENTION_EVERYONE: 1n << 17n,
  USE_EXTERNAL_EMOJIS: 1n << 18n,
  VIEW_GUILD_INSIGHTS: 1n << 19n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MUTE_MEMBERS: 1n << 22n,
  DEAFEN_MEMBERS: 1n << 23n,
  MOVE_MEMBERS: 1n << 24n,
  USE_VAD: 1n << 25n,
  CHANGE_NICKNAME: 1n << 26n,
  MANAGE_NICKNAMES: 1n << 27n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_WEBHOOKS: 1n << 29n,
  MANAGE_EMOJIS_AND_STICKERS: 1n << 30n,
  USE_APPLICATION_COMMANDS: 1n << 31n,
  REQUEST_TO_SPEAK: 1n << 32n,
  MANAGE_EVENTS: 1n << 33n,
  MANAGE_THREADS: 1n << 34n,
  CREATE_PUBLIC_THREADS: 1n << 35n,
  CREATE_PRIVATE_THREADS: 1n << 36n,
  USE_EXTERNAL_STICKERS: 1n << 37n,
  SEND_MESSAGES_IN_THREADS: 1n << 38n,
  USE_EMBEDDED_ACTIVITIES: 1n << 39n,
  MODERATE_MEMBERS: 1n << 40n,
} as const

export type PermissionFlag = keyof typeof PermissionFlagsBits

export class PermissionsBitField {
  private bits: bigint

  constructor(bits: bigint | string | number = 0n) {
    this.bits = typeof bits === 'string' ? BigInt(bits) : BigInt(bits)
  }

  has(flag: PermissionFlag | bigint): boolean {
    if (this.bits & PermissionFlagsBits.ADMINISTRATOR) return true
    const flagBit = typeof flag === 'bigint' ? flag : PermissionFlagsBits[flag]
    return (this.bits & flagBit) === flagBit
  }

  hasAny(...flags: (PermissionFlag | bigint)[]): boolean {
    return flags.some((f) => this.has(f))
  }

  hasAll(...flags: (PermissionFlag | bigint)[]): boolean {
    return flags.every((f) => this.has(f))
  }

  add(...flags: (PermissionFlag | bigint)[]): PermissionsBitField {
    let bits = this.bits
    for (const flag of flags) {
      bits |= typeof flag === 'bigint' ? flag : PermissionFlagsBits[flag]
    }
    return new PermissionsBitField(bits)
  }

  remove(...flags: (PermissionFlag | bigint)[]): PermissionsBitField {
    let bits = this.bits
    for (const flag of flags) {
      bits &= ~(typeof flag === 'bigint' ? flag : PermissionFlagsBits[flag])
    }
    return new PermissionsBitField(bits)
  }

  toArray(): PermissionFlag[] {
    return (Object.keys(PermissionFlagsBits) as PermissionFlag[]).filter((f) => this.has(f))
  }

  toString(): string {
    return this.bits.toString()
  }

  toBigInt(): bigint {
    return this.bits
  }

  static ALL = new PermissionsBitField(
    Object.values(PermissionFlagsBits).reduce((a, b) => a | b, 0n)
  )

  static NONE = new PermissionsBitField(0n)

  static DEFAULT = new PermissionsBitField(
    PermissionFlagsBits.VIEW_CHANNEL |
    PermissionFlagsBits.SEND_MESSAGES |
    PermissionFlagsBits.SEND_TTS_MESSAGES |
    PermissionFlagsBits.EMBED_LINKS |
    PermissionFlagsBits.ATTACH_FILES |
    PermissionFlagsBits.READ_MESSAGE_HISTORY |
    PermissionFlagsBits.MENTION_EVERYONE |
    PermissionFlagsBits.USE_EXTERNAL_EMOJIS |
    PermissionFlagsBits.ADD_REACTIONS |
    PermissionFlagsBits.CONNECT |
    PermissionFlagsBits.SPEAK |
    PermissionFlagsBits.STREAM |
    PermissionFlagsBits.USE_VAD |
    PermissionFlagsBits.CHANGE_NICKNAME |
    PermissionFlagsBits.CREATE_INSTANT_INVITE
  )
}

export interface PermissionOverwriteData {
  id: string
  type: 0 | 1 // 0=role, 1=member
  allow: string
  deny: string
}

export function computeBasePermissions(
  memberRoleIds: string[],
  roles: { id: string; permissions: string; position: number }[],
  everyoneRoleId: string,
  ownerId: string,
  userId: string
): bigint {
  if (userId === ownerId) return PermissionsBitField.ALL.toBigInt()

  const everyoneRole = roles.find((r) => r.id === everyoneRoleId)
  let permissions = everyoneRole ? BigInt(everyoneRole.permissions) : 0n

  for (const roleId of memberRoleIds) {
    const role = roles.find((r) => r.id === roleId)
    if (role) permissions |= BigInt(role.permissions)
  }

  if (permissions & PermissionFlagsBits.ADMINISTRATOR) {
    return PermissionsBitField.ALL.toBigInt()
  }

  return permissions
}

export function computeOverwrites(
  basePermissions: bigint,
  memberRoleIds: string[],
  userId: string,
  overwrites: PermissionOverwriteData[],
  everyoneRoleId: string
): bigint {
  if (basePermissions & PermissionFlagsBits.ADMINISTRATOR) return basePermissions

  let permissions = basePermissions

  // Apply @everyone overwrite
  const everyoneOverwrite = overwrites.find((o) => o.id === everyoneRoleId)
  if (everyoneOverwrite) {
    permissions &= ~BigInt(everyoneOverwrite.deny)
    permissions |= BigInt(everyoneOverwrite.allow)
  }

  // Apply role overwrites
  let roleAllow = 0n
  let roleDeny = 0n
  for (const roleId of memberRoleIds) {
    const overwrite = overwrites.find((o) => o.id === roleId && o.type === 0)
    if (overwrite) {
      roleAllow |= BigInt(overwrite.allow)
      roleDeny |= BigInt(overwrite.deny)
    }
  }
  permissions &= ~roleDeny
  permissions |= roleAllow

  // Apply member overwrite
  const memberOverwrite = overwrites.find((o) => o.id === userId && o.type === 1)
  if (memberOverwrite) {
    permissions &= ~BigInt(memberOverwrite.deny)
    permissions |= BigInt(memberOverwrite.allow)
  }

  return permissions
}

export function hasPermission(permissions: bigint | string, flag: PermissionFlag): boolean {
  const bits = typeof permissions === 'string' ? BigInt(permissions) : permissions
  if (bits & PermissionFlagsBits.ADMINISTRATOR) return true
  return (bits & PermissionFlagsBits[flag]) === PermissionFlagsBits[flag]
}
