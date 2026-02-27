import { FastifyRequest, FastifyReply } from 'fastify'
import { verifyAccessToken } from '../lib/jwt.js'
import { prisma } from '../lib/prisma.js'

declare module 'fastify' {
  interface FastifyRequest {
    userId: string
    sessionId: string
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ code: 401, message: '401: Unauthorized' })
  }

  const token = authHeader.slice(7)
  try {
    const payload = verifyAccessToken(token)

    // Verify session still exists
    const session = await prisma.session.findFirst({
      where: { id: payload.sessionId, userId: payload.userId },
    })
    if (!session) {
      return reply.status(401).send({ code: 401, message: '401: Unauthorized' })
    }

    request.userId = payload.userId
    request.sessionId = payload.sessionId
  } catch {
    return reply.status(401).send({ code: 401, message: '401: Unauthorized' })
  }
}
