import { NextResponse } from 'next/server'
import { getEnv } from '@/src/lib/env'

export async function GET() {
  const env = getEnv()
  const email = Boolean(env.BREVO_API_KEY && env.BREVO_FROM_EMAIL)
  const hasFrom = Boolean(env.TWILIO_FROM)
  const hasService = Boolean(env.TWILIO_MESSAGING_SERVICE_SID)
  const sms = Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && (hasFrom || hasService))
  const missingSms: string[] = []
  if (!env.TWILIO_ACCOUNT_SID) missingSms.push('TWILIO_ACCOUNT_SID')
  if (!env.TWILIO_AUTH_TOKEN) missingSms.push('TWILIO_AUTH_TOKEN')
  if (!hasFrom && !hasService) missingSms.push('TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID')
  return NextResponse.json({ email, sms, sender: env.BREVO_FROM_EMAIL || null, smsMissing: missingSms })
}
