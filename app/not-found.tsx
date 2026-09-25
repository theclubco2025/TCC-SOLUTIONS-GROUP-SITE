import { SiteFooter, SiteHeader } from '@/components/SiteChrome'

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="sec">
          <div className="w">
            <p className="eyebrow">404</p>
            <h1>That link isn&rsquo;t active.</h1>
            <p className="lead">
              Referral links look like <code>tccsolutionsgroup.com/their-name/analyze</code>. If
              someone sent you here, ask them to check the link &mdash; or come straight to us.
            </p>
            <div className="actions">
              <a className="btn btn-primary" href="/">
                Go to the homepage
              </a>
              <a className="btn btn-ghost" href="/partners">
                About the partner program
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
