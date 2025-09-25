import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/src/lib/stripe'
export const runtime = 'nodejs'
export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret || !sig) return NextResponse.json({ ok: true, skipped: true })
  const raw = await req.text()
  try {
    const event = stripe.webhooks.constructEvent(raw, sig, secret)
    if (event.type === 'checkout.session.completed') { }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'WEBHOOK_INVALID', message: e?.message || 'invalid' }, { status: 400 })
  }
}
