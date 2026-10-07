import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import QuestionnaireForm from '@/components/QuestionnaireForm'
import { SiteShell } from '@/components/SiteChrome'
import { findAnalysisSession } from '@/lib/analysis/sessions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Your analysis — TCC Solutions Group',
  // Nobody should land here from search; the URL is the visitor's own token.
  robots: { index: false, follow: false },
}

type Props = { params: Promise<{ publicId: string }> }

export default async function QuestionnairePage({ params }: Props) {
  const { publicId } = await params

  const session = await findAnalysisSession(publicId)
  if (!session) notFound()

  // Already submitted: send them to what they came back for, not a form that
  // would be rejected on save.
  if (session.status === 'COMPLETED' || session.status === 'ANALYZING') {
    redirect(`/analyze/${publicId}/results`)
  }

  // No big heading or paragraph above the questions: each question is the
  // heading. The less there is to read before the first tap, the more people tap.
  return (
    <SiteShell area="analyze" cta={false}>
      <main>
        <section className="sec">
          <div className="w">
            <QuestionnaireForm publicId={publicId} initialAnswers={session.answers ?? {}} />
          </div>
        </section>
      </main>
    </SiteShell>
  )
}
