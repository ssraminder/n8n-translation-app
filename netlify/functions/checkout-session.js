const { ok, bad, handleOptions } = require('../../src/utils/cors');
const { getEnv } = require('../../src/lib/env');
const { supabaseAdmin } = require('../../src/lib/supabase');

exports.handler = async (event) => {
  const pre = handleOptions(event);
  if (pre) return pre;
  if (event.httpMethod !== 'POST') return bad(405, { error: 'Method not allowed' }, event.headers.origin);
  let payload; try { payload = JSON.parse(event.body || '{}'); } catch { return bad(400, { error: 'Invalid JSON' }, event.headers.origin); }
  const { quote_id } = payload || {};
  if (!quote_id) return bad(400, { error: 'Missing quote_id' }, event.headers.origin);
  const env = getEnv();
  if (!env.STRIPE_SECRET_KEY) return bad(501, { error: 'Payments not configured' }, event.headers.origin);
  const Stripe = require('stripe');
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

  const { data: qr } = await supabaseAdmin.from('quote_results').select('total,currency').eq('quote_id', quote_id).maybeSingle();
  const { data: q } = await supabaseAdmin.from('quote_submissions').select('client_email').eq('quote_id', quote_id).maybeSingle();
  const amount = Math.round(Number(qr?.total || 0) * 100);
  if (!amount || amount <= 0) return bad(400, { error: 'Invalid amount' }, event.headers.origin);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    automatic_payment_methods: { enabled: true },
    customer_email: q?.client_email || undefined,
    line_items: [{ price_data: { currency: (qr?.currency || 'CAD').toLowerCase(), product_data: { name: 'Translation Order' }, unit_amount: amount }, quantity: 1 }],
    success_url: `${env.BASE_URL}/receipt/${quote_id}`,
    cancel_url: `${env.BASE_URL}/quote/${quote_id}`,
    metadata: { quote_id },
  });

  return ok({ url: session.url }, event.headers.origin);
};
