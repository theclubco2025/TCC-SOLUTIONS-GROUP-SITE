'use client'

import { useState } from 'react'

/**
 * Keep it, share it, act on it. The report lives at its URL, so "copy link" is
 * how an owner shows it to a partner or a bookkeeper; "save as PDF" uses the
 * browser's print dialog with the print styles in app/areas.css.
 */
export default function ReportActions() {
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle')

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied('done')
    } catch {
      setCopied('failed')
    }
    setTimeout(() => setCopied('idle'), 2400)
  }

  return (
    <div className="report-actions" data-print="hide">
      <a className="btn btn-primary" href="#plan">
        Turn this into a plan
      </a>
      <button type="button" className="btn btn-ghost" onClick={copy}>
        {copied === 'done' ? 'Link copied' : copied === 'failed' ? 'Copy from the address bar' : 'Copy link'}
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
        Save as PDF
      </button>
    </div>
  )
}
