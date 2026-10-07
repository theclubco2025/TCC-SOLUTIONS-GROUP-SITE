'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FLOW, type Question } from '@/lib/analysis/config'
import {
  firstStepMissingRequired,
  hasSuggestion,
  isAnswered,
  minutesLeft,
  missingOnStep,
  resumeStep,
  stepQuestions,
  toggleSuggestion,
} from '@/lib/analysis/flow'
import { noteFor, noticings, suggestionsFor } from '@/lib/analysis/insights'
import type { AnalysisAnswers } from '@/lib/types'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type Value = string | string[] | undefined

const pad = (n: number) => String(n).padStart(2, '0')

/** Long enough to see the card light up, short enough to feel instant. */
const AUTO_ADVANCE_MS = 280

/**
 * One question per screen. The same twelve questions as before, stored the same
 * way — only the experience changed. A long form reads as homework; a sequence of
 * small decisions, most of them a single tap, reads as a conversation. Progress
 * and time left are always visible so nobody wonders how much more there is.
 */
export default function QuestionnaireForm({
  publicId,
  initialAnswers,
}: {
  publicId: string
  initialAnswers: AnalysisAnswers
}) {
  const router = useRouter()
  const [answers, setAnswers] = useState<AnalysisAnswers>(initialAnswers)
  // A returning visitor picks up where they left off, not at question one.
  const [step, setStep] = useState(() => resumeStep(initialAnswers))
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [mac, setMac] = useState(false)

  const url = `/api/analysis/${publicId}`
  const latest = useRef(answers)
  latest.current = answers
  const dirty = useRef(false)
  const queue = useRef<Promise<boolean>>(Promise.resolve(true))
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const mounted = useRef(false)

  const current = FLOW[step]
  const questions = stepQuestions(current)
  const solo = questions.length === 1
  const isLast = step === FLOW.length - 1
  const optional = questions.every((q) => !q.required)
  const typing = questions.some((q) => q.type === 'textarea')

  /**
   * Saves run one after another, so an older save can never land after a newer
   * one and overwrite it. A save with nothing new to send is skipped.
   */
  const save = useCallback((): Promise<boolean> => {
    const run = async () => {
      if (!dirty.current) return true
      dirty.current = false
      setSaveState('saving')
      try {
        const res = await fetch(url, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ answers: latest.current }),
        })
        if (!res.ok) throw new Error(String(res.status))
        setSaveState('saved')
        return true
      } catch {
        dirty.current = true
        setSaveState('error')
        return false
      }
    }
    queue.current = queue.current.then(run, run)
    return queue.current
  }, [url])

  // Debounced autosave while they type, so leaving never loses the work.
  useEffect(() => {
    if (!dirty.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(save, 800)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [answers, save])

  /**
   * Closing the tab (or switching away on a phone, which may never come back)
   * still keeps the last sentence. keepalive lets the request outlive the page;
   * sendBeacon cannot be used because it only sends POST and this route saves
   * on PATCH.
   */
  useEffect(() => {
    const flush = () => {
      if (!dirty.current) return
      dirty.current = false
      fetch(url, {
        method: 'PATCH',
        keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers: latest.current }),
      }).catch(() => {
        dirty.current = true
      })
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [url])

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.userAgent))
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current)
    }
  }, [])

  // A new question takes focus, so a screen reader announces it and the
  // keyboard starts from the top of it. Not on first load: that would jump.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    const top = root.current?.getBoundingClientRect().top ?? 0
    if (top < 0) root.current?.scrollIntoView({ block: 'start' })
    heading.current?.focus({ preventScroll: true })
  }, [step])

  function change(id: string, update: (prev: Value) => Value) {
    dirty.current = true
    setAnswers((prev) => {
      const value = update(prev[id])
      const next = { ...prev }
      if (value === undefined) delete next[id]
      else next[id] = value
      return next
    })
  }

  function cancelAdvance() {
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    advanceTimer.current = null
  }

  function choose(q: Question, option: string) {
    change(q.id, () => option)
    setError(null)
    // A single tap answers a single-choice question; moving on for them is the
    // whole trick. Steps with more than one question wait for Continue, and so
    // does an answer that earns a note: the note is the point of the pause.
    const earnsNote = noteFor(q.id, { ...latest.current, [q.id]: option }) !== null
    if (solo && !earnsNote) {
      cancelAdvance()
      advanceTimer.current = setTimeout(() => nextRef.current(), AUTO_ADVANCE_MS)
    }
  }

  function toggleOption(q: Question, option: string) {
    change(q.id, (prev) => {
      const picked = Array.isArray(prev) ? prev : []
      return picked.includes(option) ? picked.filter((v) => v !== option) : [...picked, option]
    })
    setError(null)
  }

  function tapSuggestion(q: Question, suggestion: string) {
    change(q.id, (prev) =>
      toggleSuggestion(
        typeof prev === 'string' ? prev : '',
        suggestion,
        q.suggestionSeparator,
        q.maxLength,
      ),
    )
    setError(null)
  }

  function focusField(q: Question) {
    const el = document.getElementById(q.id)
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) el.focus()
    else el?.querySelector<HTMLElement>('button')?.focus()
  }

  function next() {
    cancelAdvance()
    if (finishing) return
    const missing = missingOnStep(current, latest.current)
    if (missing.length > 0) {
      const q = missing[0]
      setError(
        q.type === 'select' || q.type === 'multiselect'
          ? 'Pick one to keep going.'
          : solo
            ? 'A few words is plenty. Tap a suggestion if one fits.'
            : `${q.label} is needed so the report has a name on it.`,
      )
      focusField(q)
      return
    }
    setError(null)
    if (isLast) void finish()
    else setStep(step + 1)
  }
  const nextRef = useRef(next)
  nextRef.current = next

  function back() {
    cancelAdvance()
    setError(null)
    setStep((s) => Math.max(0, s - 1))
  }

  async function finish() {
    // Every required answer is checked on its own step, but a returning visitor
    // can arrive past one they never gave. Send them to it rather than to an
    // error from the server.
    const gap = firstStepMissingRequired(latest.current)
    if (gap !== -1) {
      setStep(gap)
      setError('One more answer is needed here before we can build your report.')
      return
    }
    setFinishing(true)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const ok = await save()
    if (!ok) {
      setFinishing(false)
      setError('We could not save your answers. Check your connection and try again.')
      return
    }
    router.push(`/analyze/${publicId}/roi`)
  }

  // Keyboard: Enter continues, number keys pick. Registered once; the handler
  // is read through a ref so it always sees the current step.
  const onKey = (e: KeyboardEvent) => {
    if (e.isComposing || e.altKey || e.defaultPrevented) return
    const target = e.target as HTMLElement
    if (e.key === 'Enter') {
      if (target.tagName === 'TEXTAREA') {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          next()
        }
        return
      }
      // Buttons and links already do their own thing on Enter.
      if (target.closest('button, a, select')) return
      e.preventDefault()
      next()
      return
    }
    if (e.ctrlKey || e.metaKey || target.closest('input, textarea, select, [contenteditable]'))
      return
    if (!solo || !/^[1-9]$/.test(e.key)) return
    const q = questions[0]
    const option = q.options?.[Number(e.key) - 1]
    if (!option) return
    e.preventDefault()
    if (q.type === 'select') choose(q, option)
    else if (q.type === 'multiselect') toggleOption(q, option)
  }
  const keyRef = useRef(onKey)
  keyRef.current = onKey
  useEffect(() => {
    const listener = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  // Starts with a sliver filled: a bar that is already moving feels shorter.
  const progress = ((step + 1) / (FLOW.length + 1)) * 100
  const minutes = minutesLeft(step)
  const unanswered = questions.every((q) => !isAnswered(answers[q.id]))
  const hint = typing ? `${mac ? '⌘' : 'Ctrl'} + Enter to continue` : 'Enter ↵ to continue'

  return (
    <div className="flow-layout">
      <div className="flow" ref={root}>
        <p className="eyebrow">Technology Opportunity Analysis</p>
        <div className="flow-meta">
          <span>
            <b>{pad(step + 1)}</b> / {pad(FLOW.length)}
          </span>
          <span>{isLast ? 'last one' : `about ${minutes} min left`}</span>
        </div>
        <div
          className="flow-track"
          role="progressbar"
          aria-label="Progress through the questions"
          aria-valuemin={1}
          aria-valuemax={FLOW.length}
          aria-valuenow={step + 1}
        >
          <div className="flow-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="flow-step" key={current.id}>
          <h1 className="flow-q" id="flow-q" ref={heading} tabIndex={-1}>
            {current.title ?? questions[0].label}
          </h1>
          {solo && questions[0].help && <p className="flow-help">{questions[0].help}</p>}

          {questions.map((q) => (
            <Control
              key={q.id}
              question={q}
              solo={solo}
              suggestions={suggestionsFor(q, answers)}
              value={answers[q.id]}
              onChoose={(o) => choose(q, o)}
              onToggle={(o) => toggleOption(q, o)}
              onSuggest={(s) => tapSuggestion(q, s)}
              onText={(text) => {
                change(q.id, () => text)
                if (error) setError(null)
              }}
            />
          ))}

          {questions.map((q) => {
            const note = noteFor(q.id, answers)
            return note ? (
              <p className="flow-note" key={`${q.id}:${note}`}>
                {note}
              </p>
            ) : null
          })}

          {error && (
            <p className="flow-error" role="alert">
              {error}
            </p>
          )}

          <div className="flow-nav">
            {step > 0 && (
              <button type="button" className="btn btn-ghost" onClick={back} disabled={finishing}>
                Back
              </button>
            )}
            <span className="spacer" />
            {optional && unanswered && !isLast && (
              <button type="button" className="flow-skip" onClick={next}>
                Skip this one
              </button>
            )}
            <span className="flow-hint" aria-hidden="true">
              {hint}
            </span>
            <button type="button" className="btn btn-primary" onClick={next} disabled={finishing}>
              {finishing ? 'Saving…' : isLast ? 'Finish' : 'Continue'}
            </button>
          </div>
        </div>

        <p className="flow-saved" aria-live="polite">
          {saveState === 'saving' && 'Saving…'}
          {saveState === 'saved' && 'Saved. You can close this and pick up where you left off.'}
          {saveState === 'error' && 'Not saved yet. Check your connection and we will try again.'}
        </p>
      </div>
      <Noticing answers={answers} />
    </div>
  )
}

/**
 * The picture forming as they answer, in their own words. It is what their
 * report will start from, and seeing it build is the reason to keep going.
 */
function Noticing({ answers }: { answers: AnalysisAnswers }) {
  const items = noticings(answers)
  return (
    <aside className="noticing" aria-label="What we are noticing">
      <p className="eyebrow">What we&rsquo;re noticing</p>
      {items.length === 0 ? (
        <p className="noticing-empty">Your answers build a picture here as you go.</p>
      ) : (
        <>
          <ul>
            {items.map((n) => (
              <li key={`${n.label}:${n.text}`}>
                <span className="noticing-label">{n.label}</span>
                <span>{n.text}</span>
              </li>
            ))}
          </ul>
          <p className="noticing-empty">Your report starts from this.</p>
        </>
      )}
    </aside>
  )
}

function Control({
  question: q,
  solo,
  suggestions,
  value,
  onChoose,
  onToggle,
  onSuggest,
  onText,
}: {
  question: Question
  solo: boolean
  /** The question's suggestions, tailored to their industry. */
  suggestions?: string[]
  value: Value
  onChoose: (option: string) => void
  onToggle: (option: string) => void
  onSuggest: (suggestion: string) => void
  onText: (text: string) => void
}) {
  const text = typeof value === 'string' ? value : ''
  const picked = Array.isArray(value) ? value : []
  // Alone on the screen, the heading IS the question; otherwise it gets a label.
  const labelledBy = solo ? 'flow-q' : `${q.id}-label`

  const control = (() => {
    switch (q.type) {
      case 'select':
        return (
          <div className="choice-cards" id={q.id} role="group" aria-labelledby={labelledBy}>
            {q.options?.map((o, i) => (
              <button
                key={o}
                type="button"
                className="choice-card"
                aria-pressed={text === o}
                onClick={() => onChoose(o)}
              >
                {/* Past nine there is no key, but the slot stays so the labels line up. */}
                {solo && (
                  <span className="cc-n" aria-hidden="true">
                    {i < 9 ? i + 1 : ''}
                  </span>
                )}
                <span>{o}</span>
              </button>
            ))}
          </div>
        )

      case 'multiselect':
        return (
          <>
            {!q.help && solo && <p className="flow-help">Pick as many as fit.</p>}
            <div className="chips" id={q.id} role="group" aria-labelledby={labelledBy}>
              {q.options?.map((o) => {
                const on = picked.includes(o)
                return (
                  <button
                    key={o}
                    type="button"
                    className="chip"
                    aria-pressed={on}
                    onClick={() => onToggle(o)}
                  >
                    {o}
                  </button>
                )
              })}
            </div>
          </>
        )

      case 'textarea':
        return (
          <>
            {suggestions && (
              <>
                <p className="chips-label" id={`${q.id}-suggest`}>
                  Tap any that fit, then add your own words
                </p>
                <div className="chips" role="group" aria-labelledby={`${q.id}-suggest`}>
                  {suggestions.map((s) => {
                    const on = hasSuggestion(text, s, q.suggestionSeparator)
                    return (
                      <button
                        key={s}
                        type="button"
                        className="chip"
                        aria-pressed={on}
                        onClick={() => onSuggest(s)}
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
            <textarea
              id={q.id}
              rows={4}
              value={text}
              maxLength={q.maxLength}
              aria-labelledby={labelledBy}
              placeholder={suggestions ? 'Or say it in your own words…' : 'In your own words…'}
              onChange={(e) => onText(e.target.value)}
            />
          </>
        )

      default:
        return (
          <input
            id={q.id}
            type="text"
            value={text}
            maxLength={q.maxLength}
            placeholder={q.placeholder}
            inputMode={q.id === 'website' ? 'url' : undefined}
            autoComplete={
              q.id === 'businessName' ? 'organization' : q.id === 'website' ? 'url' : 'off'
            }
            aria-labelledby={solo ? labelledBy : undefined}
            onChange={(e) => onText(e.target.value)}
          />
        )
    }
  })()

  if (solo) return control

  return (
    <div className="flow-sub">
      <label htmlFor={q.id} id={`${q.id}-label`}>
        {q.label}
        {!q.required && <span className="opt">optional</span>}
      </label>
      {q.help && <p className="flow-help">{q.help}</p>}
      {control}
    </div>
  )
}
