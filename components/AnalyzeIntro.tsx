import type { ReactNode } from 'react'
import AnalyzeStart from '@/components/AnalyzeStart'
import IndustryPeek from '@/components/IndustryPeek'
import { isAnalysisAvailable } from '@/lib/analysis/availability'
import { ALL_QUESTIONS } from '@/lib/analysis/config'
import { minutesLeft } from '@/lib/analysis/flow'

const CALENDLY = 'https://calendly.com/tccsolutions2025/30min'
const INDUSTRIES = ALL_QUESTIONS.find((q) => q.id === 'industry')?.options ?? []

/**
 * The page before the questionnaire, shared by /analyze and /{partner}/analyze.
 * Someone who reads only this page should still leave with something: where
 * businesses like theirs usually lose time, and what a proposal looks like.
 *
 * Nothing here carries a figure. Patterns are described, not counted, and the
 * example shows a process rather than inventing a number.
 */
export default function AnalyzeIntro({ eyebrow, lead }: { eyebrow: string; lead: ReactNode }) {
  const available = isAnalysisAvailable()

  return (
    <>
      <section className="sec">
        <div className="w intro-grid">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1>Let&rsquo;s find out what your business could be doing differently.</h1>
            <p className="lead">{lead}</p>

            <ol className="intro-steps" aria-label="How it works">
              <li>
                <span>Quick questions, most of them one tap</span>
                <span>about {minutesLeft(0)} min</span>
              </li>
              <li>
                <span>A few numbers, if you have them</span>
                <span>optional</span>
              </li>
              <li>
                <span>Your proposals, built from your answers</span>
                <span>about 30 sec</span>
              </li>
            </ol>

            {available ? (
              <>
                <div className="actions">
                  <AnalyzeStart label="Start my analysis" />
                  <a className="btn btn-ghost" href={CALENDLY} target="_blank" rel="noreferrer">
                    Book a call instead
                  </a>
                </div>
                <p className="note" style={{ marginTop: 22 }}>
                  No account and no email needed to see your results. Your answers save as you
                  go, so you can stop and come back.
                </p>
              </>
            ) : (
              <>
                <div className="actions">
                  <a className="btn btn-primary" href={CALENDLY} target="_blank" rel="noreferrer">
                    Book a Technology Strategy Call
                  </a>
                </div>
                <p className="note" style={{ marginTop: 22 }}>
                  The written analysis is being finished off. Until it&rsquo;s ready, the strategy
                  call covers the same ground with a person instead of a form.
                </p>
              </>
            )}
          </div>

          <IndustryPeek industries={INDUSTRIES} canStart={available} />
        </div>
      </section>

      <section className="sec">
        <div className="w">
          <p className="eyebrow">What you get</p>
          <h2>Proposals, not a sales pitch.</h2>
          <p className="lead">
            Two or three ways to fix what slows you down, each showing your process today and with
            the fix in place. Here is part of one.
          </p>
          <SampleProposal />
        </div>
      </section>

      <section className="sec">
        <div className="w">
          <h2>What happens next</h2>
          <div className="grid three">
            <div className="cell">
              <p className="num">01</p>
              <h3>You see it as you answer</h3>
              <p>
                As you go, we show you what we&rsquo;re noticing about how your business runs, and
                what usually fixes it.
              </p>
            </div>
            <div className="cell">
              <p className="num">02</p>
              <h3>You get your proposals</h3>
              <p>
                Starting points for what we&rsquo;d build around how you work, or connect between
                the tools you already pay for. Plus something you can do yourself this week.
              </p>
            </div>
            <div className="cell">
              <p className="num">03</p>
              <h3>We make it yours</h3>
              <p>
                In a conversation we shape the one you choose into exactly what you need. No
                pressure, no jargon, no obligation.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

/** Uses the report's own proposal markup, so the example is the real thing. */
function SampleProposal() {
  return (
    <article className="proposal sample-proposal" aria-label="An example proposal">
      <div className="proposal-top">
        <span className="proposal-n">Example &middot; a caf&eacute;</span>
        <div className="tags">
          <span className="tag tag-size">Quick win</span>
          <span className="tag">Works with what you already use</span>
        </div>
      </div>
      <h3 className="proposal-title">Your phone orders go straight to the kitchen</h3>
      <div className="proc" aria-label="The process today, and with this in place">
        <div className="proc-row">
          <span className="proc-label">Today</span>
          <ol>
            <li>Customer calls</li>
            <li>Order written on a pad</li>
            <li>Typed into the till</li>
            <li>Ticket walked to the kitchen</li>
          </ol>
          <span className="proc-count">4 steps</span>
        </div>
        <div className="proc-row" data-bright>
          <span className="proc-label">With it</span>
          <ol>
            <li>Customer orders online</li>
            <li>Kitchen screen shows it</li>
          </ol>
          <span className="proc-count">2 steps</span>
        </div>
      </div>
      <div className="proposal-questions">
        <p className="eyebrow">What we&rsquo;d work out together</p>
        <ul>
          <li>Do catering orders follow the same path as walk-in orders?</li>
        </ul>
      </div>
    </article>
  )
}
