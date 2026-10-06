import { createHash, createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

/**
 * Authentication for /masteradmin.
 *
 * This is a single shared secret, not user accounts. That is the right size for
 * one operator and the wrong size for a sales team — when reps need their own
 * logins this gets replaced, and nothing outside this file should need to
 * know how it works. Every page and every server action calls requireAdmin().
 *
 * What makes a shared secret acceptable here:
 *  - It is a random 256-bit value, so guessing it is not a realistic attack.
 *  - It is compared in constant time, on hashes, so length and prefix leak nothing.
 *  - The browser never holds it. After login it holds a signed expiry, and
 *    rotating ADMIN_TOKEN invalidates every session at once.
 *  - The cookie is httpOnly, SameSite=Strict, Secure in production, and scoped to
 *    /masteradmin so it is never sent to any other page on the site.
 *  - Login is throttled per address (lib/admin/throttle.ts).
 *  - With ADMIN_TOKEN unset or short, nothing can log in. It fails closed.
 */

export const ADMIN_COOKIE = 'tccsg_admin'
export const ADMIN_PATH = '/masteradmin'
export const SESSION_SECONDS = 12 * 60 * 60
export const MIN_TOKEN_LENGTH = 32

export function adminConfigured(): boolean {
  const token = process.env.ADMIN_TOKEN
  return typeof token === 'string' && token.length >= MIN_TOKEN_LENGTH
}

/** Constant-time comparison of two strings via their hashes. */
export function tokenMatches(candidate: string): boolean {
  if (!adminConfigured()) return false
  const a = createHash('sha256').update(candidate).digest()
  const b = createHash('sha256').update(process.env.ADMIN_TOKEN as string).digest()
  return timingSafeEqual(a, b)
}

function mac(expiresAt: number): string {
  // Derived from the token but not equal to it, so a leaked cookie reveals nothing
  // that logs in, and changing the token revokes every outstanding session.
  const key = createHash('sha256')
    .update(`tccsg-admin-session:${process.env.ADMIN_TOKEN}`)
    .digest()
  return createHmac('sha256', key).update(`admin:${expiresAt}`).digest('base64url')
}

export function signSession(nowMs: number = Date.now()): string {
  const expiresAt = Math.floor(nowMs / 1000) + SESSION_SECONDS
  return `${expiresAt}.${mac(expiresAt)}`
}

export function verifySession(value: string | undefined, nowMs: number = Date.now()): boolean {
  if (!adminConfigured() || !value) return false

  const [expiry, signature, ...rest] = value.split('.')
  if (rest.length > 0 || !expiry || !signature) return false

  const expiresAt = Number(expiry)
  if (!Number.isInteger(expiresAt) || expiresAt * 1000 <= nowMs) return false

  const expected = Buffer.from(mac(expiresAt))
  const given = Buffer.from(signature)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies()
  return verifySession(jar.get(ADMIN_COOKIE)?.value)
}

/**
 * Call first in every page and every server action. Layouts are not enough:
 * they do not re-run on client navigation, and server actions are plain POST
 * endpoints that anyone can call without ever rendering a page.
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect(`${ADMIN_PATH}/login`)
}
