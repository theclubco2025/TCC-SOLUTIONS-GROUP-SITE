import type { ReactNode } from 'react'
import { isAnalysisAvailable } from '@/lib/analysis/availability'

/**
 * Header and footer for app routes. Mirrors the marketing site's chrome so
 * /partners and /{slug}/analyze read as the same site, and repeats the same
 * legal identity block — TCCSG's Twilio compliance profile depends on the
 * registered name, entity number and contact details being consistent on every
 * page a reviewer can reach, not just the homepage.
 *
 * Server-only: the header reads the environment to decide its call to action.
 */

const CALENDLY = 'https://calendly.com/tccsolutions2025/30min'

/**
 * Which part of the site a page belongs to. Drives the single accent colour
 * (app/areas.css) so a visitor can tell the analysis, the report and the partner
 * program apart at a glance — and so the admin never looks like the public site.
 */
export type Area = 'analyze' | 'report' | 'partners'

export function SiteShell({
  area,
  cta = true,
  children,
}: {
  area: Area
  /** Hide the header button where it would only point back at the same page. */
  cta?: boolean
  children: ReactNode
}) {
  return (
    <div data-area={area}>
      <SiteHeader cta={cta} />
      {children}
      <SiteFooter />
    </div>
  )
}

export function SiteHeader({ cta = true }: { cta?: boolean }) {
  const analysis = isAnalysisAvailable()

  return (
    <header className="topbar">
      <div className="w topbar-in">
        <a href="/" aria-label="TCC Solutions Group — home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/tccsg-logo.png" alt="TCCSG — TCC Solutions Group LLC" />
        </a>
        <nav>
          <a className="nav-secondary" href="/#capabilities">
            What We Do
          </a>
          <a href="/partners">Partners</a>
          <a className="nav-secondary" href="/#contact">
            Contact
          </a>
          {cta &&
            (analysis ? (
              <a className="btn btn-primary btn-nav" href="/analyze">
                Analyze my business
              </a>
            ) : (
              <a className="btn btn-primary btn-nav" href={CALENDLY} target="_blank" rel="noreferrer">
                Book a call
              </a>
            ))}
        </nav>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="foot">
      <div className="w">
        <p>
          &copy; 2026 <strong>TCC Solutions Group LLC</strong>
          <br />
          A California limited liability company &middot; CA Entity No. B20260395844
          <br />
          2929 Alder Drive, Camino, CA 95709, United States
          <br />
          tccsolutions2025@gmail.com &middot; +1 530 334 6503
        </p>
        <p style={{ marginTop: 14 }}>
          <a href="/privacy.html">Privacy Policy</a> &middot;{' '}
          <a href="/terms.html">Terms of Use</a> &middot; <a href="/">Home</a>
        </p>
      </div>
    </footer>
  )
}
