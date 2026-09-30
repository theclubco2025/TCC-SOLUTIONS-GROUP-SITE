import type { Metadata } from 'next'
import AnalyzeStart from '@/components/AnalyzeStart'
import { SiteFooter, SiteHeader } from '@/components/SiteChrome'
import { isAnalysisAvailable } from '@/lib/analysis/availability'

// Rendered per request rather than baked at build, so the availability check
// above reflects the environment the deployment is actually running in.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Analyze My Business — TCC Solutions Group',
  description:
    'A short look at how your business runs today, where technology may be holding it back, and what fixing it could be worth.',
  alternates: { canonical: '/analyze' },
}

export default function AnalyzeIntroPage() {
  return (
    <>
      <SiteHeader />

      <main>
        <section className="sec">
          <div className="w narrow">
            <p className="eyebrow">Technology Opportunity Analysis</p>
            <h1>Let&rsquo;s find out what your business could be doing differently.</h1>
            <p className="lead">
              Twelve questions about how your business actually runs day to day &mdash; where work
              gets stuck, what you&rsquo;re still doing by hand, what you&rsquo;ve simply gotten
              used to. It takes a few minutes and you can leave and come back.
            </p>
            <p className="lead">
              You don&rsquo;t need to know what technology you need. That&rsquo;s the point of
              asking.
            </p>
            {isAnalysisAvailable() ? (
              <>
                <div className="actions">
                  <AnalyzeStart />
                </div>
                <p className="note" style={{ marginTop: 24 }}>
                  No account, no email required to see your results. If we think there&rsquo;s
                  nothing worth building, the report will say so.
                </p>
              </>
            ) : (
              <>
                <div className="actions">
                  <a
                    className="btn btn-primary"
                    href="https://calendly.com/tccsolutions2025/30min"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Book a Technology Strategy Call
                  </a>
                </div>
                <p className="note" style={{ marginTop: 24 }}>
                  The written analysis is being finished off. Until it&rsquo;s ready, the strategy
                  call covers the same ground with a person instead of a form.
                </p>
              </>
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
