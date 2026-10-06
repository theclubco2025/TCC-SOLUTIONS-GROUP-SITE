import type { Metadata } from 'next'
import AdminShell, { Empty, SectionError, Status } from '@/components/admin/AdminShell'
import { requireAdmin } from '@/lib/admin/auth'
import { fmtDate, searchTerm } from '@/lib/admin/format'
import { searchAll } from '@/lib/admin/queries'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Search', robots: { index: false, follow: false, nocache: true } }

type Props = { searchParams: Promise<{ q?: string | string[] }> }

export default async function AdminSearch({ searchParams }: Props) {
  await requireAdmin()
  const q = searchTerm((await searchParams).q)

  if (!q) {
    return (
      <AdminShell active="search" title="Search">
        <Empty>
          Type at least two characters in the search box: a business, a person, an email, a phone
          number, a partner slug, or the id from a report link.
        </Empty>
      </AdminShell>
    )
  }

  const r = await searchAll(q)
  const total = r.ok
    ? r.data.leads.length + r.data.applications.length + r.data.partners.length + r.data.analyses.length
    : 0

  return (
    <AdminShell active="search" title={`Search: “${q}”`} query={q}>
      {!r.ok ? (
        <SectionError message={r.error} />
      ) : total === 0 ? (
        <Empty>Nothing matches &ldquo;{q}&rdquo;.</Empty>
      ) : (
        <>
          {r.data.leads.length > 0 && (
            <section className="adm-search-group">
              <h2 className="adm-h2">Leads ({r.data.leads.length})</h2>
              <div className="atable-wrap">
                <table className="atable">
                  <tbody>
                    {r.data.leads.map((l) => (
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
                        <td>{l.firstTouchPartner?.name ?? 'Direct'}</td>
                        <td>
                          <Status value={l.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {r.data.applications.length > 0 && (
            <section className="adm-search-group">
              <h2 className="adm-h2">Partner applications ({r.data.applications.length})</h2>
              <div className="atable-wrap">
                <table className="atable">
                  <tbody>
                    {r.data.applications.map((a) => (
                      <tr key={a.id}>
                        <td>{fmtDate(a.createdAt)}</td>
                        <td>
                          <a href={`/masteradmin/applications#${a.id}`}>{a.name}</a>
                          {a.organization && <span className="adm-dim"> — {a.organization}</span>}
                        </td>
                        <td>{a.email}</td>
                        <td>
                          <Status value={a.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {r.data.partners.length > 0 && (
            <section className="adm-search-group">
              <h2 className="adm-h2">Partners ({r.data.partners.length})</h2>
              <div className="atable-wrap">
                <table className="atable">
                  <tbody>
                    {r.data.partners.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <a href={`/masteradmin/partners#${p.slug}`}>{p.name}</a>
                        </td>
                        <td className="adm-dim">/{p.slug}</td>
                        <td>{p.contactEmail ?? '—'}</td>
                        <td>
                          <Status value={p.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {r.data.analyses.length > 0 && (
            <section className="adm-search-group">
              <h2 className="adm-h2">Analyses ({r.data.analyses.length})</h2>
              <div className="atable-wrap">
                <table className="atable">
                  <tbody>
                    {r.data.analyses.map((s) => {
                      const answers = (s.answers ?? {}) as Record<string, unknown>
                      const name = typeof answers.businessName === 'string' ? answers.businessName : '(no name yet)'
                      return (
                        <tr key={s.publicId}>
                          <td>{fmtDate(s.startedAt)}</td>
                          <td>
                            {name}
                            {typeof answers.industry === 'string' && (
                              <>
                                <br />
                                <span className="adm-dim">{answers.industry}</span>
                              </>
                            )}
                          </td>
                          <td>
                            <Status value={s.status} />
                          </td>
                          <td>
                            {s.opportunity ? (
                              <a href={`/masteradmin/leads/${s.opportunity.leadId}`}>Lead</a>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            {s.status === 'COMPLETED' && (
                              <a href={`/analyze/${s.publicId}/results`} target="_blank" rel="noreferrer">
                                Report
                              </a>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </AdminShell>
  )
}
