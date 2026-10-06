import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import { notFound } from 'next/navigation'
import AnalyzeIntro from '@/components/AnalyzeIntro'
import { SiteShell } from '@/components/SiteChrome'
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_HEADER,
  findActivePartner,
  recordReferralVisit,
  touchSummary,
} from '@/lib/attribution'
import { isDemoMode } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ partnerSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { partnerSlug } = await params
  const partner = await findActivePartner(partnerSlug)
  if (!partner) return { title: 'Not found' }

  return {
    title: `Technology Analysis — TCC Solutions Group`,
    description:
      'A short look at how your business runs today and where technology may be holding it back.',
    // Partner links are for sharing, not for search. Indexing them would split
    // the same content across every partner slug.
    robots: { index: false, follow: false },
  }
}

export default async function AnalyzePage({ params, searchParams }: Props) {
  const { partnerSlug } = await params
  const query = await searchParams

  const partner = await findActivePartner(partnerSlug)
  if (!partner) notFound()

  // Middleware forwards the id it also wrote to the browser, so a first-ever
  // visitor's session is recorded under the id they actually keep.
  const headerList = await headers()
  const cookieStore = await cookies()
  const cookieId =
    headerList.get(ATTRIBUTION_HEADER) || cookieStore.get(ATTRIBUTION_COOKIE)?.value || null

  const showAttribution = isDemoMode() && query.attribution === '1'

  let touches = null
  if (cookieId) {
    const flat = (k: string) => {
      const v = query[k]
      return Array.isArray(v) ? v[0] : v
    }

    await recordReferralVisit({
      partner,
      cookieId,
      landingPath: `/${partner.slug}/analyze`,
      searchParams: {
        utm_source: flat('utm_source'),
        utm_medium: flat('utm_medium'),
        utm_campaign: flat('utm_campaign'),
        utm_term: flat('utm_term'),
        utm_content: flat('utm_content'),
      },
      referrerUrl: headerList.get('referer'),
      userAgent: headerList.get('user-agent'),
      ip: headerList.get('x-forwarded-for'),
    })

    // Only read the touch history when something will actually render it.
    // This is a joined query on the hot path of every partner link click, and
    // in production the panel below never shows.
    if (showAttribution) touches = await touchSummary(cookieId)
  }

  return (
    <SiteShell area="analyze" cta={false}>
      <main>
        <AnalyzeIntro
          eyebrow={`Introduced by ${partner.name}`}
          lead={
            <>
              {partner.name} thought this was worth your time. A few minutes on how your business
              actually runs: where work gets stuck, what&rsquo;s still done by hand, what
              you&rsquo;ve simply gotten used to. You don&rsquo;t need to know what technology you
              need. That&rsquo;s the point of asking.
            </>
          }
        />

        {/* Opt-in only. A prospect arriving on a partner's link should never see
            a debug panel, so this needs ?attribution=1 as well as demo mode. */}
        {showAttribution && touches && (
          <section className="sec">
            <div className="w">
              <p className="eyebrow">Attribution &mdash; demo mode</p>
              <h2>What the system recorded.</h2>
              <p className="lead">
                Shown only while <code>DATABASE_URL</code> is unset, so the referral chain can be
                verified before a database exists. Setting it hides this panel and makes these
                records permanent.
              </p>
              <p className="note">
                first touch&nbsp;&mdash;{' '}
                {touches.firstTouch
                  ? `${touches.firstTouch.partnerName} (${touches.firstTouch.partnerSlug}) at ${touches.firstTouch.at.toISOString()}`
                  : 'none'}
                <br />
                last touch&nbsp;&mdash;{' '}
                {touches.lastTouch
                  ? `${touches.lastTouch.partnerName} (${touches.lastTouch.partnerSlug}) at ${touches.lastTouch.at.toISOString()}`
                  : 'none'}
                <br />
                visits from this browser&nbsp;&mdash; {touches.visitCount}
              </p>
            </div>
          </section>
        )}
      </main>
    </SiteShell>
  )
}
