import { NextRequest, NextResponse } from 'next/server'
import { getEnv } from '@/src/lib/env'

export async function POST(req: NextRequest) {
  const env = getEnv()
  const body = await req.json().catch(()=>null)
  const method = String(body?.method || '').toLowerCase()
  const code = String(body?.code || '').trim()
  const to = String(body?.to || '').trim()
  const fromEmail = String(body?.fromEmail || env.BREVO_FROM_EMAIL || '').trim()

  if (!method || !code || !to) return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  if (!/^[0-9]{6}$/.test(code)) return NextResponse.json({ error: 'INVALID_CODE' }, { status: 400 })

  try {
    if (method === 'email') {
      if (!env.BREVO_API_KEY) return NextResponse.json({ error: 'EMAIL_NOT_CONFIGURED' }, { status: 501 })
      if (!fromEmail) return NextResponse.json({ error: 'SENDER_EMAIL_MISSING' }, { status: 501 })
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'api-key': String(env.BREVO_API_KEY) },
        body: JSON.stringify({
          sender: { email: fromEmail },
          to: [{ email: to }],
          subject: 'Your verification code',
          htmlContent: `<p>Your verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`
        })
      })
      if (!res.ok) {
        const t = await res.text().catch(()=>null)
        return NextResponse.json({ error: 'EMAIL_FAILED', details: t?.slice(0, 300) || '' }, { status: 502 })
      }
      return NextResponse.json({ ok: true, channel: 'email' })
    }

    if (method === 'sms') {
      const missing: string[] = []
      const hasFrom = Boolean(env.TWILIO_FROM)
      const hasService = Boolean(env.TWILIO_MESSAGING_SERVICE_SID)
      if (!env.TWILIO_ACCOUNT_SID) missing.push('TWILIO_ACCOUNT_SID')
      if (!env.TWILIO_AUTH_TOKEN) missing.push('TWILIO_AUTH_TOKEN')
      if (!hasFrom && !hasService) missing.push('TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID')
      if (missing.length) return NextResponse.json({ error: 'SMS_NOT_CONFIGURED', missing }, { status: 501 })

      const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')
      const form = new URLSearchParams()

      // Use Messaging Service if provided; otherwise use From number (normalized)
      if (hasService) {
        form.append('MessagingServiceSid', String(env.TWILIO_MESSAGING_SERVICE_SID))
      } else {
        const from = String(env.TWILIO_FROM).trim()
        const fromNormalized = from.startsWith('+') ? from : (/^\d+$/.test(from) ? `+${from}` : from)
        form.append('From', fromNormalized)
      }

      // Normalize To to E.164 if it's only digits and missing '+'
      const toNormalized = to.startsWith('+') ? to : (/^\d+$/.test(to) ? `+${to}` : to)
      form.append('To', toNormalized)
      form.append('Body', `Your verification code is ${code}`)
      const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`
      const res = await fetch(url, { method: 'POST', headers: { 'Authorization': `Basic ${auth}`, 'content-type': 'application/x-www-form-urlencoded' }, body: form.toString() })
      if (!res.ok) {
        const t = await res.text().catch(()=>null)
        return NextResponse.json({ error: 'SMS_FAILED', details: t?.slice(0, 300) || '' }, { status: 502 })
      }
      return NextResponse.json({ ok: true, channel: 'sms' })
    }

    return NextResponse.json({ error: 'UNSUPPORTED_METHOD' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: 'OTP_ERROR', details: e?.message || '' }, { status: 500 })
  }
}
