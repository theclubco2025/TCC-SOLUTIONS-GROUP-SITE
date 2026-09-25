import type { Metadata } from 'next'
import ApplyForm from '@/components/ApplyForm'
import { SiteFooter, SiteHeader } from '@/components/SiteChrome'

export const metadata: Metadata = {
  title: 'Apply — TCCSG Partner Program',
  description: 'Apply to become a TCC Solutions Group referral partner.',
  alternates: { canonical: '/partners/apply' },
}

export default function ApplyPage() {
  return (
    <>
      <SiteHeader />

      <main>
        <section className="sec">
          <div className="w narrow">
            <p className="eyebrow">Partner Program</p>
            <h1>Apply to become a partner.</h1>
            <p className="lead">
              Two fields are required and the rest help us have a better first conversation. It
              takes a minute.
            </p>
            <ApplyForm />
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
