import type { Metadata } from 'next'
import { SiteFooter, SiteHeader } from '@/components/SiteChrome'
import { siteUrl } from '@/lib/attribution'

export const metadata: Metadata = {
  title: 'Partner Program — TCC Solutions Group',
  description:
    'Introduce a business owner to TCCSG. We handle the conversation, the work and the follow-through, and you are credited for the introduction.',
  alternates: { canonical: '/partners' },
}

const CALENDLY = 'https://calendly.com/tccsolutions2025/30min'
const APPLY_MAILTO =
  'mailto:tccsolutions2025@gmail.com?subject=TCCSG%20Partner%20Program&body=Name%3A%0ABusiness%20or%20network%3A%0APhone%3A%0AWho%20you%20work%20with%3A%0A'

export default function PartnersPage() {
  const exampleLink = `${siteUrl().replace(/^https?:\/\//, '')}/your-network/analyze`

  return (
    <>
      <SiteHeader />

      <main>
        <section className="sec">
          <div className="w">
            <p className="eyebrow">Partner Program</p>
            <h1>Introduce a business. We&rsquo;ll take it from there.</h1>
            <p className="lead">
              You already know business owners who are being left behind by technology. You
              probably hear about it. Send them to us and we&rsquo;ll do the rest &mdash; the
              conversation, the work, and the follow-through. You&rsquo;re credited for the
              introduction for as long as that relationship lasts.
            </p>
            <div className="actions">
              <a className="btn btn-primary" href={APPLY_MAILTO}>
                Apply to become a partner
              </a>
              <a className="btn btn-ghost" href={CALENDLY} target="_blank" rel="noreferrer">
                Talk it through first
              </a>
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="w">
            <h2>Who this is for</h2>
            <p className="lead">
              People who are already trusted by business owners. Business networks and chambers.
              Accountants and bookkeepers. Consultants. Trades who work alongside other trades.
              Anyone whose name carries weight in a room.
            </p>
            <p className="lead">
              You don&rsquo;t need to understand the technology. You don&rsquo;t need to diagnose
              anything or sell anything. Knowing who&rsquo;s frustrated is the whole job.
            </p>
          </div>
        </section>

        <section className="sec">
          <div className="w">
            <p className="eyebrow">How it works</p>
            <h2>Four steps, and only one of them is yours.</h2>

            <div className="grid four">
              <div className="cell">
                <p className="num">01</p>
                <h3>You get a link</h3>
                <p>
                  Your own referral link and a QR code. Copy it, share it, print it. Nothing to
                  install and no tracking codes to paste anywhere.
                </p>
              </div>
              <div className="cell">
                <p className="num">02</p>
                <h3>They run the analysis</h3>
                <p>
                  The business owner answers some questions about how their business actually
                  runs. They get something useful out of it whether or not they ever hire us.
                </p>
              </div>
              <div className="cell">
                <p className="num">03</p>
                <h3>We take the conversation</h3>
                <p>
                  Someone from TCCSG works the introduction from there. You don&rsquo;t quote,
                  scope, chase or explain anything technical.
                </p>
              </div>
              <div className="cell">
                <p className="num">04</p>
                <h3>You&rsquo;re paid on closed work</h3>
                <p>
                  Commission when the business becomes a customer. Your rate is agreed with you
                  up front and written down before you refer anyone.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="w">
            <h2>Your link is the whole system.</h2>
            <p className="lead">
              One address. Everything a business owner does from there stays connected to your
              name.
            </p>
            <p className="code-box">
              <span className="cb-prompt">&rsaquo;</span>
              <span>{exampleLink}</span>
            </p>
            <p className="note" style={{ marginTop: 18 }}>
              The introduction is recorded the moment someone opens it &mdash; not when they fill
              something in, and not when they finally sign.
            </p>
          </div>
        </section>

        <section className="sec">
          <div className="w">
            <h2>The part most referral programs get wrong.</h2>

            <div className="grid three">
              <div className="cell">
                <h3>Your introduction doesn&rsquo;t expire</h3>
                <p>
                  Business owners take months to decide. If someone comes through your link and
                  signs half a year later, that&rsquo;s still your introduction. We record who was
                  first and it isn&rsquo;t overwritten by whoever happened to be last.
                </p>
              </div>
              <div className="cell">
                <h3>You can see what happened</h3>
                <p>
                  Who came through your link, how far they got, and what became of them. No
                  asking us for a status update and no spreadsheet on either side.
                </p>
              </div>
              <div className="cell">
                <h3>We don&rsquo;t work your network</h3>
                <p>
                  We contact the person you introduced about the thing you introduced them for.
                  We don&rsquo;t mine your referrals for a list to market to.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="w">
            <h2>We&rsquo;d rather protect your name than close a deal.</h2>
            <p className="lead">
              You&rsquo;re lending us your credibility, and that&rsquo;s worth more to us than any
              one project. If there&rsquo;s nothing worth building for the person you send us,
              we&rsquo;ll tell them so &mdash; and tell you the same thing.
            </p>
            <p className="lead">No pressure, no jargon, no obligation. That applies to them and to you.</p>
            <div className="actions">
              <a className="btn btn-primary" href={APPLY_MAILTO}>
                Apply to become a partner
              </a>
              <a className="btn btn-ghost" href={CALENDLY} target="_blank" rel="noreferrer">
                Book a 30-minute call
              </a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
