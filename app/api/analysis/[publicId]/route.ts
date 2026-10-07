import { NextResponse, type NextRequest } from 'next/server'
import {
  findAnalysisSession,
  normaliseAnswers,
  normaliseRoiInputs,
  saveAnswers,
  saveRoiInputs,
} from '@/lib/analysis/sessions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ publicId: string }> }

/**
 * Where the analysis is. The waiting screen polls this so it can offer
 * "View my analysis" when the report is ready, rather than swapping the page
 * under the reader. Status only: the public id is the visitor's own token, and
 * nothing here is more than they can already see.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const { publicId } = await params
  const session = await findAnalysisSession(publicId)
  if (!session) {
    return NextResponse.json({ ok: false, errors: ['Not found.'] }, { status: 404 })
  }
  return NextResponse.json(
    { ok: true, status: session.status },
    { headers: { 'cache-control': 'no-store' } },
  )
}

/**
 * Autosave. Called as the visitor types, so it must be cheap and must never
 * reject a partial answer set — validation belongs at completion, not here.
 * A half-finished questionnaire is a normal state worth keeping.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { publicId } = await params

  const session = await findAnalysisSession(publicId)
  if (!session) {
    return NextResponse.json({ ok: false, errors: ['Not found.'] }, { status: 404 })
  }

  // Once analysed, the answers are the record of what was analysed. Letting
  // them drift afterwards would make the stored report describe a questionnaire
  // that no longer exists.
  if (session.status === 'COMPLETED' || session.status === 'ANALYZING') {
    return NextResponse.json(
      { ok: false, errors: ['This analysis has already been submitted.'] },
      { status: 409 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, errors: ['Malformed request.'] }, { status: 400 })
  }

  try {
    if (body.answers !== undefined) {
      await saveAnswers(publicId, normaliseAnswers(body.answers))
    }
    if (body.roiInputs !== undefined) {
      await saveRoiInputs(publicId, normaliseRoiInputs(body.roiInputs))
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json(
      { ok: false, errors: ['We could not save that.'], detail: message },
      { status: 500 },
    )
  }
}
