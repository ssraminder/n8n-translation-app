import { NextRequest, NextResponse } from 'next/server'
import { getEnv } from '@/src/lib/env'
export async function POST(req: NextRequest) {
  const { quote_id, to } = await req.json()
  if (!quote_id || !to) return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  const env = getEnv()
  if (env.BREVO_API_KEY && env.BASE_URL) {
    const link = `${env.BASE_URL}/quote/${encodeURIComponent(String(quote_id))}`
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'api-key': String(env.BREVO_API_KEY) },
        body: JSON.stringify({ sender: { email: 'no-reply@certifiedtranslations.example' }, to: [{ email: String(to) }], subject: 'Your translation quote', htmlContent: `<p>View your quote: <a href="${link}">${link}</a></p>` })
      })
      if (!res.ok) {
        const t = await res.text().catch(()=>null)
        return NextResponse.json({ ok: false, error: 'EMAIL_FAILED', details: t?.slice(0, 300) || '' }, { status: 502 })
      }
      return NextResponse.json({ ok: true, queued: false })
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: 'EMAIL_ERROR', details: e?.message || '' }, { status: 500 })
    }
  }
  return NextResponse.json({ ok: true, queued: true })
}
