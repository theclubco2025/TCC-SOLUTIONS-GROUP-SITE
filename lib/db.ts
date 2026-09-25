import { PrismaClient } from '@prisma/client'

/**
 * Pattern copied from NaviTap's `lib/prisma.ts` and renamed for TCCSG. It is a
 * copy on purpose: neither repo may depend on the other, and TCCSG uses its own
 * database and its own DATABASE_URL. Never point this at PlateHaven's database.
 *
 * Returns null when DATABASE_URL is unset so the app boots into demo mode
 * instead of crashing — which is what makes the partner system testable on the
 * live domain before Postgres is provisioned.
 */

const globalForPrisma = globalThis as unknown as { tccsgPrisma?: PrismaClient }

export function isDemoMode(): boolean {
  return !process.env.DATABASE_URL
}

export function dbOrNull(): PrismaClient | null {
  if (isDemoMode()) return null
  if (!globalForPrisma.tccsgPrisma) {
    globalForPrisma.tccsgPrisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    })
  }
  return globalForPrisma.tccsgPrisma
}
