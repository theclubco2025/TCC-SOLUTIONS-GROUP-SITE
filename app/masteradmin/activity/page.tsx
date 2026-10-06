import type { Metadata } from 'next'
import AdminShell, { Empty, SectionError, flashFrom } from '@/components/admin/AdminShell'
import { requireAdmin } from '@/lib/admin/auth'
import { fmtDate } from '@/lib/admin/format'
import { loadActivity } from '@/lib/admin/queries'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Activity', robots: { index: false, follow: false, nocache: true } }

type Props = { searchParams: Promise<{ ok?: string; error?: string }> }

export default async function AdminActivity({ searchParams }: Props) {
  await requireAdmin()
  const flash = flashFrom(await searchParams)
  const r = await loadActivity()

  return (
    <AdminShell active="activity" title="Activity" flash={flash}>
      <p className="adm-dim">The latest 200 recorded events, newest first — including every admin login attempt.</p>
      {!r.ok ? (
        <SectionError message={r.error} />
      ) : r.data.length === 0 ? (
        <Empty>Nothing recorded yet.</Empty>
      ) : (
        <div className="atable-wrap">
          <table className="atable">
            <thead>
              <tr>
                <th>When</th>
                <th>Event</th>
                <th>Subject</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {r.data.map((e) => (
                <tr key={e.id}>
                  <td>{fmtDate(e.createdAt)}</td>
                  <td>{e.verb}</td>
                  <td className="adm-dim">
                    {e.subjectType === 'Lead' ? (
                      <a href={`/masteradmin/leads/${e.subjectId}`}>Lead</a>
                    ) : (
                      e.subjectType
                    )}
                  </td>
                  <td className="adm-dim">{e.actorType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  )
}
