import { NextResponse, type NextRequest } from 'next/server'
import { ANALYSIS_EFFORT, ANALYSIS_MODEL, runAnalysis } from '@/lib/analysis/ai'
import { ANALYSIS_LIMITS } from '@/lib/analysis/config'
import { calculateRoi } from '@/lib/analysis/roi'
import { markAnalyzing, markFailed, saveAnalysisResult } from '@/lib/analysis/results'
import {
  completionsFromIpLastHour,
  findAnalysisSession,
  isRateLimited,
  validateAnswers,
} from '@/lib/analysis/sessions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Vercel kills the function at the plan's ceiling regardless of what this says;
 * declaring it means we get the whole allowance rather than a shorter default.
 * The model call is budgeted well inside it — see ANALYSIS_EFFORT.
 */
export const maxDuration = 60

/**
 * The only route that spends money. Everything here exists to make sure it
 * spends it once, on a complete questionnaire, for a real visitor.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params

  const session = await findAnalysisSession(publicId)
  if (!session) {
    return NextResponse.json({ ok: false, errors: ['Not found.'] }, { status: 404 })
  }

  // Already done. Reloading the results page must never re-run the model.
  if (session.status === 'COMPLETED') {
    return NextResponse.json({ ok: true, alreadyComplete: true })
  }

  // In flight. A stale ANALYZING means the function was killed mid-call, so
  // after a grace period we let it be retried rather than stranding the visitor.
  if (session.status === 'ANALYZING') {
    const startedAt = session.analyzingStartedAt?.getTime() ?? 0
    const ageSeconds = (Date.now() - startedAt) / 1000
    if (ageSeconds < ANALYSIS_LIMITS.retryAfterSeconds) {
      return NextResponse.json(
        { ok: false, errors: ['This analysis is already running. Give it a moment.'] },
        { status: 409 },
      )
    }
  }

  const answers = session.answers ?? {}
  const errors = validateAnswers(answers)
  if (errors.length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 })
  }

  const ip = request.headers.get('x-forwarded-for')
  if (isRateLimited(await completionsFromIpLastHour(ip))) {
    return NextResponse.json(
      {
        ok: false,
        errors: ['You have run several analyses in the last hour. Please try again later.'],
      },
      { status: 429 },
    )
  }

  // Deterministic first. The model is given these as fact and cannot produce
  // its own, so the arithmetic is settled before it ever sees the questionnaire.
  const roi = calculateRoi(session.roiInputs)

  await markAnalyzing(session.id, publicId)

  const outcome = await runAnalysis(answers, roi)

  if (!outcome.ok) {
    await markFailed(session.id, publicId, outcome.reason)
    return NextResponse.json(
      {
        ok: false,
        errors: ['We could not complete the analysis. Nothing you entered was lost.'],
        detail: outcome.reason,
      },
      { status: 502 },
    )
  }

  try {
    await saveAnalysisResult({
      sessionId: session.id,
      publicId,
      payload: outcome.payload,
      roi,
      model: ANALYSIS_MODEL,
      effort: ANALYSIS_EFFORT,
      inputTokens: outcome.inputTokens,
      outputTokens: outcome.outputTokens,
    })
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'unknown error'
    await markFailed(session.id, publicId, `storage failed: ${reason}`)
    return NextResponse.json(
      { ok: false, errors: ['We analysed it but could not save the report.'], detail: reason },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
