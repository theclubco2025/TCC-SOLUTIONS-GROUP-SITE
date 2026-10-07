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
export type AnalysisStatusValue =
  | 'STARTED'
  | 'ANALYZING'
  | 'COMPLETED'
  | 'FAILED'
  | 'ABANDONED'

/** Questionnaire answers. Values are strings, or string arrays for multiselect. */
export type AnalysisAnswers = Record<string, string | string[]>

/** ROI inputs are numbers the visitor typed, or absent. Absent is expected. */
export type RoiInputs = Record<string, number>

export type AnalysisSessionRecord = {
  id: string
  publicId: string
  status: AnalysisStatusValue
  questionnaireVersion: number
  answers: AnalysisAnswers | null
  roiInputs: RoiInputs | null
  referralSessionId: string | null
  cookieId: string | null
  startedAt: Date
  completedAt: Date | null
  analyzingStartedAt: Date | null
  failureReason: string | null
}

export type OpportunityRecord = {
  rank: number
  title: string
  category: string
  problem: string
  solution: string
  impact: string
  complexity: string
  implementationLow: number
  implementationHigh: number
  existingSoftwarePossible: boolean
  customDevelopmentPotential: boolean
  confidence: string
  reasoning: string
  /** Absent on reports generated before proposals existed. */
  detail?: ProposalDetail | null
}

/** A proposal's process today and with the fix, and what a call would settle. */
export type ProposalDetail = {
  today: string[]
  withIt: string[]
  questions: string[]
}

export type AnalysisResultRecord = {
  businessSummary: string
  technologyEnvironment: string
  overallAssessment: string
  recommendedNextStep: string
  /** Shape of RoiResults, stored as JSON so the report renders what was computed. */
  roiResults: unknown
  estimatedAnnualValue: number | null
  model: string
  effort: string | null
  inputTokens: number | null
  outputTokens: number | null
  generatedAt: Date
  /** Absent on reports generated before proposals existed. */
  startToday?: string[] | null
  opportunities: OpportunityRecord[]
}

/**
 * A prospect who has identified themselves. Attribution (the two partner ids)
 * and ownership (ownerUserId) are separate columns on purpose and must stay so.
 */
export type LeadRecord = {
  id: string
  businessName: string
  contactName: string | null
  email: string
  phone: string | null
  website: string | null
  firstTouchPartnerId: string | null
  lastTouchPartnerId: string | null
  ownerUserId: string | null
  consultationRequestedAt: Date | null
  analysisSessionId: string | null
  createdAt: Date
}

export type OpportunityRow = {
  id: string
  leadId: string
  analysisSessionId: string
  name: string
  stage: string
  createdAt: Date
}

export type TouchSummary = {
  firstTouch: { partnerSlug: string; partnerName: string; at: Date } | null
  lastTouch: { partnerSlug: string; partnerName: string; at: Date } | null
  visitCount: number
}
