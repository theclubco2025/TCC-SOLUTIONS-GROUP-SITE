'use client'

import { useActionState } from 'react'
import { loginAction } from '@/app/masteradmin/actions'

export default function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {})

  return (
    <form action={action} className="form">
      <div className="field">
        <label htmlFor="token">Admin token</label>
        <input
          id="token"
          name="token"
          type="password"
          autoComplete="current-password"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          required
          autoFocus
        />
      </div>

      {state.error && (
        <p className="notice" role="alert">
          {state.error}
        </p>
      )}

      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? 'Checking…' : 'Log in'}
      </button>
    </form>
  )
}
