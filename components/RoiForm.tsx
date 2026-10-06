'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import Analyzing from '@/components/Analyzing'
import { ROI_FIELDS, type RoiField } from '@/lib/analysis/config'
import { calculateRoi, formatFigure, normaliseRoiInputs, type RoiFigure } from '@/lib/analysis/roi'
import type { RoiInputs } from '@/lib/types'

const GROUPS: { id: RoiField['group']; title: string; blurb: string; figures: string[] }[] = [
  {
    id: 'time',
    title: 'The repetitive work',
    blurb: 'The thing you said takes up the most time.',
    figures: ['labour', 'time'],
  },
  {
    id: 'customers',
    title: 'Your enquiries',
    blurb: 'How many people get in touch, and how many buy.',
    figures: ['revenue'],
  },
]

/** Which boxes each figure needs, so the hint can name them as the boxes are labelled. */
const NEEDS: Record<string, string[]> = {
  labour: ['hoursPerWeek', 'hourlyValue'],
  time: ['hoursPerWeek'],
  revenue: ['monthlyLeads', 'conversionRate', 'averageCustomerValue'],
}
const SHORT = Object.fromEntries(ROI_FIELDS.map((f) => [f.id, f.short.toLowerCase()]))

/**
 * Optional by design. Skipping is a first-class path, not a failure — the
 * report simply says which numbers it could not work out and why.
 *
 * The figures update as they type, using the same arithmetic the report uses
 * (lib/analysis/roi.ts), so what they see here is what they will see there.
 * Seeing the cost of the problem appear is the reason to fill this in at all.
 */
export default function RoiForm({
  publicId,
  initialInputs,
}: {
  publicId: string
  initialInputs: RoiInputs
}) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(initialInputs)) out[k] = String(v)
    return out
  })
  const [state, setState] = useState<'idle' | 'working' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  // The same normalisation the server applies, so an out-of-range number is
  // ignored here exactly as it will be there.
  const inputs = useMemo(() => normaliseRoiInputs(values), [values])
  const roi = useMemo(() => calculateRoi(inputs), [inputs])
  const anyTyped = Object.keys(inputs).length > 0

  async function submit(withNumbers: boolean) {
    setState('working')
    setMessage(null)

    try {
      const saved = await fetch(`/api/analysis/${publicId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roiInputs: withNumbers ? inputs : {} }),
      })
      if (!saved.ok) {
        setMessage('We could not save those numbers. Please try again.')
        setState('error')
        return
      }

      const res = await fetch(`/api/analysis/${publicId}/complete`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))

      if (!res.ok || !json.ok) {
        setMessage(json.errors?.[0] ?? 'We could not run the analysis. Please try again.')
        setState('error')
        return
      }

      router.push(`/analyze/${publicId}/results`)
    } catch {
      setMessage('We could not reach the server. Please try again.')
      setState('error')
    }
  }

  if (state === 'working') return <Analyzing />

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit(true)
      }}
      noValidate
    >
      <div className="roi-groups">
        {GROUPS.map((group) => (
          <fieldset className="roi-group" key={group.id}>
            <legend className="roi-legend">{group.title}</legend>
            <p>{group.blurb}</p>
            <div className="roi-fields">
              {ROI_FIELDS.filter((f) => f.group === group.id).map((field) => (
                <NumberField
                  key={field.id}
                  field={field}
                  value={values[field.id] ?? ''}
                  onChange={(v) => setValues((p) => ({ ...p, [field.id]: v }))}
                />
              ))}
            </div>
            <div className="roi-out" aria-live="polite">
              {group.figures.map((id) => (
                <Live
                  key={id}
                  figure={roi.figures.find((f) => f.id === id)!}
                  needs={(NEEDS[id] ?? []).filter((k) => inputs[k] === undefined).map((k) => SHORT[k])}
                />
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      {message && (
        <div className="notice" role="alert" style={{ marginTop: 20 }}>
          {message}
        </div>
      )}

      <div className="flow-nav">
        <button className="btn btn-primary" type="submit">
          Build my report
        </button>
        {anyTyped && (
          <button type="button" className="flow-skip" onClick={() => submit(false)}>
            Leave the numbers out
          </button>
        )}
        {!anyTyped && <span className="flow-hint">You can leave these blank.</span>}
      </div>

      <p className="note" style={{ marginTop: 22 }}>
        Every figure in your report shows the numbers it came from. Anything we can&rsquo;t work
        out, we&rsquo;ll say so rather than estimate.
      </p>
    </form>
  )
}

function NumberField({
  field,
  value,
  onChange,
}: {
  field: RoiField
  value: string
  onChange: (v: string) => void
}) {
  const prefix = field.unit === '$' ? '$' : null
  const suffix = field.unit === '%' ? '%' : field.unit === 'hours' ? 'hrs' : null

  return (
    <div className="roi-field">
      <label htmlFor={field.id} title={field.label}>
        {field.short}
      </label>
      <div className={`roi-input${prefix ? ' has-prefix' : ''}${suffix ? ' has-suffix' : ''}`}>
        {prefix && (
          <span className="roi-affix" aria-hidden="true">
            {prefix}
          </span>
        )}
        <input
          id={field.id}
          type="number"
          inputMode="decimal"
          min={field.min}
          max={field.max}
          value={value}
          aria-describedby={field.help ? `${field.id}-help` : undefined}
          aria-label={field.label}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix && (
          <span className="roi-affix roi-affix-end" aria-hidden="true">
            {suffix}
          </span>
        )}
      </div>
      {field.help && (
        <p className="roi-help" id={`${field.id}-help`}>
          {field.help}
        </p>
      )}
    </div>
  )
}

function Live({ figure, needs }: { figure: RoiFigure; needs: string[] }) {
  return (
    <div className="roi-out-row">
      <span>{figure.label}</span>
      {figure.available ? (
        <span className="roi-live">
          <b className="roi-big">{formatFigure(figure)}</b>
          <small>{figure.formula}</small>
        </span>
      ) : (
        <span className="roi-waiting">Needs {needs.join(' + ')}</span>
      )}
    </div>
  )
}
