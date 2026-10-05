import { beforeEach, describe, expect, it } from 'vitest'
import { findActivePartner, recordReferralVisit, touchSummary } from '@/lib/attribution'
import {
  createAnalysisSession,
  normaliseAnswers,
  normaliseRoiInputs,
  validateAnswers,
} from '@/lib/analysis/sessions'
import { resetDemoStore } from '@/lib/demo-store'

/**
 * These run against the in-memory store (no DATABASE_URL in the test env), so
 * they exercise the real control flow without a database.
 *
 * What they protect is the single most important property of the system: an
 * analysis must stay connected to the partner who introduced the visitor, even
 * though the visitor is anonymous and may arrive days later by a different
 * route. Break that and commissions become unanswerable.
 */

beforeEach(() => resetDemoStore())

async function visit(slug: string, cookieId: string) {
  const partner = await findActivePartner(slug)
  if (!partner) throw new Error(`demo partner ${slug} missing`)
  await recordReferralVisit({ partner, cookieId, landingPath: `/${slug}/analyze` })
  return partner
}

describe('attribution survives into the analysis', () => {
  it('links the analysis to the partner whose link they clicked', async () => {
    const cookie = 'cookie-sarah'
    await visit('test-partner', cookie)

    const session = await createAnalysisSession({ cookieId: cookie })
    expect(session.referralSessionId).not.toBeNull()

    const touches = await touchSummary(cookie)
    expect(touches.firstTouch?.partnerSlug).toBe('test-partner')
  })

  it('still attributes when they leave and come back directly days later', async () => {
    const cookie = 'cookie-returning'

    // Monday: arrives through a partner link.
    await visit('el-dorado-business-network', cookie)

    // Later: types the address in directly and starts the analysis. No partner
    // slug in the URL at all — the cookie is the only thread, which is the
    // whole point of not carrying attribution in the link.
    const session = await createAnalysisSession({ cookieId: cookie })

    expect(session.referralSessionId).not.toBeNull()
    const touches = await touchSummary(cookie)
    expect(touches.firstTouch?.partnerSlug).toBe('el-dorado-business-network')
  })

  it('keeps first touch when a second partner sends them again', async () => {
    const cookie = 'cookie-two-partners'
    await visit('test-partner', cookie)
    await visit('other-partner', cookie)

    const touches = await touchSummary(cookie)
    expect(touches.firstTouch?.partnerSlug).toBe('test-partner')
    expect(touches.lastTouch?.partnerSlug).toBe('other-partner')
    expect(touches.visitCount).toBe(2)
  })

  it('attributes direct traffic to nobody, without failing', async () => {
    const session = await createAnalysisSession({ cookieId: null })
    expect(session.referralSessionId).toBeNull()
    expect(session.status).toBe('STARTED')
  })

  it('attributes to nobody when the browser has a cookie but no partner visit', async () => {
    const session = await createAnalysisSession({ cookieId: 'cookie-never-referred' })
    expect(session.referralSessionId).toBeNull()
  })

  it('gives every analysis an unguessable id, not a sequential one', async () => {
    const a = await createAnalysisSession({ cookieId: null })
    const b = await createAnalysisSession({ cookieId: null })
    expect(a.publicId).not.toBe(b.publicId)
    expect(a.publicId.length).toBeGreaterThanOrEqual(20)
  })
})

describe('the client does not get to decide what is stored', () => {
  it('drops keys that are not questions', () => {
    const out = normaliseAnswers({ businessName: 'Maple Street Bakery', isAdmin: true, evil: 'x' })
    expect(out.businessName).toBe('Maple Street Bakery')
    expect(out.isAdmin).toBeUndefined()
    expect(out.evil).toBeUndefined()
  })

  it('rejects dropdown values that are not on the list', () => {
    expect(normaliseAnswers({ industry: 'Retail' }).industry).toBe('Retail')
    expect(normaliseAnswers({ industry: 'Not a real option' }).industry).toBeUndefined()
  })

  it('keeps valid multiselect options and discards invented ones', () => {
    const out = normaliseAnswers({ improvementGoals: ['Save time', 'Become immortal'] })
    expect(out.improvementGoals).toEqual(['Save time'])
  })

  it('truncates rather than storing unbounded text', () => {
    const out = normaliseAnswers({ repetitiveWork: 'x'.repeat(5000) })
    expect((out.repetitiveWork as string).length).toBe(1500)
  })

  it('ignores ROI numbers outside their range instead of clamping them', () => {
    expect(normaliseRoiInputs({ hoursPerWeek: 10 }).hoursPerWeek).toBe(10)
    expect(normaliseRoiInputs({ hoursPerWeek: 99999 }).hoursPerWeek).toBeUndefined()
    expect(normaliseRoiInputs({ hoursPerWeek: -5 }).hoursPerWeek).toBeUndefined()
    expect(normaliseRoiInputs({ hoursPerWeek: 'ten' }).hoursPerWeek).toBeUndefined()
  })
})

describe('validation before anything is spent on a model call', () => {
  it('names every missing required answer', () => {
    expect(validateAnswers({})).toHaveLength(4)
  })

  it('passes once the four required answers are there', () => {
    const errors = validateAnswers({
      businessName: 'Maple Street Bakery',
      industry: 'Restaurant, café or bar',
      repetitiveWork: 'Typing catering orders into a spreadsheet.',
      oneThingToEliminate: 'Chasing deposits.',
    })
    expect(errors).toEqual([])
  })

  it('treats whitespace as unanswered', () => {
    const errors = validateAnswers({
      businessName: '   ',
      industry: 'Retail',
      repetitiveWork: 'Something real.',
      oneThingToEliminate: 'Something else real.',
    })
    expect(errors).toHaveLength(1)
  })
})
