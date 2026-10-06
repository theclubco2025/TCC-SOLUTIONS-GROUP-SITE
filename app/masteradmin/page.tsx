import type { Metadata } from 'next'
import AdminShell, { Empty, SectionError, Status, flashFrom } from '@/components/admin/AdminShell'
import { requireAdmin } from '@/lib/admin/auth'
import { fmtDate } from '@/lib/admin/format'
import { loadOverview } from '@/lib/admin/queries'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false, nocache: true } }

type Props = { searchParams: Promise<{ ok?: string; error?: string }> }

export default async function AdminOverview({ searchParams }: Props) {
  await requireAdmin()
  const flash = flashFrom(await searchParams)
  const o = await loadOverview()

  return (
    <AdminShell active="overview" title="Overview" flash={flash}>
      {!o.ok ? (
        <SectionError message={o.error} />
      ) : (
        (() => {
          const d = o.data
          const started = Object.values(d.analyses).reduce((a, b) => a + b, 0)
          const completed = d.analyses.COMPLETED ?? 0
          const failed = d.analyses.FAILED ?? 0

          return (
            <>
              <p className="adm-sub">The funnel, all time</p>
              <div className="adm-funnel">
                <Stat n={d.visits} label="Partner link visits" note={`${d.visits7d} in the last 7 days`} />
                <Stat n={started} label="Analyses started" />
                <Stat n={completed} label="Analyses completed" note={failed ? `${failed} failed` : undefined} />
                <Stat n={d.leads} label="Leads" />
                <Stat n={d.consultations} label="Asked for a conversation" />
              </div>

              <div className="adm-cols">
                <section>
                  <h2 className="adm-h2">Needs a reply</h2>
                  <p className="adm-line">
                    <a href="/masteradmin/applications">{d.newApplications} new partner application{d.newApplications === 1 ? '' : 's'}</a>
                  </p>
                  <p className="adm-line">
                    Partners: {d.partners.ACTIVE ?? 0} active, {d.partners.PAUSED ?? 0} paused,{' '}
                    {d.partners.PENDING ?? 0} pending
                  </p>
                </section>
              </div>

              <h2 className="adm-h2">Latest leads</h2>
              {d.recentLeads.length === 0 ? (
                <Empty>No leads yet.</Empty>
              ) : (
                <table className="atable">
                  <tbody>
                    {d.recentLeads.map((l) => (
                      <tr key={l.id}>
                        <td>{fmtDate(l.createdAt)}</td>
                        <td>
                          <a href={`/masteradmin/leads/${l.id}`}>{l.businessName}</a>
                        </td>
                        <td>{l.contactName ?? '—'}</td>
                        <td>{l.firstTouchPartner?.name ?? 'Direct'}</td>
                        <td>
                          <Status value={l.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <h2 className="adm-h2">Latest partner applications</h2>
              {d.recentApplications.length === 0 ? (
                <Empty>No applications yet.</Empty>
              ) : (
                <table className="atable">
                  <tbody>
                    {d.recentApplications.map((a) => (
                      <tr key={a.id}>
                        <td>{fmtDate(a.createdAt)}</td>
                        <td>{a.name}</td>
                        <td>{a.organization ?? '—'}</td>
                        <td>
                          <Status value={a.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )
        })()
      )}
    </AdminShell>
  )
}

function Stat({ n, label, note }: { n: number; label: string; note?: string }) {
  return (
    <div className="adm-stat">
      <p className="adm-stat-n">{n}</p>
      <p className="adm-stat-l">{label}</p>
      {note && <p className="adm-stat-note">{note}</p>}
    </div>
  )
}
