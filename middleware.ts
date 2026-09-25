import { NextResponse, type NextRequest } from 'next/server'
// Relative, not the `@/` alias. Vercel's edge bundler does not resolve tsconfig
// path aliases when tracing middleware, and rejects the deployment with
// "The Edge Function middleware is referencing unsupported modules" — after the
// build has already succeeded, so a green `next build` does not catch it.
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_COOKIE_MAX_AGE,
  ATTRIBUTION_HEADER,
} from './lib/attribution-cookie'
import { couldBePartnerSlug } from './lib/partner-slug'

/**
 * Issues the anonymous attribution id on partner referral links.
 *
 * This runs in middleware rather than in the page because a server component
 * cannot set cookies. The id is forwarded to the page on a request header so
 * the session it records and the cookie the browser keeps are the same value
 * on a visitor's first ever hit.
 *
 * No database work happens here — middleware is on the edge runtime, and an
 * unknown slug must not cost a query. The page resolves the partner and 404s
 * if there isn't one; an id alone attributes nothing.
 */
export function middleware(request: NextRequest) {
  const slug = request.nextUrl.pathname.split('/')[1] ?? ''
  if (!couldBePartnerSlug(slug)) return NextResponse.next()

  const existing = request.cookies.get(ATTRIBUTION_COOKIE)?.value
  const cookieId = existing && existing.length >= 8 ? existing : crypto.randomUUID()

  const headers = new Headers(request.headers)
  headers.set(ATTRIBUTION_HEADER, cookieId)

  const response = NextResponse.next({ request: { headers } })

  if (!existing) {
    response.cookies.set(ATTRIBUTION_COOKIE, cookieId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: ATTRIBUTION_COOKIE_MAX_AGE,
    })
  }

  return response
}

export const config = {
  matcher: '/:partnerSlug/analyze',
}
