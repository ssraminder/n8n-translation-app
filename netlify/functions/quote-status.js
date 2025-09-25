const { ok, bad, handleOptions } = require('../../src/utils/cors');
const { supabaseAdmin } = require('../../src/lib/supabase');

exports.handler = async (event) => {
  const pre = handleOptions(event);
  if (pre) return pre;
  if (event.httpMethod !== 'GET') return bad(405, { error: 'Method not allowed' }, event.headers.origin);
  const id = (event.queryStringParameters && event.queryStringParameters.id) || null;
  if (!id) return bad(400, { error: 'Missing id' }, event.headers.origin);
  const { data: quote, error } = await supabaseAdmin
    .from('quote_submissions')
    .select('status')
    .eq('quote_id', id)
    .maybeSingle();
  if (error) return bad(500, { error: error.message }, event.headers.origin);
  if (!quote) return bad(404, { error: 'Not found' }, event.headers.origin);
  let stage = 'ocr';
  if (quote.status === 'ready') stage = 'ready';
  else if (quote.status === 'hitl') stage = 'hitl';
  else if (quote.status === 'failed') stage = 'failed';
  else stage = 'pricing';
  return ok({ stage }, event.headers.origin);
};
