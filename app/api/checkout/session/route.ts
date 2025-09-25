import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/src/lib/stripe'
export async function POST(req: NextRequest) {
  const { quote_id, amount_cents, delivery_fee_cents } = await req.json()
  if (!quote_id || typeof amount_cents !== 'number') return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  const line_items: any[] = [ { price_data: { currency: 'usd', product_data: { name: `Translation order ${quote_id}` }, unit_amount: amount_cents }, quantity: 1 } ]
  if (delivery_fee_cents && delivery_fee_cents > 0) { line_items.push({ price_data: { currency: 'usd', product_data: { name: 'Delivery' }, unit_amount: delivery_fee_cents }, quantity: 1 }) }
  const session = await stripe.checkout.sessions.create({
    mode: 'payment', payment_method_types: ['card','link'], line_items,
    success_url: `${process.env.BASE_URL}/receipt/${quote_id}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.BASE_URL}/checkout/${quote_id}`,
    metadata: { quote_id }, automatic_tax: { enabled: false },
  })
  return NextResponse.json({ url: session.url })
}
