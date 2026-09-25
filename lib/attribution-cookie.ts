/**
 * Edge-safe attribution constants.
 *
 * Kept separate from `lib/attribution.ts` because middleware runs on the edge
 * runtime, where neither Prisma nor node:crypto can be imported. Middleware
 * needs the cookie name; it must not pull in the database layer to get it.
 */

export const ATTRIBUTION_COOKIE = 'tccsg_ref'

/** Chrome clamps cookie lifetime to 400 days, so asking for more is pointless. */
export const ATTRIBUTION_COOKIE_MAX_AGE = 400 * 24 * 60 * 60

/**
 * Middleware forwards the attribution id to the page on this request header.
 * A cookie set on the *response* is not visible to `cookies()` during the same
 * render, so on a visitor's very first hit the page would otherwise record the
 * session under a different id than the browser ends up holding.
 */
export const ATTRIBUTION_HEADER = 'x-tccsg-ref'
