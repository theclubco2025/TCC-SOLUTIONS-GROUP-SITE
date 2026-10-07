import { dbOrNull } from '@/lib/db'
import { demoFindResult, demoSaveResult, demoUpdateAnalysis } from '@/lib/demo-store'
import { rangeFor, type AnalysisPayload } from '@/lib/analysis/ai'
import { ANALYSIS_LIMITS } from '@/lib/analysis/config'
import type { RoiResults } from '@/lib/analysis/roi'
import type { AnalysisResultRecord, OpportunityRecord, ProposalDetail } from '@/lib/types'

/**
 * Storing and reading a finished assessment.
 *
 * The result is written once and read many times. That is what makes a refresh
 * free: the results page never calls the model, it reads this.
 */

export type SaveInput = {
  sessionId: string
  publicId: string
  payload: AnalysisPayload
  roi: RoiResults
  model: string
  effort: string
  inputTokens: number
  outputTokens: number
}

/** Money comes from config via the complexity band, never from the model. */
function toOpportunities(payload: AnalysisPayload): OpportunityRecord[] {
  return payload.opportunities.slice(0, ANALYSIS_LIMITS.maxOpportunities).map((o, i) => {
    const range = rangeFor(o.complexity)
    return {
      rank: i + 1,
      title: o.title,
      category: o.category,
      problem: o.problem,
      solution: o.solution,
      impact: o.impact,
      complexity: o.complexity,
      implementationLow: range.low,
      implementationHigh: range.high,
      existingSoftwarePossible: o.existingSoftwarePossible,
      customDevelopmentPotential: o.customDevelopmentPotential,
      confidence: o.confidence,
      reasoning: o.reasoning,
      detail: { today: o.today, withIt: o.withIt, questions: o.questionsForCall },
    }
  })
}

/** Stored JSON from before proposals existed, or from a bad row, reads as absent. */
function asDetail(v: unknown): ProposalDetail | null {
  if (!v || typeof v !== 'object') return null
  const d = v as Record<string, unknown>
  const strings = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : [])
  const detail = { today: strings(d.today), withIt: strings(d.withIt), questions: strings(d.questions) }
  return detail.today.length || detail.withIt.length || detail.questions.length ? detail : null
}

function asStrings(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null
  const out = v.filter((s): s is string => typeof s === 'string')
  return out.length > 0 ? out : null
}

export async function saveAnalysisResult(input: SaveInput): Promise<void> {
  const { payload, roi } = input
  const opportunities = toOpportunities(payload)
  const headline = roi.headline?.value ?? null
  const now = new Date()

  const db = dbOrNull()

  if (!db) {
    demoSaveResult(input.publicId, {
      businessSummary: payload.businessSummary,
      technologyEnvironment: payload.technologyEnvironment,
      overallAssessment: payload.overallAssessment,
      recommendedNextStep: payload.recommendedNextStep,
      roiResults: roi,
      estimatedAnnualValue: headline,
      model: input.model,
      effort: input.effort,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      generatedAt: now,
      startToday: payload.startToday.slice(0, 2),
      opportunities,
    })
    demoUpdateAnalysis(input.publicId, { status: 'COMPLETED', completedAt: now })
    return
  }

  // One transaction: a session marked COMPLETED with no result behind it would
  // send the visitor to a report that does not exist.
  await db.$transaction([
    db.analysisResult.deleteMany({ where: { analysisSessionId: input.sessionId } }),
    db.analysisResult.create({
      data: {
        analysisSessionId: input.sessionId,
        businessSummary: payload.businessSummary,
        technologyEnvironment: payload.technologyEnvironment,
        overallAssessment: payload.overallAssessment,
        recommendedNextStep: payload.recommendedNextStep,
        roiResults: roi as unknown as object,
        estimatedAnnualValue: headline,
        model: input.model,
        effort: input.effort,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        startToday: payload.startToday.slice(0, 2),
        opportunities: {
          create: opportunities.map((o) => ({ ...o, detail: o.detail ?? undefined })),
        },
      },
    }),
    db.analysisSession.update({
      where: { id: input.sessionId },
      data: { status: 'COMPLETED', completedAt: now, failureReason: null },
    }),
    db.activityEvent.create({
      data: {
        actorType: 'SYSTEM',
        subjectType: 'AnalysisSession',
        subjectId: input.sessionId,
        verb: 'analysis.completed',
        payload: {
          opportunities: opportunities.length,
          model: input.model,
          outputTokens: input.outputTokens,
        },
      },
    }),
  ])
}

export async function findAnalysisResult(publicId: string): Promise<AnalysisResultRecord | null> {
  const db = dbOrNull()
  if (!db) return demoFindResult(publicId)

  const row = await db.analysisResult.findFirst({
    where: { analysisSession: { publicId } },
    include: { opportunities: { orderBy: { rank: 'asc' } } },
  })
  if (!row) return null

  return {
    businessSummary: row.businessSummary,
    technologyEnvironment: row.technologyEnvironment,
    overallAssessment: row.overallAssessment,
    recommendedNextStep: row.recommendedNextStep,
    roiResults: row.roiResults,
    estimatedAnnualValue: row.estimatedAnnualValue ? Number(row.estimatedAnnualValue) : null,
    model: row.model,
    effort: row.effort,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    generatedAt: row.generatedAt,
    startToday: asStrings(row.startToday),
    opportunities: row.opportunities.map((o) => ({
      rank: o.rank,
      title: o.title,
      category: o.category,
      problem: o.problem,
      solution: o.solution,
      impact: o.impact,
      complexity: o.complexity,
      implementationLow: Number(o.implementationLow),
      implementationHigh: Number(o.implementationHigh),
      existingSoftwarePossible: o.existingSoftwarePossible,
      customDevelopmentPotential: o.customDevelopmentPotential,
      confidence: o.confidence,
      reasoning: o.reasoning,
      detail: asDetail(o.detail),
    })),
  }
}

export async function markAnalyzing(sessionId: string, publicId: string): Promise<void> {
  const db = dbOrNull()
  const now = new Date()
  if (!db) {
    demoUpdateAnalysis(publicId, { status: 'ANALYZING', analyzingStartedAt: now })
    return
  }
  await db.analysisSession.update({
    where: { id: sessionId },
    data: { status: 'ANALYZING', analyzingStartedAt: now, failureReason: null },
  })
}

export async function markFailed(
  sessionId: string,
  publicId: string,
  reason: string,
): Promise<void> {
  const db = dbOrNull()
  if (!db) {
    demoUpdateAnalysis(publicId, { status: 'FAILED', failureReason: reason })
    return
  }
  await db.analysisSession.update({
    where: { id: sessionId },
    data: { status: 'FAILED', failureReason: reason.slice(0, 500) },
  })
}
