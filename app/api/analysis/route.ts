import { NextResponse, type NextRequest } from 'next/server'
import { ATTRIBUTION_COOKIE } from '@/lib/attribution-cookie'
import { ANALYSIS_LIMITS } from '@/lib/analysis/config'
import { createAnalysisSession, startsFromIpLastHour } from '@/lib/analysis/sessions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Starts an analysis.
 *
 * The attribution cookie is read here if the visitor has one from an earlier
 * partner link. That is what makes §8 work: the referral relationship survives
 * the prospect later arriving directly, because it was never carried in the URL.
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')

  const starts = await startsFromIpLastHour(ip)
  if (starts >= ANALYSIS_LIMITS.startsPerIpPerHour) {
    return NextResponse.json(
      { ok: false, errors: ['Too many analyses started from here. Try again in an hour.'] },
      { status: 429 },
    )
  }

  const cookieId = request.cookies.get(ATTRIBUTION_COOKIE)?.value ?? null

  try {
    const session = await createAnalysisSession({
      cookieId,
      userAgent: request.headers.get('user-agent'),
      ip,
    })
    return NextResponse.json({ ok: true, publicId: session.publicId })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json(
      { ok: false, errors: ['We could not start the analysis.'], detail: message },
      { status: 500 },
    )
  }
}
