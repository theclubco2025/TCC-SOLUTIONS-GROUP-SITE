import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setLeadStatus } from '@/app/masteradmin/actions'
import AdminShell, { Empty, SectionError, Status, flashFrom } from '@/components/admin/AdminShell'
import { requireAdmin } from '@/lib/admin/auth'
import { fmtDate, leadReplyLink } from '@/lib/admin/format'
import { LEAD_STATUSES, loadLead } from '@/lib/admin/queries'
import { QUESTIONNAIRE } from '@/lib/analysis/config'
import { formatCurrency, formatFigure, type RoiResults } from '@/lib/analysis/roi'
import { siteUrl } from '@/lib/attribution'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Lead', robots: { index: false, follow: false, nocache: true } }

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ok?: string; error?: string }>
}

export default async function AdminLeadDetail({ params, searchParams }: Props) {
  await requireAdmin()
  const { id } = await params
  const flash = flashFrom(await searchParams)
  const r = await loadLead(id)

  if (r.ok && r.data === null) notFound()

  return (
    <AdminShell active="leads" title="Lead" flash={flash}>
      <p className="adm-line">
        <a href="/masteradmin/leads">&larr; All leads</a>
      </p>

      {!r.ok || r.data === null ? (
        <SectionError message={r.ok ? 'Not found.' : r.error} />
      ) : (
        (() => {
          const { lead, events, referrals } = r.data
          const latest = lead.opportunities[0]
          const reportUrl = latest?.analysisSession
            ? `${siteUrl()}/analyze/${latest.analysisSession.publicId}/results`
            : null

          return (
            <>
              <section className="adm-card">
                <h2 className="adm-h2">
                  {lead.businessName} <Status value={lead.status} />
                </h2>
                <dl className="adm-dl">
                  <dt>Contact</dt>
                  <dd>{lead.contactName ?? '—'}</dd>
                  <dt>Email</dt>
                  <dd>{lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : '—'}</dd>
                  <dt>Phone</dt>
                  <dd>{lead.phone ?? '—'}</dd>
                  <dt>Website</dt>
                  <dd>{lead.website ?? '—'}</dd>
                  <dt>Received</dt>
                  <dd>{fmtDate(lead.createdAt)}</dd>
                  <dt>Conversation</dt>
                  <dd>
                    {lead.consultationRequestedAt
                      ? `Requested ${fmtDate(lead.consultationRequestedAt)}`
                      : 'Not requested'}
                  </dd>
                  <dt>Sales owner</dt>
                  <dd>{lead.ownerUserId ? lead.ownerUserId : 'Unassigned'}</dd>
                </dl>

                <div className="adm-actions">
                  {lead.email ? (
                    <a
                      className="btn btn-primary"
                      href={leadReplyLink({
                        email: lead.email,
                        contactName: lead.contactName,
                        businessName: lead.businessName,
                        reportUrl,
                      })}
                    >
                      Reply by email
                    </a>
                  ) : (
                    <span className="adm-dim">No email on file to reply to.</span>
                  )}
                  {reportUrl && (
                    <a className="btn btn-ghost" href={reportUrl} target="_blank" rel="noreferrer">
                      Open their report
                    </a>
                  )}
                </div>

                {/* One click per move. Each button is its own form so the status it
                    sets is fixed in the page, and the action still validates it. */}
                <div className="adm-quick" aria-label="Change status">
                  <span className="adm-dim">Move to</span>
                  {LEAD_STATUSES.filter((s) => s !== lead.status).map((s) => (
                    <form action={setLeadStatus} key={s}>
                      <input type="hidden" name="id" value={lead.id} />
                      <input type="hidden" name="status" value={s} />
                      <button className="btn btn-ghost" type="submit">
                        {s.toLowerCase()}
                      </button>
                    </form>
                  ))}
                </div>
              </section>

              <section className="adm-card">
                <h2 className="adm-h2">Who introduced them</h2>
                <dl className="adm-dl">
                  <dt>First touch</dt>
                  <dd>
                    {lead.firstTouchPartner
                      ? `${lead.firstTouchPartner.name} (/${lead.firstTouchPartner.slug})`
                      : 'Direct — no partner'}
                  </dd>
                  <dt>Last touch</dt>
                  <dd>
                    {lead.lastTouchPartner
                      ? `${lead.lastTouchPartner.name} (/${lead.lastTouchPartner.slug})`
                      : 'Direct — no partner'}
                  </dd>
                </dl>
                {referrals.length > 0 && (
                  <table className="atable">
                    <thead>
                      <tr>
                        <th>Recorded</th>
                        <th>Touch</th>
                        <th>Partner</th>
                        <th>Verified</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referrals.map((x) => (
                        <tr key={x.id}>
                          <td>{fmtDate(x.occurredAt)}</td>
                          <td>{x.touchType}</td>
                          <td>{x.partner.name}</td>
                          <td>{x.verifiedAt ? fmtDate(x.verifiedAt) : 'Not yet'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              {lead.opportunities.length === 0 ? (
                <Empty>No opportunities on this lead.</Empty>
              ) : (
                lead.opportunities.map((opp) => {
                  const session = opp.analysisSession
                  const result = session?.result
                  const answers = (session?.answers ?? {}) as Record<string, string | string[]>
                  const roi = result?.roiResults as RoiResults | null | undefined

                  return (
                    <section className="adm-card" key={opp.id}>
                      <h2 className="adm-h2">
                        Opportunity: {opp.name}
                        <span className="adm-tag">{opp.stage.toLowerCase()}</span>
                      </h2>

                      {!session || !result ? (
                        <Empty>The analysis behind this opportunity is not available.</Empty>
                      ) : (
                        <>
                          <h3 className="adm-h3">What the AI concluded</h3>
                          <p>{result.businessSummary}</p>
                          <p>{result.technologyEnvironment}</p>
                          <p>
                            <strong>Honest read:</strong> {result.overallAssessment}
                          </p>
                          <p>
                            <strong>Suggested next step:</strong> {result.recommendedNextStep}
                          </p>

                          <h3 className="adm-h3">Opportunities found</h3>
                          <table className="atable">
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>What</th>
                                <th>Size</th>
                                <th>Existing software?</th>
                                <th>Confidence</th>
                              </tr>
                            </thead>
                            <tbody>
                              {result.opportunities.map((t) => (
                                <tr key={t.id}>
                                  <td>{t.rank}</td>
                                  <td>
                                    <strong>{t.title}</strong>
                                    <br />
                                    <span className="adm-dim">{t.category}</span>
                                    <br />
                                    {t.problem}
                                  </td>
                                  <td>
                                    {t.complexity}
                                    <br />
                                    {formatCurrency(Number(t.implementationLow))}–
                                    {formatCurrency(Number(t.implementationHigh))}
                                  </td>
                                  <td>
                                    {t.existingSoftwarePossible ? 'Possible' : 'No'}
                                    {t.customDevelopmentPotential && <br />}
                                    {t.customDevelopmentPotential && 'Custom fits'}
                                  </td>
                                  <td>{t.confidence}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          <h3 className="adm-h3">The numbers they gave us</h3>
                          {roi && roi.anyAvailable ? (
                            <table className="atable">
                              <tbody>
                                {roi.figures.map((f) => (
                                  <tr key={f.id}>
                                    <td>{f.label}</td>
                                    <td className="adm-dim">{f.available ? f.formula : `Needs: ${f.missing.join(', ')}`}</td>
                                    <td>{formatFigure(f)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <Empty>They did not give enough numbers to work anything out.</Empty>
                          )}

                          <h3 className="adm-h3">Their answers</h3>
                          <dl className="adm-dl adm-answers">
                            {QUESTIONNAIRE.flatMap((s) => s.questions).map((q) => {
                              const v = answers[q.id]
                              if (v === undefined || (Array.isArray(v) && v.length === 0) || v === '') return null
                              return [
                                <dt key={`${q.id}-q`}>{q.label}</dt>,
                                <dd key={`${q.id}-a`}>{Array.isArray(v) ? v.join(', ') : v}</dd>,
                              ]
                            })}
                          </dl>

                          <p className="adm-dim">
                            Analysed {fmtDate(result.generatedAt)} by {result.model}
                            {result.inputTokens != null && ` · ${result.inputTokens} in / ${result.outputTokens} out tokens`}
                          </p>
                        </>
                      )}
                    </section>
                  )
                })
              )}

              <section className="adm-card">
                <h2 className="adm-h2">History</h2>
                {events.length === 0 ? (
                  <Empty>No recorded events.</Empty>
                ) : (
                  <table className="atable">
                    <tbody>
                      {events.map((e) => (
                        <tr key={e.id}>
                          <td>{fmtDate(e.createdAt)}</td>
                          <td>{e.verb}</td>
                          <td className="adm-dim">{e.actorType}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </>
          )
        })()
      )}
    </AdminShell>
  )
}
