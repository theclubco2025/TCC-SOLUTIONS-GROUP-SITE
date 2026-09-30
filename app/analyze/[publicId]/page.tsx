import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import QuestionnaireForm from '@/components/QuestionnaireForm'
import { SiteFooter, SiteHeader } from '@/components/SiteChrome'
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

  return (
    <>
      <SiteHeader />

      <main>
        <section className="sec">
          <div className="w narrow">
            <p className="eyebrow">Technology Opportunity Analysis</p>
            <h1>Tell us how the business actually runs.</h1>
            <p className="lead">
              Plain answers beat tidy ones. Four questions are required and the rest help us see
              the picture &mdash; your answers save as you type, so you can leave this and come
              back to it.
            </p>
            <QuestionnaireForm publicId={publicId} initialAnswers={session.answers ?? {}} />
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
