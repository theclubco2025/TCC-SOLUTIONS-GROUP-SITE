import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { SiteFooter, SiteHeader } from '@/components/SiteChrome'
import { IMPLEMENTATION_RANGES, type ComplexityBand } from '@/lib/analysis/config'
import { findAnalysisResult } from '@/lib/analysis/results'
import { formatCurrency, formatFigure, type RoiResults } from '@/lib/analysis/roi'
import { findAnalysisSession } from '@/lib/analysis/sessions'
import type { OpportunityRecord } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Your Technology Opportunity Analysis — TCC Solutions Group',
  robots: { index: false, follow: false },
}

const CALENDLY = 'https://calendly.com/tccsolutions2025/30min'

type Props = { params: Promise<{ publicId: string }> }

export default async function ResultsPage({ params }: Props) {
  const { publicId } = await params

  const session = await findAnalysisSession(publicId)
  if (!session) notFound()

  if (session.status === 'STARTED') redirect(`/analyze/${publicId}`)

  if (session.status === 'ANALYZING') return <Working />
  if (session.status === 'FAILED') return <Failed publicId={publicId} />

  const result = await findAnalysisResult(publicId)
  if (!result) return <Failed publicId={publicId} />

  const roi = result.roiResults as RoiResults | null
  const [primary, ...secondary] = result.opportunities

  return (
    <>
      <SiteHeader />

      <main>
        <section className="sec">
          <div className="w">
            <p className="eyebrow">Technology Opportunity Analysis</p>
            <h1>What we found.</h1>
            <p className="lead">{result.businessSummary}</p>
            <p className="lead">{result.technologyEnvironment}</p>
          </div>
        </section>

        {primary && (
          <section className="sec">
            <div className="w">
              <p className="eyebrow">The one we&rsquo;d start with</p>
              <h2>{primary.title}</h2>
              <OpportunityDetail opportunity={primary} detailed />
            </div>
          </section>
        )}

        {secondary.length > 0 && (
          <section className="sec">
            <div className="w">
              <h2>Also worth looking at</h2>
              <div className="grid three">
                {secondary.map((o) => (
                  <div className="cell" key={o.rank}>
                    <p className="num">{o.category}</p>
                    <h3>{o.title}</h3>
                    <p>{o.problem}</p>
                    <p style={{ marginTop: 10 }}>{o.solution}</p>
                    <p className="note" style={{ marginTop: 14 }}>
                      {IMPLEMENTATION_RANGES[o.complexity as ComplexityBand]?.label ?? o.complexity}
                      &nbsp;&middot;&nbsp;
                      {formatCurrency(o.implementationLow)}&ndash;
                      {formatCurrency(o.implementationHigh)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="sec">
          <div className="w">
            <h2>What the numbers say</h2>
            {roi && roi.anyAvailable ? (
              <>
                <p className="lead">
                  Worked out from the figures you gave us. Illustrative opportunity, not a
                  guarantee &mdash; the arithmetic is shown so you can judge it yourself.
                </p>
                <div className="roi">
                  {roi.figures.map((f) => (
                    <div className="roi-row" key={f.id}>
                      <div>
                        <h3>{f.label}</h3>
                        <p className="note">{f.formula}</p>
                        {f.assumptions.map((a) => (
                          <p className="note" key={a}>
                            {a}
                          </p>
                        ))}
                        {!f.available && f.missing.length > 0 && (
                          <p className="note">Needs: {f.missing.join(', ')}.</p>
                        )}
                      </div>
                      <p className={f.available ? 'roi-value' : 'roi-value roi-value-none'}>
                        {formatFigure(f)}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="lead">
                We don&rsquo;t have enough information to calculate anything meaningful here yet.
                That&rsquo;s not a problem &mdash; it&rsquo;s a short conversation. We&rsquo;d
                rather say so than put an invented number in front of you.
              </p>
            )}
          </div>
        </section>

        <section className="sec">
          <div className="w">
            <h2>Our honest read</h2>
            <p className="lead">{result.overallAssessment}</p>
          </div>
        </section>

        <section className="sec">
          <div className="w">
            <p className="eyebrow">Recommended next step</p>
            <h2>Turn this analysis into a plan.</h2>
            <p className="lead">{result.recommendedNextStep}</p>
            <p className="lead">
              Bring this report to a 30-minute conversation. We&rsquo;ll have already read it
              &mdash; you won&rsquo;t be asked these questions again.
            </p>
            <div className="actions">
              <a className="btn btn-primary" href={CALENDLY} target="_blank" rel="noreferrer">
                Book a Technology Strategy Call
              </a>
              <a className="btn btn-ghost" href="/#capabilities">
                See what we do
              </a>
            </div>
            <p className="note" style={{ marginTop: 22 }}>
              No pressure, no jargon, no obligation. Keep this link &mdash; the report stays here.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}

function OpportunityDetail({
  opportunity,
  detailed,
}: {
  opportunity: OpportunityRecord
  detailed?: boolean
}) {
  const band = IMPLEMENTATION_RANGES[opportunity.complexity as ComplexityBand]

  return (
    <>
      <p className="lead">{opportunity.problem}</p>
      <p className="lead">{opportunity.solution}</p>

      <div className="grid three">
        <div className="cell">
          <p className="num">Impact</p>
          <p>{opportunity.impact}</p>
        </div>
        <div className="cell">
          <p className="num">Effort</p>
          <p>
            {band?.label ?? opportunity.complexity}
            <br />
            {formatCurrency(opportunity.implementationLow)}&ndash;
            {formatCurrency(opportunity.implementationHigh)}
          </p>
          <p className="note" style={{ marginTop: 8 }}>
            A planning range, not a quote.
          </p>
        </div>
        <div className="cell">
          <p className="num">What it would take</p>
          <p>
            {opportunity.existingSoftwarePossible
              ? 'Software that already exists may cover this.'
              : 'No off-the-shelf tool fits this cleanly.'}
          </p>
          {opportunity.customDevelopmentPotential && (
            <p style={{ marginTop: 8 }}>Something built around your business would fit better.</p>
          )}
        </div>
      </div>

      {detailed && (
        <p className="note" style={{ marginTop: 24 }}>
          Why we think so &mdash; {opportunity.reasoning} (Confidence:{' '}
          {opportunity.confidence.toLowerCase()}.)
        </p>
      )}
    </>
  )
}

function Working() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="sec">
          <div className="w narrow">
            <p className="eyebrow">Working on it</p>
            <h1>Reading through your answers.</h1>
            <p className="lead">
              This takes a few seconds. Refresh the page in a moment and your report will be here.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}

function Failed({ publicId }: { publicId: string }) {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="sec">
          <div className="w narrow">
            <p className="eyebrow">That didn&rsquo;t work</p>
            <h1>We couldn&rsquo;t finish the analysis.</h1>
            <p className="lead">
              Nothing you entered was lost. You can try again, or skip straight to talking to a
              person &mdash; which was always the better version of this anyway.
            </p>
            <div className="actions">
              <a className="btn btn-primary" href={`/analyze/${publicId}/roi`}>
                Try again
              </a>
              <a className="btn btn-ghost" href={CALENDLY} target="_blank" rel="noreferrer">
                Book a call instead
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
