import type { ReactNode } from 'react'
import AnalyzeStart from '@/components/AnalyzeStart'
import { isAnalysisAvailable } from '@/lib/analysis/availability'
import { minutesLeft } from '@/lib/analysis/flow'

const CALENDLY = 'https://calendly.com/tccsolutions2025/30min'

/**
 * The page before the questionnaire, shared by /analyze and /{partner}/analyze.
 * Its job is to make starting feel small: how long each part takes, what you
 * get at the end, and an example of it, so the first click is not a leap.
 *
 * The example deliberately carries no dollar figures. It shows how a figure is
 * worked out instead — an invented number on a public page reads as a claim,
 * and the site makes no claims it cannot source.
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
                <span>Your report, written for your business</span>
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

          <SampleReport />
        </div>
      </section>

      <section className="sec">
        <div className="w">
          <h2>What happens next</h2>
          <div className="grid three">
            <div className="cell">
              <p className="num">01</p>
              <h3>We look at how you operate</h3>
              <p>
                Not your tech stack. Your actual day. Where information gets entered twice,
                where customers wait, where a person is doing what a system should.
              </p>
            </div>
            <div className="cell">
              <p className="num">02</p>
              <h3>We tell you what we see</h3>
              <p>
                Including when the answer is that nothing needs building. If there&rsquo;s nothing
                worth doing, the report will say so.
              </p>
            </div>
            <div className="cell">
              <p className="num">03</p>
              <h3>You decide</h3>
              <p>
                No pressure, no jargon, no obligation. If it&rsquo;s worth building, we&rsquo;ll show
                you what it could look like.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function SampleReport() {
  return (
    <aside aria-label="An example of part of a report">
      <p className="eyebrow">Example</p>
      <div className="sample">
        <p className="report-meta">
          Prepared for <strong>a sample caf&eacute;</strong>
        </p>
        <div className="tags">
          <span className="tag tag-size">Quick win</span>
          <span className="tag">Existing software may cover this</span>
        </div>
        <h3>Phone orders go straight to the kitchen screen</h3>
        <p>
          Orders taken by phone are written on a pad, then typed into the till. An order form that
          feeds the till removes the second step and the mistakes that come with it.
        </p>
        <hr />
        <p>How the value is worked out, using your numbers:</p>
        <p className="code-box">
          <span className="cb-prompt">&gt;</span>
          hours a week &times; people &times; cost of an hour &times; 52
        </p>
        <p>Every figure in the report shows its arithmetic like this.</p>
      </div>
    </aside>
  )
}
