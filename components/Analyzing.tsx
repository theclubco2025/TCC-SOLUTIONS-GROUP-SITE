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
const READY = 'your report is ready'

const STAGE_MS = 4500
/** Once the report exists, the remaining lines finish quickly rather than make anyone wait. */
const FINISH_MS = 650
const TYPE_MS = 22
const POLL_MS = 3000
/** Past this, say so plainly rather than let the lines imply all is well. */
const SLOW_MS = 75000

/**
 * The wait while the report is written, in the homepage's terminal box. Each
 * step types itself out as it starts, with the caret on the one running now.
 * When the report is ready the last line says so and offers it, so the report
 * is opened by the reader rather than swapped in under them.
 *
 * `ready` comes from the numbers step, which knows when its request returned.
 * Without it (someone who lands on the results page mid-analysis) this polls
 * the status itself.
 */
export default function Analyzing({ publicId, ready = false }: { publicId: string; ready?: boolean }) {
  const router = useRouter()
  const reportUrl = `/analyze/${publicId}/results`
  const [stage, setStage] = useState(0)
  const [done, setDone] = useState(ready)
  const [slow, setSlow] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const cta = useRef<HTMLAnchorElement>(null)

  useEffect(() => setDone((d) => d || ready), [ready])

  // It replaces a taller form, which can leave it above the fold. Bring it back.
  useEffect(() => {
    const rect = box.current?.getBoundingClientRect()
    if (rect && (rect.top < 0 || rect.bottom > window.innerHeight)) {
      box.current?.scrollIntoView({ block: 'center' })
    }
  }, [])

  // While working, step through and hold on the last line. Once done, run the
  // rest out quickly and land on the "ready" line.
  const last = done ? STAGES.length : STAGES.length - 1
  useEffect(() => {
    if (stage >= last) return
    const id = setTimeout(() => setStage((s) => s + 1), done ? FINISH_MS : STAGE_MS)
    return () => clearTimeout(id)
  }, [stage, last, done])

  useEffect(() => {
    if (done) return
    const late = setTimeout(() => setSlow(true), SLOW_MS)
    return () => clearTimeout(late)
  }, [done])

  useEffect(() => {
    if (ready || done) return
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/analysis/${publicId}`, { cache: 'no-store' })
        const json = await res.json()
        if (json.status === 'COMPLETED') setDone(true)
        // A failure has its own page with a way forward.
        if (json.status === 'FAILED') router.refresh()
      } catch {
        // A missed poll is retried on the next tick.
      }
    }, POLL_MS)
    return () => clearInterval(id)
  }, [ready, done, publicId, router])

  useEffect(() => {
    if (done) router.prefetch(reportUrl)
  }, [done, reportUrl, router])

  const lines = [...STAGES, READY].slice(0, stage + 1)
  const atReady = done && stage === STAGES.length

  // The button follows the last line once it has finished typing, not mid-word.
  const [showCta, setShowCta] = useState(false)
  useEffect(() => {
    if (!atReady) return
    const id = setTimeout(() => setShowCta(true), READY.length * TYPE_MS + 200)
    return () => clearTimeout(id)
  }, [atReady])

  useEffect(() => {
    if (showCta) cta.current?.focus({ preventScroll: true })
  }, [showCta])

  return (
    <div ref={box}>
      <div className="term" role="status" aria-label={showCta ? 'Your report is ready' : 'Building your report'}>
        {lines.map((label, i) => (
          <TermLine key={label} text={label} now={i === stage} ready={label === READY} />
        ))}
      </div>

      {showCta ? (
        <div className="term-ready">
          <a className="btn btn-primary" href={reportUrl} ref={cta}>
            View my analysis
          </a>
        </div>
      ) : (
        <p className="term-note">
          {slow
            ? 'This is taking longer than it should. Your answers are saved, so you can come back to this page later and the report will be here.'
            : 'Usually 15 to 30 seconds. Please keep this page open.'}
        </p>
      )}
    </div>
  )
}

/** One line of the terminal. The current line types itself out; earlier ones are already written. */
function TermLine({ text, now, ready }: { text: string; now: boolean; ready: boolean }) {
  const [shown, setShown] = useState(now ? 0 : text.length)

  useEffect(() => {
    if (!now) {
      setShown(text.length)
      return
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(text.length)
      return
    }
    const id = setInterval(() => {
      setShown((n) => {
        if (n >= text.length) {
          clearInterval(id)
          return n
        }
        return n + 1
      })
    }, TYPE_MS)
    return () => clearInterval(id)
  }, [now, text])

  return (
    <div className="term-line" data-state={now ? 'now' : 'done'} data-ready={ready || undefined}>
      <span className="cb-prompt">&gt;</span>
      <span>{text.slice(0, shown)}</span>
      {now && <span className="term-caret" aria-hidden="true" />}
    </div>
  )
}
