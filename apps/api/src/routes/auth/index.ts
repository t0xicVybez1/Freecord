import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { hashPassword, verifyPassword, generateRandomString } from '../../lib/hash.js'
import { createSession, rotateSession } from '../../lib/jwt.js'
import { prisma } from '../../lib/prisma.js'
import { generateId } from '@freecord/snowflake'
import { serializeUser } from '../../lib/serialize.js'
import { authenticate } from '../../middleware/authenticate.js'
import { totp } from '@otplib/preset-totp'
import qrcode from 'qrcode'

const registerSchema = z.object({
  username: z.string().min(2).max(32).regex(/^[a-zA-Z0-9_.]+$/),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  dateOfBirth: z.string().optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  code: z.string().optional(), // 2FA code
})

export default async function authRoutes(app: FastifyInstance) {
  // Register
  app.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body)

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: body.email.toLowerCase() }, { username: body.username }] },
    })

    if (existing) {
      if (existing.email === body.email.toLowerCase()) {
        return reply.status(400).send({ code: 400, message: 'Email already registered' })
      }
      return reply.status(400).send({ code: 400, message: 'Username already taken' })
    }

    const userId = generateId()
    const passwordHash = await hashPassword(body.password)

    const user = await prisma.user.create({
      data: {
        id: userId,
        username: body.username,
        email: body.email.toLowerCase(),
        passwordHash,
        userSettings: { create: {} },
      },
    })

    const { accessToken, refreshToken } = await createSession(userId, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    })

    reply.setCookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/api/v1/auth',
    })

    return reply.status(201).send({
      token: accessToken,
      user: serializeUser(user, true),
    })
  })

  // Login
  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body)

    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    })

    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return reply.status(401).send({ code: 401, message: 'Invalid email or password' })
    }

    // 2FA check
    if (user.twoFactorEnabled) {
      if (!body.code) {
        return reply.status(400).send({ code: 400, message: 'mfa_required', mfa: true })
      }
      const valid = totp.check(body.code, user.twoFactorSecret!)
      if (!valid) {
        // Try backup codes
        const codeIndex = user.backupCodes.indexOf(body.code)
        if (codeIndex === -1) {
          return reply.status(401).send({ code: 401, message: 'Invalid 2FA code' })
        }
        const newCodes = [...user.backupCodes]
        newCodes.splice(codeIndex, 1)
        await prisma.user.update({ where: { id: user.id }, data: { backupCodes: newCodes } })
      }
    }

    const { accessToken, refreshToken } = await createSession(user.id, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    })

    reply.setCookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/api/v1/auth',
    })

    return reply.send({
      token: accessToken,
      user: serializeUser(user, true),
    })
  })

  // Logout
  app.post('/logout', { preHandler: authenticate }, async (request, reply) => {
    await prisma.session.deleteMany({ where: { userId: request.userId } })
    reply.clearCookie('refresh_token', { path: '/api/v1/auth' })
    return reply.status(204).send()
  })

  // Refresh token
  app.post('/refresh', async (request, reply) => {
    const refreshToken = request.cookies.refresh_token
    if (!refreshToken) {
      return reply.status(401).send({ code: 401, message: 'No refresh token' })
    }

    try {
      const { accessToken, refreshToken: newRefreshToken } = await rotateSession(refreshToken)

      reply.setCookie('refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60,
        path: '/api/v1/auth',
      })

      return reply.send({ token: accessToken })
    } catch {
      reply.clearCookie('refresh_token', { path: '/api/v1/auth' })
      return reply.status(401).send({ code: 401, message: 'Invalid refresh token' })
    }
  })

  // Enable 2FA - generate secret and QR code
  app.post('/2fa/enable', { preHandler: authenticate }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.userId } })
    if (!user) return reply.status(404).send({ code: 404, message: 'User not found' })
    if (user.twoFactorEnabled) {
      return reply.status(400).send({ code: 400, message: '2FA already enabled' })
    }

    const secret = totp.generateSecret()
    const otpauth = totp.keyuri(user.email, 'FreeCord', secret)
    const qrUrl = await qrcode.toDataURL(otpauth)

    // Store secret temporarily in Redis (not in DB until verified)
    const { redis } = await import('../../lib/redis.js')
    await redis.setex(`2fa_setup:${user.id}`, 300, secret)

    return reply.send({ secret, qrUrl, otpauth })
  })

  // Verify 2FA (confirm enable)
  app.post('/2fa/verify', { preHandler: authenticate }, async (request, reply) => {
    const { code } = z.object({ code: z.string() }).parse(request.body)
    const { redis } = await import('../../lib/redis.js')
    const secret = await redis.get(`2fa_setup:${request.userId}`)

    if (!secret) {
      return reply.status(400).send({ code: 400, message: '2FA setup expired. Please restart.' })
    }

    if (!totp.check(code, secret)) {
      return reply.status(400).send({ code: 400, message: 'Invalid 2FA code' })
    }

    // Generate backup codes
    const backupCodes = Array.from({ length: 8 }, () =>
      generateRandomString(10).toLowerCase().replace(/[^a-z0-9]/g, 'x')
    )

    await prisma.user.update({
      where: { id: request.userId },
      data: { twoFactorEnabled: true, twoFactorSecret: secret, backupCodes },
    })

    await redis.del(`2fa_setup:${request.userId}`)

    return reply.send({ backupCodes })
  })

  // Disable 2FA
  app.post('/2fa/disable', { preHandler: authenticate }, async (request, reply) => {
    const { code, password } = z
      .object({ code: z.string(), password: z.string() })
      .parse(request.body)

    const user = await prisma.user.findUnique({ where: { id: request.userId } })
    if (!user) return reply.status(404).send({ code: 404, message: 'User not found' })

    if (!(await verifyPassword(password, user.passwordHash))) {
      return reply.status(401).send({ code: 401, message: 'Invalid password' })
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return reply.status(400).send({ code: 400, message: '2FA not enabled' })
    }

    if (!totp.check(code, user.twoFactorSecret)) {
      return reply.status(400).send({ code: 400, message: 'Invalid 2FA code' })
    }

    await prisma.user.update({
      where: { id: request.userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null, backupCodes: [] },
    })

    return reply.status(204).send()
  })

  // Get active sessions
  app.get('/sessions', { preHandler: authenticate }, async (request, reply) => {
    const sessions = await prisma.session.findMany({
      where: { userId: request.userId },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send(
      sessions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        userAgent: s.userAgent,
        current: s.id === request.sessionId,
      }))
    )
  })

  // Revoke a specific session
  app.delete('/sessions/:sessionId', { preHandler: authenticate }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }

    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId: request.userId },
    })

    if (!session) {
      return reply.status(404).send({ code: 404, message: 'Session not found' })
    }

    await prisma.session.delete({ where: { id: sessionId } })
    return reply.status(204).send()
  })

  // Change password
  app.post('/change-password', { preHandler: authenticate }, async (request, reply) => {
    const { currentPassword, newPassword } = z
      .object({ currentPassword: z.string(), newPassword: z.string().min(8).max(128) })
      .parse(request.body)

    const user = await prisma.user.findUnique({ where: { id: request.userId } })
    if (!user) return reply.status(404).send({ code: 404, message: 'User not found' })

    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      return reply.status(401).send({ code: 401, message: 'Invalid current password' })
    }

    const newHash = await hashPassword(newPassword)
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } })

    // Revoke all other sessions
    await prisma.session.deleteMany({
      where: { userId: user.id, id: { not: request.sessionId } },
    })

    return reply.status(204).send()
  })
}
