import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// next/headers and next/navigation only exist inside a request. The pure
// functions under test never touch them, but the module imports them.
vi.mock('next/headers', () => ({ cookies: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import {
  MIN_TOKEN_LENGTH,
  SESSION_SECONDS,
  adminConfigured,
  signSession,
  tokenMatches,
  verifySession,
} from '@/lib/admin/auth'
import {
  MAX_FAILURES,
  clientIp,
  recordLogin,
  resetThrottleMemory,
  tooManyFailures,
} from '@/lib/admin/throttle'

const TOKEN = 'k'.repeat(MIN_TOKEN_LENGTH + 11)
const original = process.env.ADMIN_TOKEN

beforeEach(() => {
  process.env.ADMIN_TOKEN = TOKEN
  resetThrottleMemory()
})
afterEach(() => {
  if (original === undefined) delete process.env.ADMIN_TOKEN
  else process.env.ADMIN_TOKEN = original
})

describe('fails closed', () => {
  it('is not configured without a token', () => {
    delete process.env.ADMIN_TOKEN
    expect(adminConfigured()).toBe(false)
    expect(tokenMatches('anything')).toBe(false)
    expect(verifySession(signSession())).toBe(false)
  })

  it('refuses a token that is too short to be a real secret', () => {
    process.env.ADMIN_TOKEN = 'short'
    expect(adminConfigured()).toBe(false)
    expect(tokenMatches('short')).toBe(false)
  })

  it('does not let an empty submission match an empty or missing token', () => {
    delete process.env.ADMIN_TOKEN
    expect(tokenMatches('')).toBe(false)
  })
})

describe('the token', () => {
  it('accepts the right one', () => {
    expect(tokenMatches(TOKEN)).toBe(true)
  })

  it('rejects wrong ones, including near misses and prefixes', () => {
    expect(tokenMatches('wrong')).toBe(false)
    expect(tokenMatches(TOKEN.slice(0, -1))).toBe(false)
    expect(tokenMatches(TOKEN + 'x')).toBe(false)
    expect(tokenMatches(TOKEN.toUpperCase())).toBe(false)
    expect(tokenMatches('')).toBe(false)
  })
})

describe('the session cookie', () => {
  it('verifies a fresh one', () => {
    expect(verifySession(signSession())).toBe(true)
  })

  it('expires', () => {
    const now = Date.now()
    const cookie = signSession(now)
    expect(verifySession(cookie, now + (SESSION_SECONDS - 5) * 1000)).toBe(true)
    expect(verifySession(cookie, now + (SESSION_SECONDS + 5) * 1000)).toBe(false)
  })

  it('cannot be forged by editing the expiry', () => {
    const [, signature] = signSession().split('.')
    const farFuture = Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600
    expect(verifySession(`${farFuture}.${signature}`)).toBe(false)
  })

  it('cannot be forged without the secret', () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600
    expect(verifySession(`${expiresAt}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`)).toBe(false)
    expect(verifySession(`${expiresAt}.`)).toBe(false)
  })

  it('is invalidated everywhere when the token is rotated', () => {
    const cookie = signSession()
    expect(verifySession(cookie)).toBe(true)
    process.env.ADMIN_TOKEN = 'r'.repeat(MIN_TOKEN_LENGTH + 11)
    expect(verifySession(cookie)).toBe(false)
  })

  it('does not contain the token itself', () => {
    expect(signSession()).not.toContain(TOKEN)
  })

  it('rejects malformed values without throwing', () => {
    for (const bad of [undefined, '', '.', 'abc', '1.2.3', 'NaN.sig', '-1.sig', '1.5.sig']) {
      expect(() => verifySession(bad)).not.toThrow()
      expect(verifySession(bad)).toBe(false)
    }
  })
})

describe('login throttling', () => {
  it('locks an address after repeated failures', async () => {
    for (let i = 0; i < MAX_FAILURES; i++) {
      expect(await tooManyFailures('9.9.9.9')).toBe(false)
      await recordLogin('9.9.9.9', false)
    }
    expect(await tooManyFailures('9.9.9.9')).toBe(true)
  })

  it('does not lock a different address', async () => {
    for (let i = 0; i < MAX_FAILURES; i++) await recordLogin('9.9.9.9', false)
    expect(await tooManyFailures('1.2.3.4')).toBe(false)
  })

  it('clears after a successful login', async () => {
    for (let i = 0; i < MAX_FAILURES - 1; i++) await recordLogin('9.9.9.9', false)
    await recordLogin('9.9.9.9', true)
    expect(await tooManyFailures('9.9.9.9')).toBe(false)
  })

  it('takes the original client from a forwarded chain', () => {
    expect(clientIp('203.0.113.7, 10.0.0.1, 10.0.0.2')).toBe('203.0.113.7')
    expect(clientIp(null)).toBeNull()
  })
})
