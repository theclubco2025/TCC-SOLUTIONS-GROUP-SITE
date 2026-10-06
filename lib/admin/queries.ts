import { dbOrNull } from '@/lib/db'

/**
 * Everything the admin reads. Every function goes through load(), which turns a
 * thrown error into a value the page can show. That matters because these
 * queries are only ever exercised against the real database, by the operator:
 * one bad query must say what broke in its own section instead of replacing
 * the whole console with a generic error page.
 *
 * Errors are shown in full. This module is only reachable behind requireAdmin().
 */

export type Loaded<T> = { ok: true; data: T } | { ok: false; error: string }

async function load<T>(fn: (db: NonNullable<ReturnType<typeof dbOrNull>>) => Promise<T>): Promise<Loaded<T>> {
  const db = dbOrNull()
  if (!db) {
    return { ok: false, error: 'The database is not connected (DATABASE_URL is not set).' }
  }
  try {
    return { ok: true, data: await fn(db) }
  } catch (e) {
    console.error('[admin] query failed:', e)
    return { ok: false, error: e instanceof Error ? e.message : 'Query failed.' }
  }
}

const LIMIT = 300

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export function loadOverview() {
  return load(async (db) => {
    const sevenDays = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const [
      visits,
      visits7d,
      analysesByStatus,
      leads,
      consultations,
      newApplications,
      partnersByStatus,
      recentLeads,
      recentApplications,
    ] = await Promise.all([
      db.referralSession.count(),
      db.referralSession.count({ where: { landedAt: { gte: sevenDays } } }),
      db.analysisSession.groupBy({ by: ['status'], _count: { _all: true } }),
      db.lead.count(),
      db.lead.count({ where: { consultationRequestedAt: { not: null } } }),
      db.partnerApplication.count({ where: { status: 'NEW' } }),
      db.partner.groupBy({ by: ['status'], _count: { _all: true } }),
      db.lead.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { firstTouchPartner: { select: { name: true } } },
      }),
      db.partnerApplication.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    ])

    const analyses: Record<string, number> = {}
    for (const row of analysesByStatus) analyses[row.status] = row._count._all
    const partners: Record<string, number> = {}
    for (const row of partnersByStatus) partners[row.status] = row._count._all

    return {
      visits,
      visits7d,
      analyses,
      leads,
      consultations,
      newApplications,
      partners,
      recentLeads,
      recentApplications,
    }
  })
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export function loadLeads() {
  return load((db) =>
    db.lead.findMany({
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
      include: {
        firstTouchPartner: { select: { name: true, slug: true } },
        lastTouchPartner: { select: { name: true, slug: true } },
        opportunities: { orderBy: { createdAt: 'desc' }, take: 1, select: { name: true, stage: true } },
      },
    }),
  )
}

export function loadLead(id: string) {
  return load(async (db) => {
    const lead = await db.lead.findUnique({
      where: { id },
      include: {
        firstTouchPartner: { select: { id: true, name: true, slug: true } },
        lastTouchPartner: { select: { id: true, name: true, slug: true } },
        opportunities: {
          orderBy: { createdAt: 'desc' },
          include: {
            analysisSession: {
              include: {
                result: { include: { opportunities: { orderBy: { rank: 'asc' } } } },
              },
            },
          },
        },
      },
    })
    if (!lead) return null

    const [events, referrals] = await Promise.all([
      db.activityEvent.findMany({
        where: { subjectType: 'Lead', subjectId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      db.referral.findMany({
        where: { leadId: id },
        orderBy: { occurredAt: 'asc' },
        include: { partner: { select: { name: true, slug: true } } },
      }),
    ])

    return { lead, events, referrals }
  })
}

// ---------------------------------------------------------------------------
// Applications, partners, analyses, activity
// ---------------------------------------------------------------------------

export function loadApplications() {
  return load((db) =>
    db.partnerApplication.findMany({ orderBy: { createdAt: 'desc' }, take: LIMIT }),
  )
}

export function loadPartners() {
  return load((db) =>
    db.partner.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { referralSessions: true, firstTouchLeads: true, lastTouchLeads: true } },
      },
    }),
  )
}

export function loadAnalyses() {
  return load((db) =>
    db.analysisSession.findMany({
      orderBy: { startedAt: 'desc' },
      take: LIMIT,
      include: {
        referralSession: { select: { partner: { select: { name: true, slug: true } } } },
        result: { select: { inputTokens: true, outputTokens: true, model: true } },
        opportunity: { select: { leadId: true } },
      },
    }),
  )
}

export function loadActivity() {
  return load((db) => db.activityEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }))
}
