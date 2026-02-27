import pino from 'pino'

const isDev = process.env.NODE_ENV !== 'production'

export const createLogger = (name: string) =>
  pino({
    name,
    level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  })

export const logger = createLogger('freecord')

export type Logger = ReturnType<typeof createLogger>
