/**
 * Plain shapes shared by the database path and the in-memory demo path, so
 * every caller works the same whether or not DATABASE_URL is set.
 */

export type PartnerStatusValue = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'TERMINATED'
export type ProductValue = 'TCCSG' | 'PLATEHAVEN' | 'NAVITAP'

export type PartnerRecord = {
  id: string
  slug: string
  name: string
  product: ProductValue
  status: PartnerStatusValue
  commissionRate: number | null
}

export type ReferralSessionRecord = {
  id: string
  partnerId: string
  partnerSlug: string
  cookieId: string
  landedAt: Date
  landingPath: string
}

/**
 * First and last touch are different questions and the system must answer both.
 * A prospect who arrives through Partner A and returns later through Partner B
 * has firstTouch = A and lastTouch = B; A is never erased.
 */
export type TouchSummary = {
  firstTouch: { partnerSlug: string; partnerName: string; at: Date } | null
  lastTouch: { partnerSlug: string; partnerName: string; at: Date } | null
  visitCount: number
}
