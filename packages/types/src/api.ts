export interface ApiError {
  code: number
  message: string
  errors?: Record<string, { _errors: { code: string; message: string }[] }>
}

export interface PaginationParams {
  before?: string
  after?: string
  around?: string
  limit?: number
}

export interface MessageSearchParams extends PaginationParams {
  content?: string
  authorId?: string
  mentions?: string
  has?: ('link' | 'embed' | 'file' | 'video' | 'image' | 'sound' | 'sticker')[]
  channelId?: string
  pinned?: boolean
}
