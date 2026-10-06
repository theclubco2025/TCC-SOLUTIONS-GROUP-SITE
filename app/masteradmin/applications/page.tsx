import type { Metadata } from 'next'
import { approveApplication, setApplicationStatus } from '@/app/masteradmin/actions'
import AdminShell, { Empty, SectionError, Status, flashFrom } from '@/components/admin/AdminShell'
import { requireAdmin } from '@/lib/admin/auth'
import { applicationReplyLink, fmtDate } from '@/lib/admin/format'
import { loadApplications } from '@/lib/admin/queries'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Applications', robots: { index: false, follow: false, nocache: true } }

type Props = { searchParams: Promise<{ ok?: string; error?: string }> }

export default async function AdminApplications({ searchParams }: Props) {
  await requireAdmin()
  const flash = flashFrom(await searchParams)
  const r = await loadApplications()

  return (
    <AdminShell active="applications" title="Partner applications" flash={flash}>
      {!r.ok ? (
        <SectionError message={r.error} />
      ) : r.data.length === 0 ? (
        <Empty>No applications yet.</Empty>
      ) : (
        r.data.map((a) => (
          <section className="adm-card" key={a.id} id={a.id}>
            <h2 className="adm-h2">
              {a.name}
              {a.organization && <span className="adm-dim"> — {a.organization}</span>}
              <Status value={a.status} />
            </h2>
            <dl className="adm-dl">
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${a.email}`}>{a.email}</a>
              </dd>
              <dt>Phone</dt>
              <dd>{a.phone ?? '—'}</dd>
              <dt>Works with</dt>
              <dd>{a.audience ?? '—'}</dd>
              <dt>Message</dt>
              <dd>{a.message ?? '—'}</dd>
              <dt>Received</dt>
              <dd>{fmtDate(a.createdAt)}</dd>
            </dl>

            <div className="adm-actions">
              <a
                className="btn btn-primary"
                href={applicationReplyLink({ email: a.email, name: a.name, organization: a.organization })}
              >
                Reply by email
              </a>

              {a.partnerId ? (
                <a className="btn btn-ghost" href="/masteradmin/partners">
                  Already a partner
                </a>
              ) : (
                <form action={approveApplication}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="btn btn-ghost" type="submit">
                    Approve &amp; create partner
                  </button>
                </form>
              )}

              {a.status !== 'CONTACTED' && a.status !== 'APPROVED' && (
                <form action={setApplicationStatus}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="status" value="CONTACTED" />
                  <button className="btn btn-ghost" type="submit">
                    Mark contacted
                  </button>
                </form>
              )}

              {a.status !== 'DECLINED' && !a.partnerId && (
                <form action={setApplicationStatus}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="status" value="DECLINED" />
                  <button className="btn btn-ghost" type="submit">
                    Decline
                  </button>
                </form>
              )}
            </div>
          </section>
        ))
      )}
    </AdminShell>
  )
}
