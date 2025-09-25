const { ok, bad, handleOptions } = require('../../src/utils/cors');
const { getEnv } = require('../../src/lib/env');
const { supabaseAdmin } = require('../../src/lib/supabase');

exports.handler = async (event) => {
  const pre = handleOptions(event);
  if (pre) return pre;
  const env = getEnv();
  if (event.httpMethod !== 'POST') return bad(405, { error: 'Method not allowed' }, event.headers.origin);
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  if (!env.STRIPE_WEBHOOK_SECRET) return bad(501, { error: 'Webhook not configured' }, event.headers.origin);
  const Stripe = require('stripe');
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  let evt;
  try {
    evt = stripe.webhooks.constructEvent(event.body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return bad(400, { error: 'Invalid signature' }, event.headers.origin);
  }
  if (evt.type === 'checkout.session.completed') {
    const session = evt.data.object;
    const quote_id = session.metadata && session.metadata.quote_id;
    const amount = session.amount_total;
    const currency = session.currency;
    const pi = session.payment_intent;
    if (quote_id) {
      await supabaseAdmin.from('quote_submissions').update({ payment_status: 'paid', status: 'paid' }).eq('quote_id', quote_id);
      await supabaseAdmin.from('payments').insert({ quote_id, stripe_pi: String(pi), amount: amount / 100.0, currency: String(currency).toUpperCase(), status: 'succeeded' });
    }
  }
  return ok({ received: true }, event.headers.origin);
};
