'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/**
 * Starts an analysis on an explicit click rather than on page load. A GET that
 * creates a row would mean every crawler and link preview opens a session.
 */
export default function AnalyzeStart({ label = 'Start the analysis' }: { label?: string }) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'starting' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function start() {
    setState('starting')
    setMessage(null)
    try {
      const res = await fetch('/api/analysis', { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setMessage(json.errors?.[0] ?? 'Something went wrong.')
        setState('error')
        return
      }
      router.push(`/analyze/${json.publicId}`)
    } catch {
      setMessage('We could not reach the server. Please try again.')
      setState('error')
    }
  }

  return (
    <>
      <button className="btn btn-primary" onClick={start} disabled={state === 'starting'}>
        {state === 'starting' ? 'Starting…' : label}
      </button>
      {message && (
        <p className="notice" style={{ marginTop: 16 }} role="alert">
          {message}
        </p>
      )}
    </>
  )
}
