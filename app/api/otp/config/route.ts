import { NextResponse } from 'next/server'
import { getEnv } from '@/src/lib/env'

export async function GET() {
  const env = getEnv()
  const email = Boolean(env.BREVO_API_KEY && env.BREVO_FROM_EMAIL)
  const sms = Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM)
  const missingSms: string[] = []
  if (!env.TWILIO_ACCOUNT_SID) missingSms.push('TWILIO_ACCOUNT_SID')
  if (!env.TWILIO_AUTH_TOKEN) missingSms.push('TWILIO_AUTH_TOKEN')
  if (!env.TWILIO_FROM) missingSms.push('TWILIO_FROM')
  return NextResponse.json({ email, sms, sender: env.BREVO_FROM_EMAIL || null, smsMissing: missingSms })
}
