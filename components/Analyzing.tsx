'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

/**
 * What the analysis does, in the order it does it. The first two happen in
 * our code and the rest in one model call, so these are paced on a timer
 * rather than reported live — but each one is genuinely part of the work.
 */
const STAGES = [
  'Reading your answers',
  'Working out the numbers',
  'Checking what software you already have',
  'Weighing each opportunity by effort and payoff',
  'Writing up your report',
]
const STAGE_MS = 4500
const POLL_MS = 4000
/** Past this, say so plainly rather than let the steps imply all is well. */
const SLOW_MS = 75000

/**
 * The wait while the report is written. Twenty seconds of a frozen button
 * feels broken; twenty seconds of visible steps feels like work being done.
 *
 * `poll` is for someone who lands on the results page mid-analysis (a refresh,
 * or a second tab): it re-checks until the report exists, so they never have to
 * be told to refresh.
 */
export default function Analyzing({ poll = false }: { poll?: boolean }) {
  const router = useRouter()
  const [stage, setStage] = useState(0)
  const [slow, setSlow] = useState(false)
  const panel = useRef<HTMLDivElement>(null)

  // It replaces a taller form, which can leave it above the fold. Bring it back.
  useEffect(() => {
    const rect = panel.current?.getBoundingClientRect()
    if (rect && (rect.top < 0 || rect.bottom > window.innerHeight)) {
      panel.current?.scrollIntoView({ block: 'center' })
    }
  }, [])

  useEffect(() => {
    // Stops on the last stage and stays there until the report is ready.
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
    <div className="analyzing" role="status" ref={panel}>
      <div className="analyzing-bar" aria-hidden="true">
        <span />
      </div>
      <p className="analyzing-title">Building your report&hellip;</p>
      <ol aria-hidden="true">
        {STAGES.map((label, i) => {
          const state = i < stage ? 'done' : i === stage ? 'now' : 'next'
          return (
            <li key={label} data-state={state}>
              <i>{state === 'done' ? '✓' : state === 'now' ? '›' : '·'}</i>
              {label}
            </li>
          )
        })}
      </ol>
      <p className="note" style={{ marginTop: 16 }}>
        {slow
          ? 'This is taking longer than it should. Your answers are saved, so you can come back to this page later and the report will be here.'
          : 'Usually 15 to 30 seconds. Please keep this page open.'}
      </p>
    </div>
  )
}
