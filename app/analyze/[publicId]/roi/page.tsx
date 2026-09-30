import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import RoiForm from '@/components/RoiForm'
import { SiteFooter, SiteHeader } from '@/components/SiteChrome'
import { findAnalysisSession } from '@/lib/analysis/sessions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'A few numbers — TCC Solutions Group',
  robots: { index: false, follow: false },
}

type Props = { params: Promise<{ publicId: string }> }

export default async function RoiPage({ params }: Props) {
  const { publicId } = await params

  const session = await findAnalysisSession(publicId)
  if (!session) notFound()

  if (session.status === 'COMPLETED' || session.status === 'ANALYZING') {
    redirect(`/analyze/${publicId}/results`)
  }

  return (
    <>
      <SiteHeader />

      <main>
        <section className="sec">
          <div className="w narrow">
            <p className="eyebrow">Optional</p>
            <h1>Want us to put numbers on it?</h1>
            <p className="lead">
              If you have rough figures to hand, we can work out what the time and the missed
              opportunities are actually costing. Estimates are fine &mdash; we show the
              arithmetic so you can judge it.
            </p>
            <p className="lead">
              Skip it and you&rsquo;ll still get the full analysis. It will just say plainly which
              numbers it couldn&rsquo;t work out.
            </p>
            <RoiForm publicId={publicId} initialInputs={session.roiInputs ?? {}} />
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
