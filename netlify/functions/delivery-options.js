const { ok, bad, handleOptions } = require('../../src/utils/cors');
const { supabaseAdmin } = require('../../src/lib/supabase');
const { getEnv } = require('../../src/lib/env');

function isBusinessDay(d) { const day = d.getDay(); return day !== 0 && day !== 6; }
function addBusinessDays(start, days) {
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  let added = 0; while (added < days) { d.setDate(d.getDate() + 1); if (isBusinessDay(d)) added++; }
  return d;
}

exports.handler = async (event) => {
  const pre = handleOptions(event);
  if (pre) return pre;
  if (event.httpMethod !== 'GET') return bad(405, { error: 'Method not allowed' }, event.headers.origin);
  const quote_id = event.queryStringParameters && event.queryStringParameters.quote_id;
  if (!quote_id) return bad(400, { error: 'Missing quote_id' }, event.headers.origin);

  const { data: qr } = await supabaseAdmin.from('quote_results').select('subtotal,total,results_json,eta_business_days').eq('quote_id', quote_id).maybeSingle();
  const { data: q } = await supabaseAdmin.from('quote_submissions').select('created_at').eq('quote_id', quote_id).maybeSingle();
  const { data: options } = await supabaseAdmin.from('delivery_options').select('*').eq('active', true).order('display_order');
  const env = getEnv();

  const pages = Number(qr?.results_json?.billable_pages || qr?.results_json?.pages || 0);
  const docType = qr?.results_json?.doc_type || null;
  const country = qr?.results_json?.country_of_issue || null;

  let sameDayAllowed = false; let sameDayReason = '';
  if (pages === 1) {
    const { data: sdq } = await supabaseAdmin.from('same_day_qualifiers').select('*').eq('doc_type', docType || '').eq('country', country || '').eq('active', true).maybeSingle();
    if (!sdq) { sameDayReason = 'Not eligible'; }
    else {
      const now = new Date();
      const [hh, mm] = env.SAME_DAY_CUTOFF_LOCAL_TIME.split(':').map(n => parseInt(n,10));
      const isBeforeCutoff = now.getHours() < hh || (now.getHours() === hh && now.getMinutes() <= mm);
      const weekday = now.getDay(); const weekdayIso = weekday === 0 ? 7 : weekday; // 1..7
      const inWeek = env.SAME_DAY_CUTOFF_WEEKDAYS.includes(weekdayIso);
      sameDayAllowed = isBeforeCutoff && inWeek;
      if (!sameDayAllowed) sameDayReason = 'Past cutoff or day';
    }
  } else {
    sameDayReason = 'Only 1-page orders';
  }

  const baseDate = q?.created_at ? new Date(q.created_at) : new Date();
  const results = (options || []).map(o => {
    let fee = 0; const base = Number(qr?.subtotal || 0);
    if (o.fee_type === 'flat') fee = Number(o.fee_amount || 0);
    else if (o.fee_type === 'percent') fee = Math.round((base * Number(o.fee_amount || 0)) * 100) / 100;
    let available = true; let reason = undefined;
    if (o.is_same_day) { available = sameDayAllowed; if (!available) reason = sameDayReason || 'Unavailable'; }
    const days = Number(o.base_business_days || 0) + Number(o.addl_business_days || 0);
    const eta_date = addBusinessDays(baseDate, days);
    return { id: o.id, name: o.name, available, reason, fee, eta_date: eta_date.toISOString().slice(0,10) };
  });

  return ok(results, event.headers.origin);
};
