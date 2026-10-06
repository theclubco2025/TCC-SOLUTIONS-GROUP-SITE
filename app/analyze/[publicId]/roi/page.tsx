import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import RoiForm from '@/components/RoiForm'
import { SiteShell } from '@/components/SiteChrome'
import { FLOW } from '@/lib/analysis/config'
import { findAnalysisSession } from '@/lib/analysis/sessions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'A few numbers — TCC Solutions Group',
  robots: { index: false, follow: false },
}

type Props = { params: Promise<{ publicId: string }> }

const NEARLY_DONE = (FLOW.length / (FLOW.length + 1)) * 100

export default async function RoiPage({ params }: Props) {
  const { publicId } = await params

  const session = await findAnalysisSession(publicId)
  if (!session) notFound()

  if (session.status === 'COMPLETED' || session.status === 'ANALYZING') {
    redirect(`/analyze/${publicId}/results`)
  }

  return (
    <SiteShell area="analyze" cta={false}>
      <main>
        <section className="sec">
          <div className="w narrow">
            {/* The questionnaire's progress bar, carried over nearly full: this is
                the last step, and it is optional. */}
            <div className="flow-meta">
              <span>Questions done &#10003;</span>
              <span>Optional last step</span>
            </div>
            <div className="flow-track" aria-hidden="true">
              <div className="flow-fill" style={{ width: `${NEARLY_DONE}%` }} />
            </div>

            <h1 className="flow-q">Want to put a number on it?</h1>
            <p className="flow-help">
              Rough numbers are fine. The cost works itself out as you type, using the same
              arithmetic as your report. Or skip it &mdash; you&rsquo;ll still get the full
              analysis.
            </p>
            <RoiForm publicId={publicId} initialInputs={session.roiInputs ?? {}} />
          </div>
        </section>
      </main>
    </SiteShell>
  )
}
