'use client'

import { useState } from 'react'

type State = 'idle' | 'sending' | 'sent' | 'error'

export default function ApplyForm() {
  const [state, setState] = useState<State>('idle')
  const [errors, setErrors] = useState<string[]>([])
  const [persisted, setPersisted] = useState(true)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrors([])
    setState('sending')

    const data = Object.fromEntries(new FormData(event.currentTarget).entries())

    try {
      const res = await fetch('/api/partner-applications', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()

      if (!res.ok || !json.ok) {
        setErrors(json.errors ?? ['Something went wrong.'])
        setState('error')
        return
      }

      setPersisted(json.persisted !== false)
      setState('sent')
    } catch {
      setErrors(['We could not reach the server. Please call or email us instead.'])
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <div className="form-done" role="status">
        <h2>Thanks &mdash; that&rsquo;s with us.</h2>
        <p className="lead">
          We read every one of these ourselves. Expect to hear back from a person, not an
          autoresponder.
        </p>
        {!persisted && (
          <p className="notice">
            One thing, honestly: our application system isn&rsquo;t connected to its database yet,
            so this may not have been stored. Please also call{' '}
            <a href="tel:+15303346503">+1 530 334 6503</a> or email{' '}
            <a href="mailto:tccsolutions2025@gmail.com">tccsolutions2025@gmail.com</a> so we
            don&rsquo;t lose you.
          </p>
        )}
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
        <label htmlFor="name">Your name</label>
        <input id="name" name="name" type="text" autoComplete="name" required maxLength={120} />
      </div>

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          maxLength={200}
        />
      </div>

      <div className="field">
        <label htmlFor="phone">
          Phone <span className="opt">optional</span>
        </label>
        <input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={40} />
      </div>

      <div className="field">
        <label htmlFor="organization">
          Business or network <span className="opt">optional</span>
        </label>
        <input id="organization" name="organization" type="text" maxLength={160} />
      </div>

      <div className="field">
        <label htmlFor="audience">
          Who do you work with? <span className="opt">optional</span>
        </label>
        <input
          id="audience"
          name="audience"
          type="text"
          maxLength={300}
          placeholder="Trades, restaurants, a chamber, your clients&hellip;"
        />
      </div>

      <div className="field">
        <label htmlFor="message">
          Anything else <span className="opt">optional</span>
        </label>
        <textarea id="message" name="message" rows={4} maxLength={2000} />
      </div>

      <button className="btn btn-primary" type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Send application'}
      </button>

      <p className="note">
        No obligation, and nothing gets shared. We&rsquo;ll come back to you about the partner
        program and nothing else.
      </p>
    </form>
  )
}
