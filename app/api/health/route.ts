import { NextResponse } from 'next/server'
import { isDemoMode } from '@/lib/db'
import { listPartners } from '@/lib/attribution'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Says which mode the partner system is running in. The point is to make the
 * demo/database distinction visible rather than something you infer from
 * whether data survived a redeploy.
 */
export async function GET() {
  const demo = isDemoMode()

  let partnerCount: number | null = null
  let error: string | null = null
  try {
    partnerCount = (await listPartners()).length
  } catch (e) {
    error = e instanceof Error ? e.message : 'unknown error'
  }

  return NextResponse.json(
    {
      ok: error === null,
      mode: demo ? 'demo (no DATABASE_URL)' : 'database',
      partnerCount,
      error,
      time: new Date().toISOString(),
    },
    { status: error === null ? 200 : 500 },
  )
}
