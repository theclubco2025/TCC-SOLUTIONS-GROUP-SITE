import { beforeEach, describe, expect, it } from 'vitest'
import { findActivePartner, recordReferralVisit } from '@/lib/attribution'
import { createAnalysisSession } from '@/lib/analysis/sessions'
import {
  demoAllLeads,
  demoAllOpportunities,
  demoSaveResult,
  demoUpdateAnalysis,
  resetDemoStore,
} from '@/lib/demo-store'
import {
  hasSubmittedLead,
  normaliseLeadInput,
  submitLead,
  validateLeadInput,
} from '@/lib/sales/leads'

/**
 * These protect the properties the commission model depends on. Each one is a
 * way the system could quietly start crediting the wrong partner, losing a
 * lead, or double-counting a prospect — none of which would raise an error.
 *
 * They run against the in-memory store (no DATABASE_URL in the test
 * environment), so they exercise the real control flow without a database. The
 * Prisma path implements the same rules and is NOT covered here.
 */

beforeEach(() => resetDemoStore())

const SARAH = {
  name: 'Sarah Chen',
  email: 'sarah@maplestreet.example',
  businessName: 'Maple Street Bakery',
  phone: '555-0100',
  website: 'maplestreet.example',
}

async function visit(slug: string, cookieId: string) {
  const partner = await findActivePartner(slug)
  if (!partner) throw new Error(`demo partner ${slug} missing`)
  await recordReferralVisit({ partner, cookieId, landingPath: `/${slug}/analyze` })
  return partner
}

/** A finished analysis, as the completion route would leave it. */
async function completedAnalysis(cookieId: string | null) {
  const session = await createAnalysisSession({ cookieId })
  demoUpdateAnalysis(session.publicId, { status: 'COMPLETED', completedAt: new Date() })
  demoSaveResult(session.publicId, {
    businessSummary: 's',
    technologyEnvironment: 't',
    overallAssessment: 'o',
    recommendedNextStep: 'n',
    roiResults: null,
    estimatedAnnualValue: null,
    model: 'test',
    effort: null,
    inputTokens: null,
    outputTokens: null,
    generatedAt: new Date(),
    opportunities: [
      {
        rank: 1,
        title: 'Automate catering order intake',
        category: 'Workflow automation',
        problem: 'p',
        solution: 's',
        impact: 'i',
        complexity: 'WORKFLOW',
        implementationLow: 2500,
        implementationHigh: 7500,
        existingSoftwarePossible: true,
        customDevelopmentPotential: false,
        confidence: 'MEDIUM',
        reasoning: 'r',
      },
    ],
  })
  return session
}

async function partnerId(slug: string) {
  return (await findActivePartner(slug))!.id
}

describe('analysis becomes a lead', () => {
  it('creates a lead carrying the partner who introduced them', async () => {
    await visit('test-partner', 'c1')
    const session = await completedAnalysis('c1')

    const out = await submitLead(session.publicId, SARAH)

    expect(out.ok).toBe(true)
    const [lead] = demoAllLeads()
    expect(lead.firstTouchPartnerId).toBe(await partnerId('test-partner'))
    expect(lead.lastTouchPartnerId).toBe(await partnerId('test-partner'))
    expect(lead.businessName).toBe('Maple Street Bakery')
  })

  it('opens an opportunity named for the primary finding', async () => {
    const session = await completedAnalysis(null)
    await submitLead(session.publicId, SARAH)

    const [opp] = demoAllOpportunities()
    expect(opp.name).toBe('Automate catering order intake')
    expect(opp.stage).toBe('DISCOVERY')
    expect(opp.analysisSessionId).toBe(session.id)
  })

  it('records a consultation REQUEST, not a completed consultation', async () => {
    const session = await completedAnalysis(null)
    await submitLead(session.publicId, SARAH)

    const [lead] = demoAllLeads()
    // The only consultation fact we can truthfully record is that they asked.
    expect(lead.consultationRequestedAt).toBeInstanceOf(Date)
  })

  it('does not assign a sales owner — that is a human decision', async () => {
    const session = await completedAnalysis(null)
    await submitLead(session.publicId, SARAH)
    expect(demoAllLeads()[0].ownerUserId).toBeNull()
  })

  it('still works for direct traffic, attributing to nobody', async () => {
    const session = await completedAnalysis(null)
    const out = await submitLead(session.publicId, SARAH)

    expect(out.ok).toBe(true)
    const [lead] = demoAllLeads()
    expect(lead.firstTouchPartnerId).toBeNull()
    expect(lead.lastTouchPartnerId).toBeNull()
  })
})

describe('the partner relationship survives', () => {
  it('credits the partner even when they came back directly days later', async () => {
    // Monday: arrives through John's link, leaves.
    await visit('el-dorado-business-network', 'c-return')
    // Later: types the address in, runs the analysis, asks for a plan. No slug
    // anywhere in the URL — the cookie is the only thread.
    const session = await completedAnalysis('c-return')
    await submitLead(session.publicId, SARAH)

    expect(demoAllLeads()[0].firstTouchPartnerId).toBe(
      await partnerId('el-dorado-business-network'),
    )
  })

  it('keeps first touch and moves last touch when a second partner sends them', async () => {
    await visit('test-partner', 'c-two')
    await visit('other-partner', 'c-two')
    const session = await completedAnalysis('c-two')
    await submitLead(session.publicId, SARAH)

    const [lead] = demoAllLeads()
    expect(lead.firstTouchPartnerId).toBe(await partnerId('test-partner'))
    expect(lead.lastTouchPartnerId).toBe(await partnerId('other-partner'))
  })

  it('never lets a later analysis replace an existing first touch', async () => {
    // First analysis, introduced by test-partner.
    await visit('test-partner', 'c-a')
    const a = await completedAnalysis('c-a')
    await submitLead(a.publicId, SARAH)

    // Same person, different browser, now arrives through other-partner.
    await visit('other-partner', 'c-b')
    const b = await completedAnalysis('c-b')
    await submitLead(b.publicId, SARAH)

    const [lead] = demoAllLeads()
    expect(lead.firstTouchPartnerId).toBe(await partnerId('test-partner'))
    expect(lead.lastTouchPartnerId).toBe(await partnerId('other-partner'))
  })

  it('fills an empty first touch once, then locks it', async () => {
    // First analysis: direct, no partner.
    const a = await completedAnalysis(null)
    await submitLead(a.publicId, SARAH)
    expect(demoAllLeads()[0].firstTouchPartnerId).toBeNull()

    // Later, through a partner: the first partner referral is recorded...
    await visit('test-partner', 'c-late')
    const b = await completedAnalysis('c-late')
    await submitLead(b.publicId, SARAH)
    expect(demoAllLeads()[0].firstTouchPartnerId).toBe(await partnerId('test-partner'))

    // ...and a third, different partner cannot take it.
    await visit('other-partner', 'c-later')
    const c = await completedAnalysis('c-later')
    await submitLead(c.publicId, SARAH)
    expect(demoAllLeads()[0].firstTouchPartnerId).toBe(await partnerId('test-partner'))
  })
})

describe('no duplicates', () => {
  it('turns the same analysis submitted twice into one lead and one opportunity', async () => {
    const session = await completedAnalysis(null)

    const first = await submitLead(session.publicId, SARAH)
    const second = await submitLead(session.publicId, SARAH)

    expect(first.ok && first.alreadySubmitted).toBe(false)
    expect(second.ok && second.alreadySubmitted).toBe(true)
    expect(demoAllLeads()).toHaveLength(1)
    expect(demoAllOpportunities()).toHaveLength(1)
  })

  it('ignores a different email on a repeat submission of the same analysis', async () => {
    const session = await completedAnalysis(null)
    await submitLead(session.publicId, SARAH)
    await submitLead(session.publicId, { ...SARAH, email: 'someone-else@example.com' })

    expect(demoAllLeads()).toHaveLength(1)
    expect(demoAllLeads()[0].email).toBe(SARAH.email)
  })

  it('matches the same person across two analyses and adds an opportunity', async () => {
    const a = await completedAnalysis(null)
    const b = await completedAnalysis(null)
    await submitLead(a.publicId, SARAH)
    const out = await submitLead(b.publicId, SARAH)

    expect(out.ok && out.created).toBe(false)
    expect(demoAllLeads()).toHaveLength(1)
    expect(demoAllOpportunities()).toHaveLength(2)
  })

  it('treats email case and spacing as the same person', async () => {
    const a = await completedAnalysis(null)
    const b = await completedAnalysis(null)
    await submitLead(a.publicId, SARAH)
    await submitLead(b.publicId, { ...SARAH, email: '  SARAH@MapleStreet.Example ' })

    expect(demoAllLeads()).toHaveLength(1)
  })

  it('keeps different people as different leads', async () => {
    const a = await completedAnalysis(null)
    const b = await completedAnalysis(null)
    await submitLead(a.publicId, SARAH)
    await submitLead(b.publicId, { ...SARAH, email: 'mike@other.example', name: 'Mike' })

    expect(demoAllLeads()).toHaveLength(2)
  })

  it('does not overwrite contact details a lead already has', async () => {
    const a = await completedAnalysis(null)
    const b = await completedAnalysis(null)
    await submitLead(a.publicId, SARAH)
    await submitLead(b.publicId, { ...SARAH, name: 'Someone Typo', phone: '000' })

    const [lead] = demoAllLeads()
    expect(lead.contactName).toBe('Sarah Chen')
    expect(lead.phone).toBe('555-0100')
  })
})

describe('refuses what it should', () => {
  it('rejects an unknown session', async () => {
    const out = await submitLead('does-not-exist', SARAH)
    expect(out.ok).toBe(false)
    expect(!out.ok && out.status).toBe(404)
  })

  it('rejects an analysis that has not finished', async () => {
    const session = await createAnalysisSession({ cookieId: null }) // still STARTED
    const out = await submitLead(session.publicId, SARAH)
    expect(!out.ok && out.status).toBe(409)
    expect(demoAllLeads()).toHaveLength(0)
  })

  it('rejects a missing name, a bad email, and no business', async () => {
    const session = await completedAnalysis(null)
    const out = await submitLead(session.publicId, { name: '', email: 'nope', businessName: '' })
    expect(!out.ok && out.status).toBe(422)
    expect(!out.ok && out.errors).toHaveLength(3)
    expect(demoAllLeads()).toHaveLength(0)
  })

  it('creates nothing when validation fails', async () => {
    const session = await completedAnalysis(null)
    await submitLead(session.publicId, { ...SARAH, email: 'bad' })
    expect(demoAllLeads()).toHaveLength(0)
    expect(demoAllOpportunities()).toHaveLength(0)
    // ...so the visitor can correct it and try again.
    const retry = await submitLead(session.publicId, SARAH)
    expect(retry.ok).toBe(true)
  })

  it('tells the report whether a lead was already submitted', async () => {
    const session = await completedAnalysis(null)
    expect(await hasSubmittedLead(session.publicId)).toBe(false)
    await submitLead(session.publicId, SARAH)
    expect(await hasSubmittedLead(session.publicId)).toBe(true)
  })
})

describe('input handling', () => {
  it('lowercases and trims email', () => {
    expect(normaliseLeadInput({ ...SARAH, email: '  A@B.CO ' }).email).toBe('a@b.co')
  })

  it('caps field lengths rather than storing unbounded text', () => {
    expect(normaliseLeadInput({ ...SARAH, name: 'x'.repeat(500) }).name).toHaveLength(120)
  })

  it('survives garbage instead of throwing', () => {
    expect(() => normaliseLeadInput(null)).not.toThrow()
    expect(() => normaliseLeadInput('string')).not.toThrow()
    expect(validateLeadInput(normaliseLeadInput(null))).toHaveLength(3)
  })

  it('ignores fields that are not part of the form', () => {
    const out = normaliseLeadInput({ ...SARAH, ownerUserId: 'me', firstTouchPartnerId: 'x' })
    expect('ownerUserId' in out).toBe(false)
    expect('firstTouchPartnerId' in out).toBe(false)
  })
})
