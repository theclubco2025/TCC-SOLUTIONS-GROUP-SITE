'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import {
  ADMIN_COOKIE,
  ADMIN_PATH,
  SESSION_SECONDS,
  adminConfigured,
  requireAdmin,
  signSession,
  tokenMatches,
} from '@/lib/admin/auth'
import { clientIp, recordLogin, tooManyFailures } from '@/lib/admin/throttle'
import { dbOrNull } from '@/lib/db'
import {
  SLUG_PATTERN,
  generateUniquePartnerSlug,
  isReservedSlug,
  slugify,
} from '@/lib/partner-slug'

/**
 * Every mutation in the admin lives here, and every one starts with
 * requireAdmin(). A server action is a public POST endpoint: it can be called
 * without ever rendering the page that contains its button, so the page being
 * protected protects nothing.
 *
 * Failures redirect back with a message in the query string rather than
 * throwing, so the operator sees what went wrong. Messages are fixed strings or
 * database errors shown only to a logged-in admin.
 */

const ORG_SLUG = 'tccsg'

const LEAD_STATUSES = ['NEW', 'ASSIGNED', 'WORKING', 'QUALIFIED', 'DISQUALIFIED', 'CONVERTED'] as const
const APPLICATION_STATUSES = ['NEW', 'CONTACTED', 'APPROVED', 'DECLINED'] as const
const PARTNER_STATUSES = ['PENDING', 'ACTIVE', 'PAUSED', 'TERMINATED'] as const

type LoginState = { error?: string }

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!adminConfigured()) {
    return { error: 'Admin is not configured on this deployment.' }
  }

  const hdrs = await headers()
  const ip = clientIp(hdrs.get('x-forwarded-for'))

  if (await tooManyFailures(ip)) {
    return { error: 'Too many failed attempts. Try again in 15 minutes.' }
  }

  const candidate = String(formData.get('token') ?? '').trim()

  if (!tokenMatches(candidate)) {
    await recordLogin(ip, false)
    // A short fixed delay makes guessing slower without being noticeable to a
    // person who just mistyped.
    await new Promise((r) => setTimeout(r, 500))
    return { error: 'That token is not right.' }
  }

  const jar = await cookies()
  jar.set(ADMIN_COOKIE, signSession(), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: ADMIN_PATH,
    maxAge: SESSION_SECONDS,
  })
  await recordLogin(ip, true)

  redirect(ADMIN_PATH)
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies()
  jar.set(ADMIN_COOKIE, '', { path: ADMIN_PATH, maxAge: 0 })
  redirect(`${ADMIN_PATH}/login`)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function field(formData: FormData, name: string, max = 200): string {
  const v = formData.get(name)
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function back(path: string, kind: 'ok' | 'error', message: string): never {
  redirect(`${path}?${kind}=${encodeURIComponent(message)}`)
}

/**
 * redirect() works by throwing. A catch block that treats every throw as a
 * failure would swallow it and report "NEXT_REDIRECT" as an error, so every
 * catch below hands redirects back first.
 */
function rethrowIfRedirect(e: unknown): void {
  const digest = e && typeof e === 'object' && 'digest' in e ? String((e as { digest: unknown }).digest) : ''
  if (digest.startsWith('NEXT_REDIRECT')) throw e
}

function oneOf<T extends string>(allowed: readonly T[], value: string): T | null {
  return (allowed as readonly string[]).includes(value) ? (value as T) : null
}

async function audit(
  db: NonNullable<ReturnType<typeof dbOrNull>>,
  subjectType: string,
  subjectId: string,
  verb: string,
  payload: object,
) {
  await db.activityEvent.create({
    data: { actorType: 'USER', actorId: 'admin', subjectType, subjectId, verb, payload },
  })
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export async function setLeadStatus(formData: FormData): Promise<void> {
  await requireAdmin()
  const id = field(formData, 'id')
  const status = oneOf(LEAD_STATUSES, field(formData, 'status'))
  const path = `${ADMIN_PATH}/leads/${id}`

  const db = dbOrNull()
  if (!db) back(path, 'error', 'The database is not connected.')
  if (!id || !status) back(path, 'error', 'That status is not valid.')

  try {
    const before = await db.lead.findUnique({ where: { id }, select: { status: true } })
    if (!before) back(ADMIN_PATH + '/leads', 'error', 'Lead not found.')
    await db.lead.update({ where: { id }, data: { status } })
    await audit(db, 'Lead', id, 'lead.status_changed', { from: before.status, to: status })
  } catch (e) {
    rethrowIfRedirect(e)
    back(path, 'error', e instanceof Error ? e.message : 'Could not update the lead.')
  }

  revalidatePath(path)
  back(path, 'ok', `Status set to ${status}.`)
}

// ---------------------------------------------------------------------------
// Partner applications
// ---------------------------------------------------------------------------

export async function setApplicationStatus(formData: FormData): Promise<void> {
  await requireAdmin()
  const id = field(formData, 'id')
  const status = oneOf(APPLICATION_STATUSES, field(formData, 'status'))
  const path = `${ADMIN_PATH}/applications`

  const db = dbOrNull()
  if (!db) back(path, 'error', 'The database is not connected.')
  if (!id || !status) back(path, 'error', 'That status is not valid.')

  try {
    await db.partnerApplication.update({
      where: { id },
      data: { status, reviewedAt: new Date() },
    })
    await audit(db, 'PartnerApplication', id, 'application.status_changed', { to: status })
  } catch (e) {
    rethrowIfRedirect(e)
    back(path, 'error', e instanceof Error ? e.message : 'Could not update the application.')
  }

  revalidatePath(path)
  back(path, 'ok', `Application marked ${status.toLowerCase()}.`)
}

/**
 * Approving is the one place an application becomes a partner. It creates an
 * ACTIVE partner with no commission rate of its own — rates are agreed per
 * partner and written down before they refer anyone, which is a decision for
 * the operator, not a default for this button to invent.
 */
export async function approveApplication(formData: FormData): Promise<void> {
  await requireAdmin()
  const id = field(formData, 'id')
  const path = `${ADMIN_PATH}/applications`

  const db = dbOrNull()
  if (!db) back(path, 'error', 'The database is not connected.')

  let slug = ''
  try {
    const app = await db.partnerApplication.findUnique({ where: { id } })
    if (!app) back(path, 'error', 'Application not found.')
    if (app.partnerId) back(path, 'error', 'This application already has a partner.')

    const org = await db.organization.findUnique({ where: { slug: ORG_SLUG } })
    if (!org) back(path, 'error', 'The TCCSG organization is missing.')

    const name = (app.organization || app.name).trim()
    slug = await generateUniquePartnerSlug(
      name,
      async (s) => (await db.partner.findUnique({ where: { slug: s }, select: { id: true } })) !== null,
    )

    await db.$transaction(async (tx) => {
      const partner = await tx.partner.create({
        data: {
          organizationId: org.id,
          slug,
          name,
          contactName: app.name,
          contactEmail: app.email,
          contactPhone: app.phone,
          status: 'ACTIVE',
          approvedAt: new Date(),
        },
      })
      await tx.partnerApplication.update({
        where: { id },
        data: { status: 'APPROVED', reviewedAt: new Date(), partnerId: partner.id },
      })
      await tx.activityEvent.create({
        data: {
          organizationId: org.id,
          actorType: 'USER',
          actorId: 'admin',
          subjectType: 'Partner',
          subjectId: partner.id,
          verb: 'partner.created_from_application',
          payload: { applicationId: id, slug },
        },
      })
    })
  } catch (e) {
    rethrowIfRedirect(e)
    back(path, 'error', e instanceof Error ? e.message : 'Could not approve the application.')
  }

  revalidatePath(path)
  revalidatePath(`${ADMIN_PATH}/partners`)
  back(`${ADMIN_PATH}/partners`, 'ok', `Partner created. Their link is /${slug}/analyze`)
}

// ---------------------------------------------------------------------------
// Partners
// ---------------------------------------------------------------------------

export async function setPartnerStatus(formData: FormData): Promise<void> {
  await requireAdmin()
  const id = field(formData, 'id')
  const status = oneOf(PARTNER_STATUSES, field(formData, 'status'))
  const path = `${ADMIN_PATH}/partners`

  const db = dbOrNull()
  if (!db) back(path, 'error', 'The database is not connected.')
  if (!id || !status) back(path, 'error', 'That status is not valid.')

  try {
    await db.partner.update({
      where: { id },
      data: { status, approvedAt: status === 'ACTIVE' ? new Date() : undefined },
    })
    await audit(db, 'Partner', id, 'partner.status_changed', { to: status })
  } catch (e) {
    rethrowIfRedirect(e)
    back(path, 'error', e instanceof Error ? e.message : 'Could not update the partner.')
  }

  revalidatePath(path)
  back(path, 'ok', `Partner set to ${status.toLowerCase()}.`)
}

export async function createPartner(formData: FormData): Promise<void> {
  await requireAdmin()
  const path = `${ADMIN_PATH}/partners`

  const name = field(formData, 'name', 160)
  const email = field(formData, 'email', 200).toLowerCase()
  const requested = field(formData, 'slug', 40).toLowerCase()

  const db = dbOrNull()
  if (!db) back(path, 'error', 'The database is not connected.')
  if (name.length < 2) back(path, 'error', 'Give the partner a name.')

  let slug = ''
  try {
    const org = await db.organization.findUnique({ where: { slug: ORG_SLUG } })
    if (!org) back(path, 'error', 'The TCCSG organization is missing.')

    const taken = async (s: string) =>
      (await db.partner.findUnique({ where: { slug: s }, select: { id: true } })) !== null

    if (requested) {
      // A slug somebody typed is used exactly or refused. Quietly changing a
      // link that is about to be printed on a card would be worse than an error.
      if (!SLUG_PATTERN.test(requested)) {
        back(path, 'error', 'A link name is 3–40 letters, numbers or dashes, and cannot start or end with a dash.')
      }
      if (isReservedSlug(requested)) back(path, 'error', `"${requested}" is reserved. Pick another.`)
      if (await taken(requested)) back(path, 'error', `"${requested}" is already taken.`)
      slug = requested
    } else {
      slug = await generateUniquePartnerSlug(slugify(name), taken)
    }

    const partner = await db.partner.create({
      data: {
        organizationId: org.id,
        slug,
        name,
        contactEmail: email || null,
        status: 'ACTIVE',
        approvedAt: new Date(),
      },
    })
    await audit(db, 'Partner', partner.id, 'partner.created', { slug })
  } catch (e) {
    rethrowIfRedirect(e)
    back(path, 'error', e instanceof Error ? e.message : 'Could not create the partner.')
  }

  revalidatePath(path)
  back(path, 'ok', `Partner created. Their link is /${slug}/analyze`)
}
