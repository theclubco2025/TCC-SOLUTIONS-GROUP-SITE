import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { SiteFooter, SiteHeader } from '@/components/SiteChrome'
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

const CALENDLY = 'https://calendly.com/tccsolutions2025/30min'

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

    touches = await touchSummary(cookieId)
  }

  return (
    <>
      <SiteHeader />

      <main>
        <section className="sec">
          <div className="w">
            <p className="eyebrow">Introduced by {partner.name}</p>
            <h1>Let&rsquo;s find out what your business could be doing differently.</h1>
            <p className="lead">
              {partner.name} thought this was worth your time. It takes a few minutes: some
              questions about how your business actually runs day to day &mdash; where work gets
              stuck, what you&rsquo;re still doing by hand, what you&rsquo;ve simply gotten used
              to.
            </p>
            <p className="lead">
              You don&rsquo;t need to know what technology you need. That&rsquo;s the point of
              asking.
            </p>
            <div className="actions">
              <a className="btn btn-primary" href={CALENDLY} target="_blank" rel="noreferrer">
                Book a Technology Strategy Call
              </a>
              <a className="btn btn-ghost" href="/#capabilities">
                See what we do
              </a>
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="w">
            <h2>What happens next</h2>
            <div className="grid three">
              <div className="cell">
                <p className="num">01</p>
                <h3>We look at how you operate</h3>
                <p>
                  Not your tech stack &mdash; your actual day. Where information gets entered
                  twice, where customers wait, where a person is doing what a system should.
                </p>
              </div>
              <div className="cell">
                <p className="num">02</p>
                <h3>We tell you what we see</h3>
                <p>
                  Including when the answer is that nothing needs building. If there&rsquo;s
                  nothing worth doing, we&rsquo;ll say so.
                </p>
              </div>
              <div className="cell">
                <p className="num">03</p>
                <h3>You decide</h3>
                <p>
                  No pressure, no technology jargon, no obligation. If it&rsquo;s worth building,
                  we&rsquo;ll show you what it could look like.
                </p>
              </div>
            </div>
            <p className="note" style={{ marginTop: 26 }}>
              The full analysis is being built now. In the meantime the strategy call covers the
              same ground, with a person instead of a form.
            </p>
          </div>
        </section>

        {/* Opt-in only. A prospect arriving on a partner's link should never see
            a debug panel, so this needs ?attribution=1 as well as demo mode. */}
        {isDemoMode() && touches && query.attribution === '1' && (
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

      <SiteFooter />
    </>
  )
}
