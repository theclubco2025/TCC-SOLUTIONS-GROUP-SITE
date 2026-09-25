/**
 * Header and footer for app routes. Mirrors the marketing site's chrome so
 * /partners and /{slug}/analyze read as the same site, and repeats the same
 * legal identity block — TCCSG's Twilio compliance profile depends on the
 * registered name, entity number and contact details being consistent on every
 * page a reviewer can reach, not just the homepage.
 */

export function SiteHeader() {
  return (
    <header className="topbar">
      <div className="w topbar-in">
        <a href="/" aria-label="TCC Solutions Group — home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/tccsg-logo.png" alt="TCCSG — TCC Solutions Group LLC" />
        </a>
        <nav>
          <a href="/#capabilities">What We Do</a>
          <a href="/partners">Partners</a>
          <a href="/#contact">Contact</a>
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
