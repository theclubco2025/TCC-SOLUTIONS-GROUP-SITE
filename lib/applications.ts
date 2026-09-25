import { dbOrNull } from '@/lib/db'
import { demoId } from '@/lib/demo-store'

/**
 * Partner applications.
 *
 * `persisted` is returned honestly rather than assumed: in demo mode there is
 * no database, so an application is accepted and then lost when the serverless
 * instance recycles. The form tells the applicant that in plain words instead
 * of showing a success screen that isn't true.
 */

export type ApplicationInput = {
  name: string
  organization?: string
  email: string
  phone?: string
  audience?: string
  message?: string
  sourcePath?: string
  referrerUrl?: string
}

export type ApplicationResult = { id: string; persisted: boolean }

const MAX = { name: 120, organization: 160, email: 200, phone: 40, audience: 300, message: 2000 }

/** Deliberately permissive — this rejects typos, not unusual addresses. */
export function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

export function validateApplication(input: Partial<ApplicationInput>): string[] {
  const errors: string[] = []
  if (!input.name || input.name.trim().length < 2) errors.push('Please give us a name.')
  if (!input.email || !isPlausibleEmail(input.email)) errors.push('That email address looks wrong.')

  for (const [field, limit] of Object.entries(MAX)) {
    const value = (input as Record<string, unknown>)[field]
    if (typeof value === 'string' && value.length > limit) {
      errors.push(`${field} is too long (max ${limit} characters).`)
    }
  }

  return errors
}

export async function createApplication(input: ApplicationInput): Promise<ApplicationResult> {
  const trim = (v?: string) => {
    const s = v?.trim()
    return s ? s : null
  }

  const db = dbOrNull()
  if (!db) {
    return { id: demoId('application'), persisted: false }
  }

  const row = await db.partnerApplication.create({
    data: {
      name: input.name.trim(),
      organization: trim(input.organization),
      email: input.email.trim().toLowerCase(),
      phone: trim(input.phone),
      audience: trim(input.audience),
      message: trim(input.message),
      sourcePath: trim(input.sourcePath),
      referrerUrl: trim(input.referrerUrl),
    },
  })

  await db.activityEvent.create({
    data: {
      actorType: 'VISITOR',
      subjectType: 'PartnerApplication',
      subjectId: row.id,
      verb: 'application.submitted',
      payload: { email: row.email, organization: row.organization },
    },
  })

  return { id: row.id, persisted: true }
}
