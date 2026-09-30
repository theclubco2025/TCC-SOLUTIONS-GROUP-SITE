import type {
  AnalysisResultRecord,
  AnalysisSessionRecord,
  PartnerRecord,
  ReferralSessionRecord,
} from '@/lib/types'

/**
 * In-memory store used ONLY when DATABASE_URL is unset, so the partner system
 * is demonstrable on the live domain before Postgres exists. Pattern copied
 * from NaviTap's `lib/demo-store.ts` and reseeded for TCCSG.
 *
 * It resets whenever the serverless instance recycles. That is fine for
 * proving the attribution chain and wrong for anything real — which is exactly
 * why setting DATABASE_URL turns it off completely rather than supplementing it.
 */

type DemoDb = {
  partners: PartnerRecord[]
  sessions: ReferralSessionRecord[]
  analyses: (AnalysisSessionRecord & { ipHash: string | null })[]
  results: Record<string, AnalysisResultRecord>
}

const g = globalThis as unknown as { __tccsgDemo?: DemoDb }

/**
 * Ids for the in-memory store. Date.now() alone is not unique — two sessions
 * created in the same millisecond would collide and corrupt the touch history.
 */
export function demoId(prefix: string): string {
  return `demo-${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function partner(slug: string, name: string): PartnerRecord {
  return {
    id: `demo-partner-${slug}`,
    slug,
    name,
    product: 'TCCSG',
    status: 'ACTIVE',
    commissionRate: null,
  }
}

function seed(): DemoDb {
  return {
    partners: [
      partner('el-dorado-business-network', 'El Dorado Business Network'),
      partner('test-partner', 'Test Partner'),
      partner('other-partner', 'Other Partner'),
    ],
    sessions: [],
    analyses: [],
    results: {},
  }
}

function db(): DemoDb {
  if (!g.__tccsgDemo) g.__tccsgDemo = seed()
  return g.__tccsgDemo
}

export function demoFindPartner(slug: string): PartnerRecord | null {
  return db().partners.find((p) => p.slug === slug.toLowerCase()) ?? null
}

export function demoListPartners(): PartnerRecord[] {
  return [...db().partners]
}

export function demoRecordSession(
  session: Omit<ReferralSessionRecord, 'id'>,
): ReferralSessionRecord {
  const row: ReferralSessionRecord = { ...session, id: demoId('session') }
  db().sessions.push(row)
  return row
}

/** Every visit by one browser, oldest first — the basis for first vs last touch. */
export function demoSessionsForCookie(cookieId: string): ReferralSessionRecord[] {
  return db()
    .sessions.filter((s) => s.cookieId === cookieId)
    .sort((a, b) => a.landedAt.getTime() - b.landedAt.getTime())
}

/** Most recent referral visit for a browser — the session an analysis hangs off. */
export function demoLatestSessionForCookie(cookieId: string): ReferralSessionRecord | null {
  const all = demoSessionsForCookie(cookieId)
  return all.length > 0 ? all[all.length - 1] : null
}

// --- analysis sessions -----------------------------------------------------

export function demoCreateAnalysis(
  record: AnalysisSessionRecord & { ipHash: string | null },
): AnalysisSessionRecord {
  db().analyses.push(record)
  return record
}

export function demoFindAnalysis(publicId: string): AnalysisSessionRecord | null {
  return db().analyses.find((a) => a.publicId === publicId) ?? null
}

export function demoUpdateAnalysis(
  publicId: string,
  patch: Partial<AnalysisSessionRecord>,
): AnalysisSessionRecord | null {
  const row = db().analyses.find((a) => a.publicId === publicId)
  if (!row) return null
  Object.assign(row, patch)
  return row
}

/** Completions from one address since a cutoff — the rate limit input. */
export function demoCountCompletionsSince(ipHash: string, since: Date): number {
  return db().analyses.filter(
    (a) =>
      a.ipHash === ipHash &&
      a.completedAt !== null &&
      a.completedAt.getTime() >= since.getTime(),
  ).length
}

export function demoSaveResult(publicId: string, result: AnalysisResultRecord): void {
  db().results[publicId] = result
}

export function demoFindResult(publicId: string): AnalysisResultRecord | null {
  return db().results[publicId] ?? null
}
