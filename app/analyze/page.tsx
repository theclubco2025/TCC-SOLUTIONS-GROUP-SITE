import type { Metadata } from 'next'
import AnalyzeIntro from '@/components/AnalyzeIntro'
import { SiteShell } from '@/components/SiteChrome'

// Rendered per request rather than baked at build, so the availability check
// in AnalyzeIntro reflects the environment the deployment is actually running in.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Analyze My Business — TCC Solutions Group',
  description:
    'A short look at how your business runs today, where technology may be holding it back, and what fixing it could be worth.',
  alternates: { canonical: '/analyze' },
}

export default function AnalyzeIntroPage() {
  return (
    <SiteShell area="analyze" cta={false}>
      <main>
        <AnalyzeIntro
          eyebrow="Technology Opportunity Analysis"
          lead={
            <>
              A few minutes on how your business actually runs: where work gets stuck, what&rsquo;s
              still done by hand, what you&rsquo;ve simply gotten used to. You don&rsquo;t need to
              know what technology you need. That&rsquo;s the point of asking.
            </>
          }
        />
      </main>
    </SiteShell>
  )
}
