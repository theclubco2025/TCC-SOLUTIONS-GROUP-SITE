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

export type NavKey = (typeof NAV)[number]['key']

export default function AdminShell({
  active,
  title,
  children,
  flash,
}: {
  active: NavKey
  title: string
  children: ReactNode
  flash?: { ok?: string; error?: string }
}) {
  return (
    <div className="adm">
      <header className="adm-bar">
        <div className="w adm-bar-in">
          <span className="adm-brand">TCCSG &middot; admin</span>
          <nav aria-label="Admin">
            {NAV.map((n) => (
              <a key={n.key} href={n.href} aria-current={n.key === active ? 'page' : undefined}>
                {n.label}
              </a>
            ))}
          </nav>
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

export function Empty({ children }: { children: ReactNode }) {
  return <p className="adm-empty">{children}</p>
}

export function flashFrom(sp: { ok?: string | string[]; error?: string | string[] }) {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  return { ok: one(sp.ok), error: one(sp.error) }
}
