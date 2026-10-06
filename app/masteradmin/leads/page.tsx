import type { Metadata } from 'next'
import AdminShell, { Empty, SectionError, Status, flashFrom } from '@/components/admin/AdminShell'
import { requireAdmin } from '@/lib/admin/auth'
import { fmtDate } from '@/lib/admin/format'
import { LEAD_STATUSES, type LeadStatusValue, loadLeads } from '@/lib/admin/queries'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Leads', robots: { index: false, follow: false, nocache: true } }

type Props = { searchParams: Promise<{ ok?: string; error?: string; status?: string }> }

export default async function AdminLeads({ searchParams }: Props) {
  await requireAdmin()
  const sp = await searchParams
  const flash = flashFrom(sp)
  // Anything that is not a real status is ignored rather than trusted into a query.
  const status = (LEAD_STATUSES as readonly string[]).includes(sp.status ?? '')
    ? (sp.status as LeadStatusValue)
    : undefined
  const r = await loadLeads(status)
  const total = r.ok ? Object.values(r.data.counts).reduce((a, b) => a + b, 0) : 0

  return (
    <AdminShell active="leads" title="Leads" flash={flash}>
      {r.ok && total > 0 && (
        <nav className="adm-filters" aria-label="Filter by status">
          <a href="/masteradmin/leads" aria-current={status ? undefined : 'true'}>
            All<span>{total}</span>
          </a>
          {LEAD_STATUSES.map((s) => (
            <a
              key={s}
              href={`/masteradmin/leads?status=${s}`}
              aria-current={status === s ? 'true' : undefined}
            >
              {s.toLowerCase()}
              <span>{r.data.counts[s] ?? 0}</span>
            </a>
          ))}
        </nav>
      )}
      {!r.ok ? (
        <SectionError message={r.error} />
      ) : r.data.rows.length === 0 ? (
        <Empty>
          {status
            ? `No leads are ${status.toLowerCase()} right now.`
            : 'No leads yet. A lead appears when someone finishes an analysis and asks for a plan.'}
        </Empty>
      ) : (
        <div className="atable-wrap">
          <table className="atable">
            <thead>
              <tr>
                <th>Received</th>
                <th>Business</th>
                <th>Contact</th>
                <th>Introduced by</th>
                <th>Latest opportunity</th>
                <th>Conversation</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {r.data.rows.map((l) => (
                <tr key={l.id}>
                  <td>{fmtDate(l.createdAt)}</td>
                  <td>
                    <a href={`/masteradmin/leads/${l.id}`}>{l.businessName}</a>
                  </td>
                  <td>
                    {l.contactName ?? '—'}
                    <br />
                    <span className="adm-dim">{l.email}</span>
                  </td>
                  <td>
                    {l.firstTouchPartner?.name ?? 'Direct'}
                    {l.lastTouchPartner && l.lastTouchPartner.slug !== l.firstTouchPartner?.slug && (
                      <>
                        <br />
                        <span className="adm-dim">last: {l.lastTouchPartner.name}</span>
                      </>
                    )}
                  </td>
                  <td>
                    {l.opportunities[0] ? (
                      <>
                        {l.opportunities[0].name}
                        <br />
                        <span className="adm-dim">{l.opportunities[0].stage}</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{l.consultationRequestedAt ? 'Requested' : '—'}</td>
                  <td>
                    <Status value={l.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  )
}
