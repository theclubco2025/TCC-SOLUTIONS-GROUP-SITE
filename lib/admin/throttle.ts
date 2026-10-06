import { createHash } from 'crypto'
import { dbOrNull } from '@/lib/db'

/**
 * Login throttling, kept in the activity table so it holds across serverless
 * instances — an in-memory counter would reset every time a function recycles.
 *
 * It is a second line of defence. The token is 256 bits, so brute force is not a
 * realistic attack; this exists to make that obvious in the logs and to cap noise.
 *
 * If the database is unreachable this fails OPEN, not closed. The alternative is
 * that a database outage locks the only operator out of their own admin, and the
 * strength of the token is what actually protects the door.
 */

const WINDOW_MINUTES = 15
export const MAX_FAILURES = 5

const memory = new Map<string, number[]>() // demo mode only

function hashIp(ip: string | null | undefined): string {
  return createHash('sha256')
    .update(ip || 'unknown')
    .digest('hex')
    .slice(0, 32)
}

export function clientIp(forwardedFor: string | null): string | null {
  // First entry is the original client; later ones are proxies.
  return forwardedFor?.split(',')[0]?.trim() || null
}

export async function tooManyFailures(ip: string | null): Promise<boolean> {
  const ipHash = hashIp(ip)
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000)

  const db = dbOrNull()
  if (!db) {
    const recent = (memory.get(ipHash) ?? []).filter((t) => t >= since.getTime())
    return recent.length >= MAX_FAILURES
  }

  try {
    const count = await db.activityEvent.count({
      where: {
        verb: 'admin.login_failed',
        createdAt: { gte: since },
        payload: { path: ['ipHash'], equals: ipHash },
      },
    })
    return count >= MAX_FAILURES
  } catch (e) {
    console.error('[admin] throttle check failed, allowing attempt:', e)
    return false
  }
}

export async function recordLogin(ip: string | null, ok: boolean): Promise<void> {
  const ipHash = hashIp(ip)

  const db = dbOrNull()
  if (!db) {
    if (!ok) memory.set(ipHash, [...(memory.get(ipHash) ?? []), Date.now()])
    else memory.delete(ipHash)
    return
  }

  try {
    await db.activityEvent.create({
      data: {
        actorType: ok ? 'USER' : 'VISITOR',
        subjectType: 'Admin',
        subjectId: 'login',
        verb: ok ? 'admin.login' : 'admin.login_failed',
        payload: { ipHash },
      },
    })
  } catch (e) {
    console.error('[admin] could not record login attempt:', e)
  }
}

/** For tests. */
export function resetThrottleMemory(): void {
  memory.clear()
}
