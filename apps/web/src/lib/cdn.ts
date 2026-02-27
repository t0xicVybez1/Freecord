const CDN_BASE = import.meta.env.VITE_CDN_URL || 'http://localhost:3001'

export class CDNUtils {
  static avatar(userId: string, hash: string | null, size = 128): string {
    if (!hash) return CDNUtils.defaultAvatar(userId)
    return `${CDN_BASE}/avatars/${userId}/${hash}.webp`
  }
  static defaultAvatar(userId: string): string {
    const colors = ['#5865f2','#57f287','#fee75c','#eb459e','#ed4245','#3ba55c']
    const idx = Number(BigInt(userId) % BigInt(colors.length))
    return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><rect width='128' height='128' rx='64' fill='${encodeURIComponent(colors[idx])}'/></svg>`
  }
  static guildIcon(guildId: string, hash: string | null): string {
    if (!hash) return ''
    return `${CDN_BASE}/icons/${guildId}/${hash}.webp`
  }
  static guildBanner(guildId: string, hash: string | null): string {
    if (!hash) return ''
    return `${CDN_BASE}/banners/${guildId}/${hash}.webp`
  }
  static userBanner(userId: string, hash: string | null): string {
    if (!hash) return ''
    return `${CDN_BASE}/banners/${userId}/${hash}.webp`
  }
  static emoji(emojiId: string, animated = false): string {
    return `${CDN_BASE}/emojis/${emojiId}.${animated ? 'gif' : 'webp'}`
  }
  static attachment(channelId: string, attachmentId: string, filename: string): string {
    return `${CDN_BASE}/attachments/${channelId}/${attachmentId}/${filename}`
  }
}
