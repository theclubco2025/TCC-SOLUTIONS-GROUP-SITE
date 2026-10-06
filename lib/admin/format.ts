/**
 * Small pure helpers for the admin. Kept out of the components so the
 * parts that can silently go wrong — a malformed reply link — can be tested.
 */

const ZONE = 'America/Los_Angeles'

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-US', {
    timeZone: ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function fmtShortDate(d: Date | string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { timeZone: ZONE, month: 'short', day: 'numeric' })
}

/**
 * A mailto: link that opens the operator's own mail client with the reply
 * already started. There is deliberately no sending infrastructure behind the
 * admin: replying is a human act from a real inbox, which is also what the
 * recipient expects from a person.
 *
 * encodeURIComponent, not encodeURI: it escapes & ? = # and newlines, any of
 * which would otherwise cut the body off or inject another header.
 */
export function mailto(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to).replace(/%40/g, '@')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function firstName(full: string | null | undefined): string {
  const first = (full ?? '').trim().split(/\s+/)[0]
  return first || 'there'
}

export function leadReplyLink(opts: {
  email: string
  contactName: string | null
  businessName: string
  reportUrl: string | null
}): string {
  const lines = [
    `Hi ${firstName(opts.contactName)},`,
    '',
    `Thanks for running the analysis on ${opts.businessName}. I've read it and `,
    ...(opts.reportUrl ? ['', `Your report: ${opts.reportUrl}`] : []),
    '',
  ]
  // The first sentence is left unfinished on purpose: the operator completes it.
  return mailto(opts.email, `Your technology analysis — ${opts.businessName}`, lines.join('\n'))
}

export function applicationReplyLink(opts: { email: string; name: string; organization: string | null }): string {
  const body = [
    `Hi ${firstName(opts.name)},`,
    '',
    `Thanks for applying to the TCCSG partner program${opts.organization ? ` on behalf of ${opts.organization}` : ''}. `,
    '',
  ].join('\n')
  return mailto(opts.email, 'Your TCCSG partner application', body)
}

/** Trimmed and capped, so a pasted paragraph is not sent to four queries. Too short to mean anything is empty. */
export function searchTerm(raw: string | string[] | undefined): string {
  const one = Array.isArray(raw) ? raw[0] : raw
  const q = (one ?? '').trim().slice(0, 100)
  return q.length >= 2 ? q : ''
}
