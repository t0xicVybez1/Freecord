// FreeCord epoch: January 1, 2024 UTC
const EPOCH = 1704067200000n
const WORKER_BITS = 10n
const SEQUENCE_BITS = 12n
const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n
const MAX_WORKER_ID = (1n << WORKER_BITS) - 1n

export class Snowflake {
  private workerId: bigint
  private sequence: bigint = 0n
  private lastTimestamp: bigint = -1n

  constructor(workerId: number = 1) {
    if (workerId < 0 || workerId > Number(MAX_WORKER_ID)) {
      throw new Error(`Worker ID must be between 0 and ${MAX_WORKER_ID}`)
    }
    this.workerId = BigInt(workerId)
  }

  generate(): string {
    let timestamp = BigInt(Date.now())

    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & MAX_SEQUENCE
      if (this.sequence === 0n) {
        // Wait for next millisecond
        while (timestamp <= this.lastTimestamp) {
          timestamp = BigInt(Date.now())
        }
      }
    } else {
      this.sequence = 0n
    }

    this.lastTimestamp = timestamp

    const id =
      ((timestamp - EPOCH) << (WORKER_BITS + SEQUENCE_BITS)) |
      (this.workerId << SEQUENCE_BITS) |
      this.sequence

    return id.toString()
  }

  static deconstruct(id: string): {
    timestamp: Date
    workerId: number
    sequence: number
  } {
    const snowflake = BigInt(id)
    const timestamp = (snowflake >> (WORKER_BITS + SEQUENCE_BITS)) + EPOCH
    const workerId = (snowflake >> SEQUENCE_BITS) & MAX_WORKER_ID
    const sequence = snowflake & MAX_SEQUENCE

    return {
      timestamp: new Date(Number(timestamp)),
      workerId: Number(workerId),
      sequence: Number(sequence),
    }
  }

  static timestampFrom(id: string): Date {
    return Snowflake.deconstruct(id).timestamp
  }

  static isValid(id: string): boolean {
    try {
      const n = BigInt(id)
      return n > 0n
    } catch {
      return false
    }
  }
}

// Singleton instance
const defaultSnowflake = new Snowflake(parseInt(process.env.WORKER_ID || '1', 10))

export function generateId(): string {
  return defaultSnowflake.generate()
}

export function timestampFromId(id: string): Date {
  return Snowflake.timestampFrom(id)
}

export { EPOCH }
