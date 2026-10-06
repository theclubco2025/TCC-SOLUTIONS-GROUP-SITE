import type { Metadata } from 'next'
import { createPartner, setPartnerStatus } from '@/app/masteradmin/actions'
import AdminShell, { Empty, SectionError, Status, flashFrom } from '@/components/admin/AdminShell'
import { requireAdmin } from '@/lib/admin/auth'
import { fmtDate } from '@/lib/admin/format'
import { loadPartners } from '@/lib/admin/queries'
import { referralLinkFor } from '@/lib/attribution'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Partners', robots: { index: false, follow: false, nocache: true } }

type Props = { searchParams: Promise<{ ok?: string; error?: string }> }

export default async function AdminPartners({ searchParams }: Props) {
  await requireAdmin()
  const flash = flashFrom(await searchParams)
  const r = await loadPartners()

  return (
    <AdminShell active="partners" title="Partners" flash={flash}>
      <section className="adm-card">
        <h2 className="adm-h2">Add a partner</h2>
        <form action={createPartner} className="adm-form">
          <div className="field">
            <label htmlFor="p-name">Name</label>
            <input id="p-name" name="name" type="text" maxLength={160} required />
          </div>
          <div className="field">
            <label htmlFor="p-email">
              Email <span className="opt">optional</span>
            </label>
            <input id="p-email" name="email" type="email" maxLength={200} />
          </div>
          <div className="field">
            <label htmlFor="p-slug">
              Link name <span className="opt">optional — made from the name if blank</span>
            </label>
            <input id="p-slug" name="slug" type="text" maxLength={40} placeholder="el-dorado-network" />
          </div>
          <button className="btn btn-primary" type="submit">
            Create partner
          </button>
        </form>
        <p className="adm-dim">
          New partners are active immediately and carry no commission rate of their own — agree and
          write that down before they refer anyone.
        </p>
      </section>

      {!r.ok ? (
        <SectionError message={r.error} />
      ) : r.data.length === 0 ? (
        <Empty>No partners yet.</Empty>
      ) : (
        <div className="atable-wrap">
          <table className="atable">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Referral link</th>
                <th>Visits</th>
                <th>Leads (first / last)</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {r.data.map((p) => (
                <tr key={p.id} id={p.slug}>
                  <td>
                    {p.name}
                    <br />
                    <span className="adm-dim">
                      {p.contactEmail ?? 'no email'} · added {fmtDate(p.createdAt)}
                    </span>
                  </td>
                  <td>
                    <code>{referralLinkFor(p.slug)}</code>
                  </td>
                  <td>{p._count.referralSessions}</td>
                  <td>
                    {p._count.firstTouchLeads} / {p._count.lastTouchLeads}
                  </td>
                  <td>
                    <Status value={p.status} />
                  </td>
                  <td>
                    <form action={setPartnerStatus} className="adm-inline">
                      <input type="hidden" name="id" value={p.id} />
                      <input
                        type="hidden"
                        name="status"
                        value={p.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'}
                      />
                      <button className="btn btn-ghost" type="submit">
                        {p.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                      </button>
                    </form>
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
