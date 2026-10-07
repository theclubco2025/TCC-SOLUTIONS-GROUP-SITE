import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Analyzing from '@/components/Analyzing'
import LeadForm from '@/components/LeadForm'
import ReportActions from '@/components/ReportActions'
import { SiteShell } from '@/components/SiteChrome'
import type { ComplexityBand } from '@/lib/analysis/config'
import { findAnalysisResult } from '@/lib/analysis/results'
import { formatCurrency, formatFigure, type RoiResults } from '@/lib/analysis/roi'
import { findAnalysisSession } from '@/lib/analysis/sessions'
import { hasSubmittedLead } from '@/lib/sales/leads'
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

  if (session.status === 'ANALYZING') return <Working publicId={publicId} />
  if (session.status === 'FAILED') return <Failed publicId={publicId} />

  const result = await findAnalysisResult(publicId)
  if (!result) return <Failed publicId={publicId} />

  const submitted = await hasSubmittedLead(publicId)
  const answers = session.answers ?? {}
  const text = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '')

  const roi = result.roiResults as RoiResults | null
  const [primary, ...secondary] = result.opportunities
  const quickWins = result.opportunities.filter((o) => o.complexity === 'QUICK_WIN').length
  const hours = roi?.figures.find((f) => f.id === 'time' && f.available)
  const businessName = text(answers.businessName)
  const prepared = (session.completedAt ?? result.generatedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <SiteShell area="report">
      {/* Sections rise in one after another, as the homepage reveals its own. */}
      <main className="report">
        <section className="sec">
          <div className="w">
            <p className="eyebrow">Your Technology Opportunity Analysis</p>
            <h1>Here&rsquo;s what we&rsquo;d build for {businessName || 'you'}.</h1>

            <div className="report-head">
              <p className="report-meta">
                Prepared for <strong>{businessName || 'you'}</strong> by TCC Solutions Group
                &middot; {prepared}
              </p>

              <p className="eyebrow">The bottom line</p>
              <div className="callout bottom-line">
                <p>{result.overallAssessment}</p>
              </div>

              {/* Every figure here is a count of the report itself or a number the
                  visitor's own inputs produced. Nothing is estimated for them. */}
              <div className="report-stats">
                <div className="report-stat">
                  <b>{result.opportunities.length}</b>
                  <span>{result.opportunities.length === 1 ? 'thing' : 'things'} we&rsquo;d fix</span>
                </div>
                <div className="report-stat">
                  <b>{quickWins}</b>
                  <span>{quickWins === 1 ? 'quick win' : 'quick wins'} to start with</span>
                </div>
                <div className="report-stat">
                  {roi?.headline ? (
                    <>
                      <b>{formatCurrency(roi.headline.value)}</b>
                      <span>{roi.headline.label.toLowerCase()}, from your numbers</span>
                    </>
                  ) : hours ? (
                    <>
                      <b>{formatFigure(hours)}</b>
                      <span>a year you could get back, from your numbers</span>
                    </>
                  ) : (
                    <>
                      <b>&ndash;</b>
                      <span>no figures entered</span>
                    </>
                  )}
                </div>
              </div>

              <ReportActions />
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="w">
            <p className="eyebrow">Where you are today</p>
            <p className="lead">{result.businessSummary}</p>
            <p className="lead">{result.technologyEnvironment}</p>
          </div>
        </section>

        {primary && (
          <section className="sec">
            <div className="w">
              <p className="eyebrow">Where we&rsquo;d start</p>
              <h2>{primary.title}</h2>
              <OpportunityTags opportunity={primary} />
              <OpportunityDetail opportunity={primary} />
            </div>
          </section>
        )}

        {secondary.length > 0 && (
          <section className="sec">
            <div className="w">
              <h2>What else we&rsquo;d fix</h2>
              <div className="grid three">
                {secondary.map((o) => (
                  <div className="cell" key={o.rank}>
                    <p className="num">{o.category}</p>
                    <h3>{o.title}</h3>
                    <OpportunityTags opportunity={o} />
                    <p>{o.problem}</p>
                    <p className="cell-fix">{o.solution}</p>
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
                  Worked out from your own figures, with the arithmetic shown. Illustrative, not a
                  guarantee.
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
                You didn&rsquo;t enter figures, so we haven&rsquo;t put numbers on it. We&rsquo;d
                rather work them out with you on a call than guess.
              </p>
            )}
          </div>
        </section>

        <section className="sec" id="plan">
          <div className="w">
            <p className="eyebrow">Your next step</p>
            <h2>Let&rsquo;s build it.</h2>
            <p className="lead">{result.recommendedNextStep}</p>
            <p className="lead" data-print="hide">
              Leave your details and we&rsquo;ll come to a 30-minute call having already read
              this, so you won&rsquo;t be asked these questions again.
            </p>
            <div className="narrow-form">
              <LeadForm
                publicId={publicId}
                initialBusinessName={businessName}
                initialWebsite={text(answers.website)}
                alreadySubmitted={submitted}
              />
            </div>
            <p className="note" style={{ marginTop: 22 }} data-print="hide">
              Keep this link. The report stays here. Prefer to just talk?{' '}
              <a href={CALENDLY} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
                Book a call directly
              </a>
              .
            </p>
          </div>
        </section>
      </main>
    </SiteShell>
  )
}

/**
 * Named for what it is to the owner. The money range behind each band stays
 * in the admin: on the public report it read as a bill before a conversation.
 */
const SIZE: Record<ComplexityBand, string> = {
  QUICK_WIN: 'Quick win',
  WORKFLOW: 'Connected system',
  CUSTOM: 'Built for you',
}

function OpportunityTags({ opportunity }: { opportunity: OpportunityRecord }) {
  return (
    <div className="tags">
      <span className="tag tag-size">
        {SIZE[opportunity.complexity as ComplexityBand] ?? opportunity.complexity}
      </span>
      {opportunity.existingSoftwarePossible && (
        <span className="tag">Works with what you already use</span>
      )}
    </div>
  )
}

/** How TCCSG would do it, in the company's own terms. */
function approach(o: OpportunityRecord): string {
  if (o.customDevelopmentPotential) {
    return 'Built around how you work. A system made for your business can cost less over time than stacking subscriptions that each do part of the job, and it does exactly what you need.'
  }
  if (o.existingSoftwarePossible) {
    return 'Connected to the tools you already use, so information moves on its own instead of being typed in twice.'
  }
  return 'Set up and connected for you, so you are not the one figuring it out.'
}

function OpportunityDetail({ opportunity }: { opportunity: OpportunityRecord }) {
  return (
    <>
      <p className="lead">{opportunity.problem}</p>
      <p className="lead lead-fix">{opportunity.solution}</p>

      <div className="grid three">
        <div className="cell">
          <p className="num">What changes for you</p>
          <p>{opportunity.impact}</p>
        </div>
        <div className="cell">
          <p className="num">How we&rsquo;d do it</p>
          <p>{approach(opportunity)}</p>
        </div>
        <div className="cell">
          <p className="num">Why start here</p>
          <p>{opportunity.reasoning}</p>
        </div>
      </div>
    </>
  )
}

function Working({ publicId }: { publicId: string }) {
  return (
    <SiteShell area="report" cta={false}>
      <main>
        <section className="sec">
          <div className="w narrow">
            <p className="eyebrow">Working on it</p>
            <h1 className="flow-q">Reading through your answers.</h1>
            <Analyzing publicId={publicId} />
          </div>
        </section>
      </main>
    </SiteShell>
  )
}

function Failed({ publicId }: { publicId: string }) {
  return (
    <SiteShell area="report">
      <main>
        <section className="sec">
          <div className="w narrow">
            <p className="eyebrow">That didn&rsquo;t work</p>
            <h1>We couldn&rsquo;t finish the analysis.</h1>
            <p className="lead">
              Nothing you entered was lost. You can try again, or talk it through with a person
              instead.
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
    </SiteShell>
  )
}
