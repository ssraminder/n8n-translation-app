const fetch = global.fetch;
const { ok, bad, handleOptions } = require('../../src/utils/cors');
const { supabaseAdmin } = require('../../src/lib/supabase');
const { getEnv } = require('../../src/lib/env');

exports.handler = async (event) => {
  const pre = handleOptions(event);
  if (pre) return pre;
  if (event.httpMethod !== 'POST') return bad(405, { error: 'Method not allowed' }, event.headers.origin);
  let payload; try { payload = JSON.parse(event.body || '{}'); } catch { return bad(400, { error: 'Invalid JSON' }, event.headers.origin); }
  const { quote_id } = payload || {};
  if (!quote_id) return bad(400, { error: 'Missing quote_id' }, event.headers.origin);
  const { error } = await supabaseAdmin.from('quote_submissions').update({ hitl_requested: true, status: 'hitl' }).eq('quote_id', quote_id);
  if (error) return bad(500, { error: error.message }, event.headers.origin);
  const env = getEnv();
  await fetch(env.N8N_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quote_id, event: 'hitl_requested' }) }).catch(() => {});
  return ok({ ok: true }, event.headers.origin);
};
