import { SiteShell } from '@/components/SiteChrome'
import { isAnalysisAvailable } from '@/lib/analysis/availability'

export default function NotFound() {
  return (
    <SiteShell area="analyze" cta={false}>
      <main>
        <section className="sec">
          <div className="w">
            <p className="eyebrow">404</p>
            <h1>That link isn&rsquo;t active.</h1>
            <p className="lead">
              Referral links look like <code>tccsolutionsgroup.com/their-name/analyze</code>. If
              someone sent you here, ask them to check the link &mdash; or come straight to us.
            </p>
            {/* Most people who hit a dead referral link came for the analysis, so
                offer it rather than only the way out. */}
            <div className="actions">
              {isAnalysisAvailable() && (
                <a className="btn btn-primary" href="/analyze">
                  Start the analysis anyway
                </a>
              )}
              <a className={isAnalysisAvailable() ? 'btn btn-ghost' : 'btn btn-primary'} href="/">
                Go to the homepage
              </a>
              <a className="btn btn-ghost" href="/partners">
                About the partner program
              </a>
            </div>
          </div>
        </section>
      </main>
    </SiteShell>
  )
}
