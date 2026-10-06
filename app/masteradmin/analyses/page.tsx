import type { Metadata } from 'next'
import AdminShell, { Empty, SectionError, Status, flashFrom } from '@/components/admin/AdminShell'
import { requireAdmin } from '@/lib/admin/auth'
import { fmtDate } from '@/lib/admin/format'
import { loadAnalyses } from '@/lib/admin/queries'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Analyses', robots: { index: false, follow: false, nocache: true } }

type Props = { searchParams: Promise<{ ok?: string; error?: string }> }

export default async function AdminAnalyses({ searchParams }: Props) {
  await requireAdmin()
  const flash = flashFrom(await searchParams)
  const r = await loadAnalyses()

  return (
    <AdminShell active="analyses" title="Analyses" flash={flash}>
      <p className="adm-dim">
        Every analysis, including ones that never became a lead. A failed or abandoned one shows why.
      </p>
      {!r.ok ? (
        <SectionError message={r.error} />
      ) : r.data.length === 0 ? (
        <Empty>No analyses yet.</Empty>
      ) : (
        <div className="atable-wrap">
          <table className="atable">
            <thead>
              <tr>
                <th>Started</th>
                <th>Business</th>
                <th>Status</th>
                <th>Introduced by</th>
                <th>Lead?</th>
                <th>Model use</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {r.data.map((s) => {
                const answers = (s.answers ?? {}) as Record<string, string | string[]>
                const business = typeof answers.businessName === 'string' ? answers.businessName : '—'
                return (
                  <tr key={s.id}>
                    <td>{fmtDate(s.startedAt)}</td>
                    <td>
                      {business}
                      {typeof answers.industry === 'string' && (
                        <>
                          <br />
                          <span className="adm-dim">{answers.industry}</span>
                        </>
                      )}
                    </td>
                    <td>
                      <Status value={s.status} />
                      {s.failureReason && (
                        <>
                          <br />
                          <span className="adm-dim">{s.failureReason}</span>
                        </>
                      )}
                    </td>
                    <td>{s.referralSession?.partner.name ?? 'Direct'}</td>
                    <td>
                      {s.opportunity ? (
                        <a href={`/masteradmin/leads/${s.opportunity.leadId}`}>Yes</a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="adm-dim">
                      {s.result
                        ? `${s.result.inputTokens ?? '?'} in / ${s.result.outputTokens ?? '?'} out`
                        : '—'}
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
      )}
    </AdminShell>
  )
}
