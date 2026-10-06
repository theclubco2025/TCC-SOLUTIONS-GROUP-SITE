'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

/**
 * What the analysis does, in the order it does it. The first two happen in
 * our code and the rest in one model call, so these are paced on a timer
 * rather than reported live, but each one is genuinely part of the work.
 */
const STAGES = [
  'reading your answers',
  'working out the numbers',
  'checking the software you already have',
  'weighing each opportunity by effort and payoff',
  'writing up your report',
]
const STAGE_MS = 4500
const POLL_MS = 4000
/** Past this, say so plainly rather than let the lines imply all is well. */
const SLOW_MS = 75000

/**
 * The wait while the report is written, shown in the homepage's terminal box:
 * each step prints as it starts, with the caret on the one running now.
 *
 * `poll` is for someone who lands on the results page mid-analysis (a refresh,
 * or a second tab): it re-checks until the report exists, so they never have to
 * be told to refresh.
 */
export default function Analyzing({ poll = false }: { poll?: boolean }) {
  const router = useRouter()
  const [stage, setStage] = useState(0)
  const [slow, setSlow] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  // It replaces a taller form, which can leave it above the fold. Bring it back.
  useEffect(() => {
    const rect = box.current?.getBoundingClientRect()
    if (rect && (rect.top < 0 || rect.bottom > window.innerHeight)) {
      box.current?.scrollIntoView({ block: 'center' })
    }
  }, [])

  useEffect(() => {
    // Stops on the last step and stays there until the report is ready.
    const id = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), STAGE_MS)
    const late = setTimeout(() => setSlow(true), SLOW_MS)
    return () => {
      clearInterval(id)
      clearTimeout(late)
    }
  }, [])

  useEffect(() => {
    if (!poll) return
    const id = setInterval(() => router.refresh(), POLL_MS)
    return () => clearInterval(id)
  }, [poll, router])

  return (
    <div ref={box}>
      <div className="term" role="status" aria-label="Building your report">
        {STAGES.slice(0, stage + 1).map((label, i) => (
          <div className="term-line" key={label} data-state={i === stage ? 'now' : 'done'}>
            <span className="cb-prompt">&gt;</span>
            <span>{label}</span>
            {i === stage && <span className="term-caret" aria-hidden="true" />}
          </div>
        ))}
      </div>
      <p className="term-note">
        {slow
          ? 'This is taking longer than it should. Your answers are saved, so you can come back to this page later and the report will be here.'
          : 'Usually 15 to 30 seconds. Please keep this page open.'}
      </p>
    </div>
  )
}
