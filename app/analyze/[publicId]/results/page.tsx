import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Analyzing from '@/components/Analyzing'
import LeadForm from '@/components/LeadForm'
import ReportActions from '@/components/ReportActions'
import { SiteShell } from '@/components/SiteChrome'
import type { ComplexityBand } from '@/lib/analysis/config'
import { terminalLines } from '@/lib/analysis/insights'
import { findAnalysisResult } from '@/lib/analysis/results'
import { calculateRoi, formatCurrency, formatFigure, type RoiResults } from '@/lib/analysis/roi'
import { findAnalysisSession } from '@/lib/analysis/sessions'
import { hasSubmittedLead } from '@/lib/sales/leads'
import type { AnalysisAnswers, OpportunityRecord } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Your Technology Opportunity Analysis — TCC Solutions Group',
  robots: { index: false, follow: false },
}

const CALENDLY = 'https://calendly.com/tccsolutions2025/30min'

type Props = { params: Promise<{ publicId: string }> }

const COUNT_WORD = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six']
const pad = (n: number) => String(n).padStart(2, '0')

export default async function ResultsPage({ params }: Props) {
  const { publicId } = await params

  const session = await findAnalysisSession(publicId)
  if (!session) notFound()

  if (session.status === 'STARTED') redirect(`/analyze/${publicId}`)

  if (session.status === 'ANALYZING') {
    const answers = session.answers ?? {}
    return <Working publicId={publicId} lines={terminalLines(answers, calculateRoi(session.roiInputs))} />
  }
  if (session.status === 'FAILED') return <Failed publicId={publicId} />

  const result = await findAnalysisResult(publicId)
  if (!result) return <Failed publicId={publicId} />

  const submitted = await hasSubmittedLead(publicId)
  const answers: AnalysisAnswers = session.answers ?? {}
  const text = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '')

  const roi = result.roiResults as RoiResults | null
  const proposals = result.opportunities
  const quickWins = proposals.filter((o) => o.complexity === 'QUICK_WIN').length
  const hours = roi?.figures.find((f) => f.id === 'time' && f.available)
  const businessName = text(answers.businessName)
  const startToday = (result.startToday ?? []).slice(0, 2)
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
                  <b>{proposals.length}</b>
                  <span>{proposals.length === 1 ? 'proposal' : 'proposals'} for you</span>
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

        <section className="sec">
          <div className="w">
            <p className="eyebrow">Your proposals</p>
            <h2>
              {COUNT_WORD[proposals.length] ?? proposals.length}{' '}
              {proposals.length === 1 ? 'way' : 'ways'} we could fix this.
            </h2>
            <p className="lead">
              Starting points, built from your answers. Each one becomes exactly what you need in
              a conversation with us.
            </p>
            <div className="proposals">
              {proposals.map((o, i) => (
                <Proposal key={o.rank} opportunity={o} index={i} />
              ))}
            </div>
          </div>
        </section>

        {startToday.length > 0 && (
          <section className="sec">
            <div className="w">
              <p className="eyebrow">Free, this week</p>
              <h2>
                {startToday.length === 1
                  ? 'One thing you can do today.'
                  : 'Two things you can do today.'}
              </h2>
              <p className="lead">No need to wait for us. These are yours either way.</p>
              <ol className="start-today">
                {startToday.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
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
            <p className="eyebrow">Where this goes next</p>
            <h2>These are starting points. Let&rsquo;s make yours.</h2>
            <p className="lead">{result.recommendedNextStep}</p>
            <ol className="next-steps" data-print="hide">
              <li>
                <b>We read this before we talk.</b> You won&rsquo;t be asked these questions again.
              </li>
              <li>
                <b>We walk through your actual day</b> and answer the questions under each proposal.
              </li>
              <li>
                <b>You leave with the one that fits,</b> shaped around how you work. Then we build
                it.
              </li>
            </ol>
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

function Proposal({ opportunity: o, index }: { opportunity: OpportunityRecord; index: number }) {
  const d = o.detail
  return (
    <article className="proposal">
      <div className="proposal-top">
        <span className="proposal-n">Proposal {pad(index + 1)}</span>
        <div className="tags">
          <span className="tag tag-size">
            {SIZE[o.complexity as ComplexityBand] ?? o.complexity}
          </span>
          {o.existingSoftwarePossible && <span className="tag">Works with what you already use</span>}
        </div>
      </div>
      <h3 className="proposal-title">{o.title}</h3>
      <p className="proposal-problem">{o.problem}</p>

      {d && d.today.length > 0 && d.withIt.length > 0 && (
        <div className="proc" aria-label="Your process today, and with this in place">
          <Process label="Today" steps={d.today} />
          <Process label="With it" steps={d.withIt} bright />
        </div>
      )}

      <p className="proposal-fix">{o.solution}</p>

      <div className="grid three">
        <div className="cell">
          <p className="num">A day with it</p>
          <p>{o.impact}</p>
        </div>
        <div className="cell">
          <p className="num">How we&rsquo;d do it</p>
          <p>{approach(o)}</p>
        </div>
        <div className="cell">
          <p className="num">Why this one</p>
          <p>{o.reasoning}</p>
        </div>
      </div>

      {d && d.questions.length > 0 && (
        <div className="proposal-questions">
          <p className="eyebrow">What we&rsquo;d work out together</p>
          <ul>
            {d.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}

function Process({ label, steps, bright }: { label: string; steps: string[]; bright?: boolean }) {
  return (
    <div className="proc-row" data-bright={bright || undefined}>
      <span className="proc-label">{label}</span>
      <ol>
        {steps.map((s, i) => (
          <li key={`${i}:${s}`}>{s}</li>
        ))}
      </ol>
      <span className="proc-count">
        {steps.length} {steps.length === 1 ? 'step' : 'steps'}
      </span>
    </div>
  )
}

function Working({ publicId, lines }: { publicId: string; lines: string[] }) {
  return (
    <SiteShell area="report" cta={false}>
      <main>
        <section className="sec">
          <div className="w narrow">
            <p className="eyebrow">Working on it</p>
            <h1 className="flow-q">Reading through your answers.</h1>
            <Analyzing publicId={publicId} lines={lines} />
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
