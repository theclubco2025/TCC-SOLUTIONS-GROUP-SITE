import { createHash, randomUUID } from 'crypto'
import { dbOrNull } from '@/lib/db'
import {
  demoFindPartner,
  demoListPartners,
  demoRecordSession,
  demoSessionsForCookie,
} from '@/lib/demo-store'
import type { PartnerRecord, TouchSummary } from '@/lib/types'

/**
 * Attribution for TCCSG partner referral links.
 *
 * The database is the system of record, not the cookie. The browser carries
 * only an opaque id; every question about who introduced whom is answered by
 * querying referral sessions for that id. That is deliberate — a cookie can be
 * cleared or forged, and attribution has to survive being audited.
 */

export {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_COOKIE_MAX_AGE,
  ATTRIBUTION_HEADER,
} from '@/lib/attribution-cookie'

export function newCookieId(): string {
  return randomUUID()
}

/** Hashed, not stored raw: these exist to spot abuse, not to identify people. */
function hash(value: string | null | undefined): string | null {
  if (!value) return null
  return createHash('sha256').update(value).digest('hex').slice(0, 32)
}

/**
 * Resolve a partner slug to a partner. Only ACTIVE partners resolve — a pending
 * or terminated partner's link must not attribute, and returning null (rather
 * than a distinct error) avoids leaking which slugs exist.
 */
export async function findActivePartner(slug: string): Promise<PartnerRecord | null> {
  const db = dbOrNull()
  if (!db) {
    const p = demoFindPartner(slug)
    return p && p.status === 'ACTIVE' ? p : null
  }

  const row = await db.partner.findUnique({ where: { slug: slug.toLowerCase() } })
  if (!row || row.status !== 'ACTIVE') return null

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    product: row.product,
    status: row.status,
    commissionRate: row.commissionRate,
  }
}

export async function listPartners(): Promise<PartnerRecord[]> {
  const db = dbOrNull()
  if (!db) return demoListPartners()
  const rows = await db.partner.findMany({ orderBy: { name: 'asc' } })
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    product: row.product,
    status: row.status,
    commissionRate: row.commissionRate,
  }))
}

export type VisitInput = {
  partner: PartnerRecord
  cookieId: string
  landingPath: string
  searchParams?: Record<string, string | undefined>
  referrerUrl?: string | null
  userAgent?: string | null
  ip?: string | null
}

/**
 * Record one visit to a partner's referral link.
 *
 * Every visit is its own row. Nothing is updated and nothing is overwritten,
 * so a prospect who arrives through Partner A and returns through Partner B
 * leaves both facts intact — which is what makes first-touch attribution
 * defensible months later.
 */
export async function recordReferralVisit(input: VisitInput): Promise<void> {
  const { partner, cookieId, landingPath, searchParams = {} } = input

  const db = dbOrNull()
  if (!db) {
    demoRecordSession({
      partnerId: partner.id,
      partnerSlug: partner.slug,
      cookieId,
      landedAt: new Date(),
      landingPath,
    })
    return
  }

  await db.referralSession.create({
    data: {
      partnerId: partner.id,
      product: partner.product,
      cookieId,
      landingPath,
      utmSource: searchParams.utm_source ?? null,
      utmMedium: searchParams.utm_medium ?? null,
      utmCampaign: searchParams.utm_campaign ?? null,
      utmTerm: searchParams.utm_term ?? null,
      utmContent: searchParams.utm_content ?? null,
      referrerUrl: input.referrerUrl ?? null,
      userAgentHash: hash(input.userAgent),
      ipHash: hash(input.ip),
    },
  })

  await db.activityEvent.create({
    data: {
      actorType: 'VISITOR',
      subjectType: 'Partner',
      subjectId: partner.id,
      verb: 'referral.visit',
      payload: { cookieId, landingPath, slug: partner.slug },
    },
  })
}

/**
 * First and last touch for one browser. These are different relationships and
 * the system reports both: the commission rule decides which one pays, and that
 * decision must never be baked into the data.
 */
export async function touchSummary(cookieId: string): Promise<TouchSummary> {
  const db = dbOrNull()

  if (!db) {
    const sessions = demoSessionsForCookie(cookieId)
    if (sessions.length === 0) return { firstTouch: null, lastTouch: null, visitCount: 0 }
    const name = (slug: string) => demoFindPartner(slug)?.name ?? slug
    const first = sessions[0]
    const last = sessions[sessions.length - 1]
    return {
      firstTouch: { partnerSlug: first.partnerSlug, partnerName: name(first.partnerSlug), at: first.landedAt },
      lastTouch: { partnerSlug: last.partnerSlug, partnerName: name(last.partnerSlug), at: last.landedAt },
      visitCount: sessions.length,
    }
  }

  const sessions = await db.referralSession.findMany({
    where: { cookieId },
    orderBy: { landedAt: 'asc' },
    include: { partner: { select: { slug: true, name: true } } },
  })

  if (sessions.length === 0) return { firstTouch: null, lastTouch: null, visitCount: 0 }

  const first = sessions[0]
  const last = sessions[sessions.length - 1]
  return {
    firstTouch: { partnerSlug: first.partner.slug, partnerName: first.partner.name, at: first.landedAt },
    lastTouch: { partnerSlug: last.partner.slug, partnerName: last.partner.name, at: last.landedAt },
    visitCount: sessions.length,
  }
}

/** Canonical origin for building shareable referral links and QR codes. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://tccsolutionsgroup.com').replace(/\/$/, '')
}

export function referralLinkFor(slug: string): string {
  return `${siteUrl()}/${slug}/analyze`
}
