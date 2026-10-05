import { Prisma } from '@prisma/client'
import { dbOrNull } from '@/lib/db'
import {
  demoFindLeadByEmail,
  demoFindOpportunityBySession,
  demoFindResult,
  demoId,
  demoInsertLead,
  demoInsertOpportunity,
  demoTouchesForCookie,
  demoUpdateLead,
} from '@/lib/demo-store'
import { isPlausibleEmail } from '@/lib/applications'
import { findAnalysisSession } from '@/lib/analysis/sessions'

/**
 * The bridge from an anonymous analysis to a lead somebody can work.
 *
 * Until this runs, the person is nobody: an analysis session, an unguessable
 * URL, and a cookie. Submitting their details is the moment they become a Lead,
 * and the moment the partner who introduced them has to be written down
 * permanently — because after this point commissions depend on it.
 *
 * Four rules, each of which exists because getting it wrong costs money later:
 *
 * 1. ATTRIBUTION IS READ HERE, FROM THE DATABASE, never from anything the
 *    client sends. The browser supplies only an opaque cookie id; first and last
 *    touch are derived from stored referral sessions.
 * 2. FIRST TOUCH IS WRITE-ONCE. A later partner moves last touch and nothing
 *    else. A partner who made the introduction is still credited months later.
 * 3. ONE PERSON IS ONE LEAD. Matched on lowercased email, so running a second
 *    analysis updates the lead instead of duplicating it.
 * 4. ONE ANALYSIS IS ONE OPPORTUNITY. Submitting twice, or double-clicking,
 *    returns what already exists.
 *
 * Attribution and sales ownership are separate columns. Nothing here assigns an
 * owner: who works a lead is a human decision, not a side effect of a form.
 */

const ORG_SLUG = 'tccsg'

export type LeadInput = {
  name: string
  email: string
  businessName: string
  phone?: string
  website?: string
}

const MAX = { name: 120, email: 200, businessName: 160, phone: 40, website: 200 }

export type SubmitOutcome =
  | { ok: true; leadId: string; created: boolean; alreadySubmitted: boolean }
  | { ok: false; status: 404 | 409 | 422 | 500; errors: string[] }

/** What the client sent, reduced to what we are willing to store. */
export function normaliseLeadInput(raw: unknown): LeadInput {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const text = (k: keyof LeadInput, limit: number) =>
    typeof input[k] === 'string' ? (input[k] as string).trim().slice(0, limit) : ''

  return {
    name: text('name', MAX.name),
    // Lowercased because the one-lead-per-person rule matches on it.
    email: text('email', MAX.email).toLowerCase(),
    businessName: text('businessName', MAX.businessName),
    phone: text('phone', MAX.phone) || undefined,
    website: text('website', MAX.website) || undefined,
  }
}

export function validateLeadInput(input: LeadInput): string[] {
  const errors: string[] = []
  if (input.name.length < 2) errors.push('Please give us a name.')
  if (!isPlausibleEmail(input.email)) errors.push('That email address looks wrong.')
  if (input.businessName.length < 1) errors.push('Please give us the business name.')
  return errors
}

export async function submitLead(publicId: string, raw: unknown): Promise<SubmitOutcome> {
  const session = await findAnalysisSession(publicId)
  if (!session) return { ok: false, status: 404, errors: ['Not found.'] }

  // A lead from an analysis that never finished would carry no assessment for
  // the person who picks it up, which defeats the point of the handoff.
  if (session.status !== 'COMPLETED') {
    return {
      ok: false,
      status: 409,
      errors: ['This analysis has to finish before we can follow up on it.'],
    }
  }

  const input = normaliseLeadInput(raw)
  const errors = validateLeadInput(input)
  if (errors.length > 0) return { ok: false, status: 422, errors }

  try {
    const db = dbOrNull()
    return db
      ? await submitWithDatabase(db, session, input)
      : submitInMemory(session, input)
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'unknown error'
    console.error('[leads] submit failed:', detail)
    return { ok: false, status: 500, errors: ['We could not record that. Please try again.'] }
  }
}

// ---------------------------------------------------------------------------
// In memory (no DATABASE_URL)
// ---------------------------------------------------------------------------

type Session = NonNullable<Awaited<ReturnType<typeof findAnalysisSession>>>

function submitInMemory(session: Session, input: LeadInput): SubmitOutcome {
  const existingOpp = demoFindOpportunityBySession(session.id)
  if (existingOpp) {
    return { ok: true, leadId: existingOpp.leadId, created: false, alreadySubmitted: true }
  }

  const touches = session.cookieId
    ? demoTouchesForCookie(session.cookieId)
    : { first: null, last: null }
  const now = new Date()

  let lead = demoFindLeadByEmail(input.email)
  let created = false

  if (!lead) {
    created = true
    lead = demoInsertLead({
      id: demoId('lead'),
      businessName: input.businessName,
      contactName: input.name,
      email: input.email,
      phone: input.phone ?? null,
      website: input.website ?? null,
      firstTouchPartnerId: touches.first?.partnerId ?? null,
      lastTouchPartnerId: touches.last?.partnerId ?? null,
      ownerUserId: null,
      consultationRequestedAt: now,
      analysisSessionId: session.id,
      createdAt: now,
    })
  } else {
    lead =
      demoUpdateLead(lead.id, {
        contactName: lead.contactName ?? input.name,
        phone: lead.phone ?? input.phone ?? null,
        website: lead.website ?? input.website ?? null,
        // Write-once: only ever filled from empty.
        firstTouchPartnerId: lead.firstTouchPartnerId ?? touches.first?.partnerId ?? null,
        // This is the one that moves.
        lastTouchPartnerId: touches.last?.partnerId ?? lead.lastTouchPartnerId,
        consultationRequestedAt: lead.consultationRequestedAt ?? now,
        analysisSessionId: lead.analysisSessionId ?? session.id,
      }) ?? lead
  }

  const title = demoFindResult(session.publicId)?.opportunities[0]?.title
  demoInsertOpportunity({
    id: demoId('opportunity'),
    leadId: lead.id,
    analysisSessionId: session.id,
    name: title ?? 'Technology opportunity',
    stage: 'DISCOVERY',
    createdAt: now,
  })

  return { ok: true, leadId: lead.id, created, alreadySubmitted: false }
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

type Db = NonNullable<ReturnType<typeof dbOrNull>>

async function submitWithDatabase(
  db: Db,
  session: Session,
  input: LeadInput,
): Promise<SubmitOutcome> {
  // Two simultaneous submissions (a double-click, a retry) can both pass the
  // existence checks and then collide on a unique index. That is the index
  // doing its job; the correct response is to run again and find what won.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await submitOnce(db, session, input)
    } catch (e) {
      const isUniqueRace =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
      if (!isUniqueRace || attempt === 1) throw e
    }
  }
  throw new Error('unreachable')
}

async function submitOnce(db: Db, session: Session, input: LeadInput): Promise<SubmitOutcome> {
  const org = await db.organization.findUnique({ where: { slug: ORG_SLUG } })
  if (!org) throw new Error(`organization "${ORG_SLUG}" is missing — has the seed migration run?`)

  // Already done? Report what exists and change nothing.
  const existingOpp = await db.opportunity.findUnique({
    where: { analysisSessionId: session.id },
    select: { leadId: true },
  })
  if (existingOpp) {
    return { ok: true, leadId: existingOpp.leadId, created: false, alreadySubmitted: true }
  }

  // Attribution, from stored referral sessions only.
  const [first, last] = session.cookieId
    ? await Promise.all([
        db.referralSession.findFirst({
          where: { cookieId: session.cookieId },
          orderBy: { landedAt: 'asc' },
          select: { id: true, partnerId: true },
        }),
        db.referralSession.findFirst({
          where: { cookieId: session.cookieId },
          orderBy: { landedAt: 'desc' },
          select: { id: true, partnerId: true },
        }),
      ])
    : [null, null]

  const primary = await db.technologyOpportunity.findFirst({
    where: { analysisResult: { analysisSessionId: session.id } },
    orderBy: { rank: 'asc' },
    select: { title: true },
  })

  const now = new Date()

  return db.$transaction(async (tx) => {
    const existing = await tx.lead.findFirst({
      where: { organizationId: org.id, email: input.email },
    })

    let leadId: string
    let created = false

    if (!existing) {
      created = true
      const lead = await tx.lead.create({
        data: {
          organizationId: org.id,
          businessName: input.businessName,
          contactName: input.name,
          email: input.email,
          phone: input.phone ?? null,
          website: input.website ?? null,
          analysisSessionId: session.id,
          firstTouchPartnerId: first?.partnerId ?? null,
          lastTouchPartnerId: last?.partnerId ?? null,
          consultationRequestedAt: now,
        },
      })
      leadId = lead.id

      // Append-only: these rows are the permanent record of who introduced whom.
      if (first) {
        await tx.referral.create({
          data: {
            partnerId: first.partnerId,
            leadId,
            referralSessionId: first.id,
            touchType: 'FIRST',
          },
        })
      }
      if (last) {
        await tx.referral.create({
          data: {
            partnerId: last.partnerId,
            leadId,
            referralSessionId: last.id,
            touchType: 'LAST',
          },
        })
      }
    } else {
      leadId = existing.id

      await tx.lead.update({
        where: { id: existing.id },
        data: {
          contactName: existing.contactName ?? input.name,
          phone: existing.phone ?? input.phone ?? null,
          website: existing.website ?? input.website ?? null,
          // Write-once: only ever filled from empty. A later partner never
          // replaces the one who made the introduction.
          firstTouchPartnerId: existing.firstTouchPartnerId ?? first?.partnerId ?? null,
          // The one that moves.
          lastTouchPartnerId: last?.partnerId ?? existing.lastTouchPartnerId,
          consultationRequestedAt: existing.consultationRequestedAt ?? now,
          analysisSessionId: existing.analysisSessionId ?? session.id,
        },
      })

      if (!existing.firstTouchPartnerId && first) {
        await tx.referral.create({
          data: {
            partnerId: first.partnerId,
            leadId,
            referralSessionId: first.id,
            touchType: 'FIRST',
          },
        })
      }
      if (last && last.partnerId !== existing.lastTouchPartnerId) {
        await tx.referral.create({
          data: {
            partnerId: last.partnerId,
            leadId,
            referralSessionId: last.id,
            touchType: 'LAST',
          },
        })
      }
    }

    await tx.opportunity.create({
      data: {
        leadId,
        analysisSessionId: session.id,
        name: primary?.title ?? 'Technology opportunity',
        stage: 'DISCOVERY',
      },
    })

    // Ids only. The audit trail should not become a second copy of the
    // contact details.
    await tx.activityEvent.createMany({
      data: [
        {
          organizationId: org.id,
          actorType: 'VISITOR',
          subjectType: 'Lead',
          subjectId: leadId,
          verb: created ? 'lead.created' : 'lead.matched',
          payload: {
            analysisSessionId: session.id,
            firstTouchPartnerId: first?.partnerId ?? null,
            lastTouchPartnerId: last?.partnerId ?? null,
          },
        },
        {
          organizationId: org.id,
          actorType: 'VISITOR',
          subjectType: 'Lead',
          subjectId: leadId,
          verb: 'consultation.requested',
          payload: { analysisSessionId: session.id },
        },
      ],
    })

    return { ok: true as const, leadId, created, alreadySubmitted: false }
  })
}

// ---------------------------------------------------------------------------

/** Has this analysis already been turned into a lead? Drives what the report shows. */
export async function hasSubmittedLead(publicId: string): Promise<boolean> {
  const session = await findAnalysisSession(publicId)
  if (!session) return false

  const db = dbOrNull()
  if (!db) return demoFindOpportunityBySession(session.id) !== null

  const row = await db.opportunity.findUnique({
    where: { analysisSessionId: session.id },
    select: { id: true },
  })
  return row !== null
}
