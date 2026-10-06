import { createHash, randomBytes } from 'crypto'
import { dbOrNull } from '@/lib/db'
import {
  demoCountCompletionsSince,
  demoCreateAnalysis,
  demoFindAnalysis,
  demoLatestSessionForCookie,
  demoId,
  demoUpdateAnalysis,
} from '@/lib/demo-store'
import {
  ALL_QUESTIONS,
  ANALYSIS_LIMITS,
  QUESTIONNAIRE_VERSION,
} from '@/lib/analysis/config'
import type {
  AnalysisAnswers,
  AnalysisSessionRecord,
  RoiInputs,
} from '@/lib/types'

/**
 * Creating, resuming and saving an analysis.
 *
 * The visitor is anonymous throughout — there is no login and no email gate,
 * so the browser's attribution cookie is the only thread tying an analysis to
 * the partner who sent them. That thread is read here and stored once.
 */

/** Unguessable, because this URL exposes a business's own account of its weaknesses. */
export function newPublicId(): string {
  return randomBytes(16).toString('base64url')
}

function hash(value: string | null | undefined): string | null {
  if (!value) return null
  return createHash('sha256').update(value).digest('hex').slice(0, 32)
}

export type CreateInput = {
  cookieId: string | null
  userAgent?: string | null
  ip?: string | null
}

/**
 * Start an analysis, attaching it to the visitor's most recent referral visit
 * when there is one. Direct traffic simply has no referral session — that is a
 * normal outcome, not an error.
 */
export async function createAnalysisSession(input: CreateInput): Promise<AnalysisSessionRecord> {
  const publicId = newPublicId()
  const now = new Date()
  const ipHash = hash(input.ip)
  const userAgentHash = hash(input.userAgent)

  const db = dbOrNull()

  if (!db) {
    const latest = input.cookieId ? demoLatestSessionForCookie(input.cookieId) : null
    return demoCreateAnalysis({
      id: demoId('analysis'),
      publicId,
      status: 'STARTED',
      questionnaireVersion: QUESTIONNAIRE_VERSION,
      answers: null,
      roiInputs: null,
      referralSessionId: latest?.id ?? null,
      cookieId: input.cookieId,
      startedAt: now,
      completedAt: null,
      analyzingStartedAt: null,
      failureReason: null,
      ipHash,
    })
  }

  const latest = input.cookieId
    ? await db.referralSession.findFirst({
        where: { cookieId: input.cookieId },
        orderBy: { landedAt: 'desc' },
        select: { id: true },
      })
    : null

  const row = await db.analysisSession.create({
    data: {
      publicId,
      status: 'STARTED',
      questionnaireVersion: QUESTIONNAIRE_VERSION,
      referralSessionId: latest?.id ?? null,
      cookieId: input.cookieId,
      ipHash,
      userAgentHash,
    },
  })

  await db.activityEvent.create({
    data: {
      actorType: 'VISITOR',
      subjectType: 'AnalysisSession',
      subjectId: row.id,
      verb: 'analysis.started',
      payload: { referralSessionId: latest?.id ?? null },
    },
  })

  return toRecord(row)
}

export async function findAnalysisSession(publicId: string): Promise<AnalysisSessionRecord | null> {
  const db = dbOrNull()
  if (!db) return demoFindAnalysis(publicId)

  const row = await db.analysisSession.findUnique({ where: { publicId } })
  return row ? toRecord(row) : null
}

export async function saveAnswers(
  publicId: string,
  answers: AnalysisAnswers,
): Promise<AnalysisSessionRecord | null> {
  const db = dbOrNull()
  if (!db) return demoUpdateAnalysis(publicId, { answers })

  const row = await db.analysisSession.update({
    where: { publicId },
    data: { answers: answers as object },
  })
  return toRecord(row)
}

export async function saveRoiInputs(
  publicId: string,
  roiInputs: RoiInputs,
): Promise<AnalysisSessionRecord | null> {
  const db = dbOrNull()
  if (!db) return demoUpdateAnalysis(publicId, { roiInputs })

  const row = await db.analysisSession.update({
    where: { publicId },
    data: { roiInputs: roiInputs as object },
  })
  return toRecord(row)
}

/**
 * Completed analyses from this address in the last hour. Each completion costs
 * a model call, and the endpoint is public, so this is the difference between
 * a funnel and an open tab on the API bill.
 */
export async function completionsFromIpLastHour(ip: string | null | undefined): Promise<number> {
  const ipHash = hash(ip)
  if (!ipHash) return 0

  const since = new Date(Date.now() - 60 * 60 * 1000)
  const db = dbOrNull()
  if (!db) return demoCountCompletionsSince(ipHash, since)

  return db.analysisSession.count({
    where: { ipHash, completedAt: { gte: since } },
  })
}

export function isRateLimited(count: number): boolean {
  return count >= ANALYSIS_LIMITS.completionsPerIpPerHour
}

/** Sessions started from this address in the last hour. Cheap to create, not free to store. */
export async function startsFromIpLastHour(ip: string | null | undefined): Promise<number> {
  const ipHash = hash(ip)
  if (!ipHash) return 0

  const since = new Date(Date.now() - 60 * 60 * 1000)
  const db = dbOrNull()
  if (!db) return 0

  return db.analysisSession.count({ where: { ipHash, startedAt: { gte: since } } })
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates a submission against the questionnaire definition rather than a
 * hand-maintained list, so adding a question cannot silently skip validation.
 * Unknown keys are dropped instead of stored — the client does not get to
 * decide what ends up in the record.
 */
export function normaliseAnswers(raw: unknown): AnalysisAnswers {
  const out: AnalysisAnswers = {}
  if (!raw || typeof raw !== 'object') return out
  const input = raw as Record<string, unknown>

  for (const q of ALL_QUESTIONS) {
    const value = input[q.id]
    if (value === undefined || value === null) continue

    if (q.type === 'multiselect') {
      if (!Array.isArray(value)) continue
      const allowed = new Set(q.options ?? [])
      const picked = value
        .filter((v): v is string => typeof v === 'string')
        .filter((v) => allowed.has(v))
      if (picked.length > 0) out[q.id] = picked
      continue
    }

    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed === '') continue

    if (q.type === 'select' && q.options && !q.options.includes(trimmed)) continue

    out[q.id] = trimmed.slice(0, q.maxLength ?? 1000)
  }

  return out
}

export function validateAnswers(answers: AnalysisAnswers): string[] {
  const errors: string[] = []
  for (const q of ALL_QUESTIONS) {
    if (!q.required) continue
    const value = answers[q.id]
    const empty =
      value === undefined ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0)
    if (empty) errors.push(`${q.label} is needed before we can analyse anything.`)
  }
  return errors
}

// Lives with the arithmetic so the browser can run it too (the live calculator
// on the numbers step). Re-exported so the route and tests keep one import.
export { normaliseRoiInputs } from '@/lib/analysis/roi'

// ---------------------------------------------------------------------------

type DbRow = {
  id: string
  publicId: string
  status: string
  questionnaireVersion: number
  answers: unknown
  roiInputs: unknown
  referralSessionId: string | null
  cookieId: string | null
  startedAt: Date
  completedAt: Date | null
  analyzingStartedAt: Date | null
  failureReason: string | null
}

function toRecord(row: DbRow): AnalysisSessionRecord {
  return {
    id: row.id,
    publicId: row.publicId,
    status: row.status as AnalysisSessionRecord['status'],
    questionnaireVersion: row.questionnaireVersion,
    answers: (row.answers as AnalysisAnswers | null) ?? null,
    roiInputs: (row.roiInputs as RoiInputs | null) ?? null,
    referralSessionId: row.referralSessionId,
    cookieId: row.cookieId,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    analyzingStartedAt: row.analyzingStartedAt,
    failureReason: row.failureReason,
  }
}
