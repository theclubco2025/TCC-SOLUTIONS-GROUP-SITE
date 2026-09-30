'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ROI_FIELDS } from '@/lib/analysis/config'
import type { RoiInputs } from '@/lib/types'

/**
 * Optional by design. Skipping is a first-class path, not a failure — the
 * report simply says which numbers it could not work out and why.
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

  async function submit(withNumbers: boolean) {
    setState('working')
    setMessage(null)

    const roiInputs: Record<string, number> = {}
    if (withNumbers) {
      for (const field of ROI_FIELDS) {
        const raw = values[field.id]
        if (raw === undefined || raw.trim() === '') continue
        const num = Number(raw)
        if (Number.isFinite(num)) roiInputs[field.id] = num
      }
    }

    try {
      await fetch(`/api/analysis/${publicId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roiInputs }),
      })

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

  const busy = state === 'working'

  return (
    <div className="form">
      {ROI_FIELDS.map((field) => (
        <div className="field" key={field.id}>
          <label htmlFor={field.id}>
            {field.label}
            {field.unit && <span className="opt">{field.unit}</span>}
          </label>
          {field.help && <p className="qhelp">{field.help}</p>}
          <input
            id={field.id}
            type="number"
            inputMode="decimal"
            min={field.min}
            max={field.max}
            value={values[field.id] ?? ''}
            disabled={busy}
            onChange={(e) => setValues((p) => ({ ...p, [field.id]: e.target.value }))}
          />
        </div>
      ))}

      {message && (
        <div className="notice" role="alert">
          {message}
        </div>
      )}

      {busy && (
        <p className="notice" role="status">
          Reading through your answers. This takes a few seconds &mdash; please don&rsquo;t close
          the page.
        </p>
      )}

      <div className="qfoot">
        <button className="btn btn-primary" onClick={() => submit(true)} disabled={busy}>
          {busy ? 'Analysing…' : 'Analyse my business'}
        </button>
        <button className="btn btn-ghost" onClick={() => submit(false)} disabled={busy}>
          Skip this and analyse anyway
        </button>
      </div>

      <p className="note">
        Every figure in your report shows the numbers it came from. Anything we can&rsquo;t work
        out, we&rsquo;ll say so rather than estimate.
      </p>
    </div>
  )
}
