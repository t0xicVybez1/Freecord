import { PrismaClient } from '@prisma/client'
import { createLogger } from '@freecord/logger'

const logger = createLogger('prisma')

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

prisma.$connect().then(() => {
  logger.info('Connected to PostgreSQL')
})
