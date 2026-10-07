'use client'

import { useState } from 'react'
import AnalyzeStart from '@/components/AnalyzeStart'
import { guideFor, type Leak } from '@/lib/analysis/industries'

/**
 * Something useful before anyone commits to anything: pick your kind of
 * business and see where businesses like it usually lose time, and what fixes
 * each one. Starting from here carries the pick into the analysis as the first
 * answer, so the questionnaire opens on question two.
 */
export default function IndustryPeek({
  industries,
  canStart,
}: {
  industries: string[]
  /** False when the analysis cannot run on this deployment; the list still teaches. */
  canStart: boolean
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const leaks: Leak[] = picked ? guideFor(picked).leaks : []

  return (
    <aside className="peek" aria-label="What we usually see in businesses like yours">
      <p className="eyebrow">What we usually see</p>
      <p className="peek-q">What kind of business do you run?</p>
      <div className="chips" role="group" aria-label="Your kind of business">
        {industries.map((i) => (
          <button
            key={i}
            type="button"
            className="chip"
            aria-pressed={picked === i}
            onClick={() => setPicked(picked === i ? null : i)}
          >
            {i}
          </button>
        ))}
      </div>

      {picked && (
        <div className="peek-out" key={picked} aria-live="polite">
          <ol className="peek-leaks">
            {leaks.map((l) => (
              <li key={l.problem}>
                <span className="peek-problem">{l.problem}</span>
                <span className="peek-fix">
                  <span className="cb-prompt" aria-hidden="true">
                    &gt;
                  </span>
                  {l.fix}
                </span>
              </li>
            ))}
          </ol>
          {canStart && (
            <div className="peek-start">
              <AnalyzeStart label="See which apply to you" industry={picked} />
              <span className="note">Takes about three minutes. Starts on question two.</span>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
