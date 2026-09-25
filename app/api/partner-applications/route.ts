import { NextResponse, type NextRequest } from 'next/server'
import { createApplication, validateApplication } from '@/lib/applications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, errors: ['Malformed request.'] }, { status: 400 })
  }

  const str = (k: string) => (typeof body[k] === 'string' ? (body[k] as string) : undefined)

  const input = {
    name: str('name') ?? '',
    organization: str('organization'),
    email: str('email') ?? '',
    phone: str('phone'),
    audience: str('audience'),
    message: str('message'),
    sourcePath: '/partners/apply',
    referrerUrl: request.headers.get('referer') ?? undefined,
  }

  const errors = validateApplication(input)
  if (errors.length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 })
  }

  try {
    const result = await createApplication(input)
    return NextResponse.json({ ok: true, persisted: result.persisted })
  } catch (e) {
    // Never swallow this into a success screen — someone is waiting on a reply.
    const message = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json(
      { ok: false, errors: ['We could not record that. Please call or email us instead.'], detail: message },
      { status: 500 },
    )
  }
}
