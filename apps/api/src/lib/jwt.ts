import jwt from 'jsonwebtoken'
import { generateId } from '@freecord/snowflake'
import { prisma } from './prisma.js'

const ACCESS_SECRET = process.env.JWT_SECRET || 'access-secret'
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret'
const ACCESS_EXPIRY = '15m'
const REFRESH_EXPIRY_SECONDS = 7 * 24 * 60 * 60 // 7 days

export interface TokenPayload {
  userId: string
  sessionId: string
  iat?: number
  exp?: number
}

export function signAccessToken(payload: { userId: string; sessionId: string }): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY })
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as TokenPayload
}

export function signRefreshToken(payload: { userId: string; sessionId: string }): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: '7d' })
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, REFRESH_SECRET) as TokenPayload
}

export async function createSession(
  userId: string,
  options?: { userAgent?: string; ipAddress?: string }
): Promise<{ accessToken: string; refreshToken: string; sessionId: string }> {
  const sessionId = generateId()
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_SECONDS * 1000)

  const accessToken = signAccessToken({ userId, sessionId })
  const refreshToken = signRefreshToken({ userId, sessionId })

  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      token: refreshToken,
      expiresAt,
      userAgent: options?.userAgent,
      ipAddress: options?.ipAddress,
    },
  })

  return { accessToken, refreshToken, sessionId }
}

export async function rotateSession(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string; sessionId: string }> {
  const payload = verifyRefreshToken(refreshToken)

  const session = await prisma.session.findUnique({
    where: { token: refreshToken },
  })

  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.deleteMany({ where: { id: session.id } })
    throw new Error('Invalid or expired refresh token')
  }

  // Delete old session (use deleteMany to avoid crash on concurrent requests)
  await prisma.session.deleteMany({ where: { id: session.id } })

  // Create new session
  return createSession(payload.userId)
}
