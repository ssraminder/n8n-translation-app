const { ok, bad, handleOptions } = require('../../src/utils/cors');
const { supabaseAdmin } = require('../../src/lib/supabase');
const { getEnv } = require('../../src/lib/env');

function jobIdFromQuote(id) {
  let h = 0 >>> 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  const num = (h % 90000) + 10000;
  return `CS${num}`;
}

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
  try {
    const { data: sub } = await supabaseAdmin.from('quote_submissions').select('source_lang,target_lang,intended_use').eq('quote_id', quote_id).maybeSingle();
    const { data: rs } = await supabaseAdmin.from('quote_results').select('results_json').eq('quote_id', quote_id).maybeSingle();
    const out = {
      quote_id,
      hitl_requested: true,
      job_id: jobIdFromQuote(quote_id),
      source_language: sub && sub.source_lang ? sub.source_lang : '',
      target_language: sub && sub.target_lang ? sub.target_lang : '',
      intended_use: sub && sub.intended_use ? sub.intended_use : '',
      country_of_issue: (rs && rs.results_json && rs.results_json.country_of_issue) ? rs.results_json.country_of_issue : ''
    };
    await fetch(env.N8N_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) }).catch(() => {});
  } catch (_) {
    await fetch(env.N8N_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quote_id, hitl_requested: true, job_id: jobIdFromQuote(quote_id) }) }).catch(() => {});
  }
  return ok({ ok: true }, event.headers.origin);
};
