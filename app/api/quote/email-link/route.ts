import { NextRequest, NextResponse } from 'next/server'
import { getEnv } from '@/src/lib/env'
export async function POST(req: NextRequest) {
  const { quote_id, to } = await req.json()
  if (!quote_id || !to) return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  const env = getEnv()
  return NextResponse.json({ ok: true, queued: !env.BREVO_API_KEY })
}
