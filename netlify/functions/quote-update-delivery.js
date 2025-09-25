const { ok, bad, handleOptions } = require('../../src/utils/cors');
const { supabaseAdmin } = require('../../src/lib/supabase');

function isBusinessDay(d) { const day = d.getDay(); return day !== 0 && day !== 6; }
function addBusinessDays(start, days) { const d = new Date(start.getFullYear(), start.getMonth(), start.getDate()); let added = 0; while (added < days) { d.setDate(d.getDate() + 1); if (isBusinessDay(d)) added++; } return d; }

exports.handler = async (event) => {
  const pre = handleOptions(event);
  if (pre) return pre;
  if (event.httpMethod !== 'POST') return bad(405, { error: 'Method not allowed' }, event.headers.origin);
  let payload; try { payload = JSON.parse(event.body || '{}'); } catch { return bad(400, { error: 'Invalid JSON' }, event.headers.origin); }
  const { quote_id, delivery_option_id } = payload || {};
  if (!quote_id || !delivery_option_id) return bad(400, { error: 'Missing fields' }, event.headers.origin);
  const { data: opt, error: oErr } = await supabaseAdmin.from('delivery_options').select('*').eq('id', delivery_option_id).maybeSingle();
  if (oErr || !opt) return bad(400, { error: 'Invalid delivery option' }, event.headers.origin);
  const { data: q } = await supabaseAdmin.from('quote_submissions').select('created_at').eq('quote_id', quote_id).maybeSingle();
  const baseDate = q?.created_at ? new Date(q.created_at) : new Date();
  const days = Number(opt.base_business_days || 0) + Number(opt.addl_business_days || 0);
  const eta = addBusinessDays(baseDate, days).toISOString().slice(0,10);
  const { error } = await supabaseAdmin.from('quote_submissions').update({ delivery_option_id, delivery_eta_date: eta }).eq('quote_id', quote_id);
  if (error) return bad(500, { error: error.message }, event.headers.origin);
  return ok({ eta_date: eta }, event.headers.origin);
};
