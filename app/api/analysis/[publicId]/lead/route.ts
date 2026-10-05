import { NextResponse, type NextRequest } from 'next/server'
import { submitLead } from '@/lib/sales/leads'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * "Turn this analysis into a plan."
 *
 * The body carries contact details and nothing else. Attribution is deliberately
 * not accepted from the client: which partner introduced this person is read
 * from stored referral sessions on the server, so there is no field here a
 * visitor — or a partner — could use to claim credit.
 *
 * The response never includes the lead id. The caller has no use for it, and
 * returning internal ids from a public endpoint is a habit not worth starting.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, errors: ['Malformed request.'] }, { status: 400 })
  }

  const outcome = await submitLead(publicId, body)

  if (!outcome.ok) {
    return NextResponse.json({ ok: false, errors: outcome.errors }, { status: outcome.status })
  }

  return NextResponse.json({ ok: true, alreadySubmitted: outcome.alreadySubmitted })
}
