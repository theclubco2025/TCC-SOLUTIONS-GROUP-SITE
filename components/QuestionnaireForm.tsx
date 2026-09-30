'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { QUESTIONNAIRE, type Question } from '@/lib/analysis/config'
import type { AnalysisAnswers } from '@/lib/types'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function QuestionnaireForm({
  publicId,
  initialAnswers,
}: {
  publicId: string
  initialAnswers: AnalysisAnswers
}) {
  const router = useRouter()
  const [answers, setAnswers] = useState<AnalysisAnswers>(initialAnswers)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [errors, setErrors] = useState<string[]>([])

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(answers)
  latest.current = answers

  const save = useCallback(async () => {
    setSaveState('saving')
    try {
      const res = await fetch(`/api/analysis/${publicId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers: latest.current }),
      })
      setSaveState(res.ok ? 'saved' : 'error')
    } catch {
      setSaveState('error')
    }
  }, [publicId])

  /**
   * Debounced autosave. The promise of this page is that leaving does not lose
   * the work, so the save has to happen while they type — not on submit.
   */
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(save, 800)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [answers, save])

  /** Closing the tab mid-sentence should still keep the sentence. */
  useEffect(() => {
    const flush = () => {
      navigator.sendBeacon?.(
        `/api/analysis/${publicId}`,
        new Blob([JSON.stringify({ answers: latest.current })], { type: 'application/json' }),
      )
    }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [publicId])

  function set(id: string, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  function toggle(id: string, option: string) {
    setAnswers((prev) => {
      const current = Array.isArray(prev[id]) ? (prev[id] as string[]) : []
      const next = current.includes(option)
        ? current.filter((v) => v !== option)
        : [...current, option]
      return { ...prev, [id]: next }
    })
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setErrors([])

    const missing = QUESTIONNAIRE.flatMap((s) => s.questions)
      .filter((q) => q.required)
      .filter((q) => {
        const v = answers[q.id]
        return v === undefined || (typeof v === 'string' && v.trim() === '')
      })

    if (missing.length > 0) {
      setErrors(missing.map((q) => `${q.label} is needed before we can analyse anything.`))
      document.getElementById(missing[0].id)?.focus()
      return
    }

    await save()
    router.push(`/analyze/${publicId}/roi`)
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      {QUESTIONNAIRE.map((section) => (
        <fieldset className="qsection" key={section.id}>
          <legend>{section.title}</legend>
          {section.blurb && <p className="qblurb">{section.blurb}</p>}
          {section.questions.map((q) => (
            <Field
              key={q.id}
              question={q}
              value={answers[q.id]}
              onChange={(v) => set(q.id, v)}
              onToggle={(o) => toggle(q.id, o)}
            />
          ))}
        </fieldset>
      ))}

      {errors.length > 0 && (
        <div className="notice" role="alert">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}

      <div className="qfoot">
        <button className="btn btn-primary" type="submit">
          Continue
        </button>
        <span className="note" aria-live="polite">
          {saveState === 'saving' && 'Saving…'}
          {saveState === 'saved' && 'Saved — you can come back to this'}
          {saveState === 'error' && 'Could not save — check your connection'}
        </span>
      </div>
    </form>
  )
}

function Field({
  question,
  value,
  onChange,
  onToggle,
}: {
  question: Question
  value: string | string[] | undefined
  onChange: (v: string) => void
  onToggle: (option: string) => void
}) {
  const text = typeof value === 'string' ? value : ''
  const picked = Array.isArray(value) ? value : []

  return (
    <div className="field">
      <label htmlFor={question.id}>
        {question.label}
        {!question.required && <span className="opt">optional</span>}
      </label>
      {question.help && <p className="qhelp">{question.help}</p>}

      {question.type === 'text' && (
        <input
          id={question.id}
          type="text"
          value={text}
          maxLength={question.maxLength}
          placeholder={question.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {question.type === 'textarea' && (
        <textarea
          id={question.id}
          rows={3}
          value={text}
          maxLength={question.maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {question.type === 'select' && (
        <select id={question.id} value={text} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose one&hellip;</option>
          {question.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )}

      {question.type === 'multiselect' && (
        <div className="choices" id={question.id}>
          {question.options?.map((o) => (
            <label key={o} className="choice">
              <input type="checkbox" checked={picked.includes(o)} onChange={() => onToggle(o)} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
