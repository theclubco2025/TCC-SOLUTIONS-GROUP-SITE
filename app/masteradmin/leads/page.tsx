import type { Metadata } from 'next'
import AdminShell, { Empty, SectionError, flashFrom } from '@/components/admin/AdminShell'
import { requireAdmin } from '@/lib/admin/auth'
import { fmtDate } from '@/lib/admin/format'
import { loadLeads } from '@/lib/admin/queries'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Leads', robots: { index: false, follow: false, nocache: true } }

type Props = { searchParams: Promise<{ ok?: string; error?: string }> }

export default async function AdminLeads({ searchParams }: Props) {
  await requireAdmin()
  const flash = flashFrom(await searchParams)
  const r = await loadLeads()

  return (
    <AdminShell active="leads" title="Leads" flash={flash}>
      {!r.ok ? (
        <SectionError message={r.error} />
      ) : r.data.length === 0 ? (
        <Empty>No leads yet. A lead appears when someone finishes an analysis and asks for a plan.</Empty>
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
              {r.data.map((l) => (
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
                  <td>{l.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  )
}
