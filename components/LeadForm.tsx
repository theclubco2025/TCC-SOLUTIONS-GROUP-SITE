'use client'

import { useState } from 'react'

const CALENDLY = 'https://calendly.com/tccsolutions2025/30min'

type Props = {
  publicId: string
  initialBusinessName: string
  initialWebsite: string
  /** The report was already turned into a plan on an earlier visit. */
  alreadySubmitted: boolean
}

type State = 'idle' | 'sending' | 'sent' | 'error'

/**
 * Where an anonymous analysis becomes a person. Nothing is asked for before
 * this point; the report has already been shown in full.
 */
export default function LeadForm({
  publicId,
  initialBusinessName,
  initialWebsite,
  alreadySubmitted,
}: Props) {
  const [state, setState] = useState<State>(alreadySubmitted ? 'sent' : 'idle')
  const [errors, setErrors] = useState<string[]>([])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrors([])
    setState('sending')

    const data = Object.fromEntries(new FormData(event.currentTarget).entries())

    try {
      const res = await fetch(`/api/analysis/${publicId}/lead`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok || !json.ok) {
        setErrors(json.errors ?? ['Something went wrong.'])
        setState('error')
        return
      }
      setState('sent')
    } catch {
      setErrors(['We could not reach the server. Please try again.'])
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <div className="form-done" role="status">
        <p className="lead">
          {alreadySubmitted
            ? 'We already have your details and this report.'
            : 'Got it. We have your details and this report.'}{' '}
          Pick a time that suits you &mdash; we&rsquo;ll have read it before we talk, so you
          won&rsquo;t be asked these questions again.
        </p>
        <div className="actions">
          <a className="btn btn-primary" href={CALENDLY} target="_blank" rel="noreferrer">
            Choose a time
          </a>
        </div>
        <p className="note" style={{ marginTop: 18 }}>
          Choosing a time is what books the call. Until you do, we&rsquo;ll treat this as a request
          and follow up by email.
        </p>
      </div>
    )
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      {errors.length > 0 && (
        <div className="notice" role="alert">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}

      <div className="field">
        <label htmlFor="lead-name">Your name</label>
        <input
          id="lead-name"
          name="name"
          type="text"
          autoComplete="name"
          maxLength={120}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="lead-email">Email</label>
        <input
          id="lead-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          maxLength={200}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="lead-business">Business</label>
        <input
          id="lead-business"
          name="businessName"
          type="text"
          defaultValue={initialBusinessName}
          maxLength={160}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="lead-phone">
          Phone <span className="opt">optional</span>
        </label>
        <input
          id="lead-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          maxLength={40}
        />
      </div>

      <div className="field">
        <label htmlFor="lead-website">
          Website <span className="opt">optional</span>
        </label>
        <input
          id="lead-website"
          name="website"
          type="text"
          defaultValue={initialWebsite}
          maxLength={200}
        />
      </div>

      <button className="btn btn-primary" type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Turn this into a plan'}
      </button>

      <p className="note">
        We&rsquo;ll use this to follow up on this analysis and nothing else. No pressure, no
        jargon, no obligation. See our{' '}
        <a href="/privacy.html" style={{ color: 'inherit' }}>
          privacy policy
        </a>
        .
      </p>
    </form>
  )
}
