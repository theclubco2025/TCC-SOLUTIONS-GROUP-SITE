import type { ReactNode } from 'react'
import { logoutAction } from '@/app/masteradmin/actions'

/**
 * Chrome for the console. Presentation only — it does NOT check auth. Every
 * page calls requireAdmin() itself, because a layout does not re-run when the
 * visitor navigates client-side and so cannot be the gate.
 */

const NAV = [
  { href: '/masteradmin', label: 'Overview', key: 'overview' },
  { href: '/masteradmin/leads', label: 'Leads', key: 'leads' },
  { href: '/masteradmin/applications', label: 'Applications', key: 'applications' },
  { href: '/masteradmin/partners', label: 'Partners', key: 'partners' },
  { href: '/masteradmin/analyses', label: 'Analyses', key: 'analyses' },
  { href: '/masteradmin/activity', label: 'Activity', key: 'activity' },
] as const

export type NavKey = (typeof NAV)[number]['key'] | 'search'

export default function AdminShell({
  active,
  title,
  children,
  flash,
  query = '',
}: {
  active: NavKey
  title: string
  children: ReactNode
  flash?: { ok?: string; error?: string }
  /** Prefills the search box on the results page. */
  query?: string
}) {
  // data-area="admin" tints the whole console (app/areas.css) so it can never
  // be mistaken for the public site, in a screenshot or in a busy tab bar.
  return (
    <div className="adm" data-area="admin">
      <header className="adm-bar">
        <div className="w adm-bar-in">
          <span className="adm-brand">
            TCCSG &middot; admin<span className="adm-internal">Internal</span>
          </span>
          <nav aria-label="Admin">
            {NAV.map((n) => (
              <a key={n.key} href={n.href} aria-current={n.key === active ? 'page' : undefined}>
                {n.label}
              </a>
            ))}
          </nav>
          {/* A plain GET form: the query lands in the URL, so a search can be
              bookmarked or reloaded, and the page re-checks auth like any other. */}
          <form className="adm-search" action="/masteradmin/search" method="get" role="search">
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search names, emails, businesses"
              aria-label="Search the admin"
              maxLength={100}
            />
          </form>
          <form action={logoutAction}>
            <button className="adm-link" type="submit">
              Log out
            </button>
          </form>
        </div>
      </header>

      <main className="w adm-main">
        <h1 className="adm-h1">{title}</h1>
        {flash?.ok && (
          <p className="adm-flash adm-ok" role="status">
            {flash.ok}
          </p>
        )}
        {flash?.error && (
          <p className="adm-flash adm-bad" role="alert">
            {flash.error}
          </p>
        )}
        {children}
      </main>
    </div>
  )
}

/** One section failing should say so, in place, and leave the rest usable. */
export function SectionError({ message }: { message: string }) {
  return (
    <div className="adm-flash adm-bad" role="alert">
      <strong>This section could not load.</strong>
      <br />
      <code>{message}</code>
    </div>
  )
}

/** A status, coloured by what it means (app/areas.css): blue new, amber in progress, green good, red ended. */
export function Status({ value }: { value: string }) {
  return <span className={`st st-${value}`}>{value.toLowerCase()}</span>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="adm-empty">{children}</p>
}

export function flashFrom(sp: { ok?: string | string[]; error?: string | string[] }) {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  return { ok: one(sp.ok), error: one(sp.error) }
}
