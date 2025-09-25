const fetch = global.fetch;
const { ok, bad, handleOptions } = require('../../src/utils/cors');
const { supabaseAdmin } = require('../../src/lib/supabase');
const { getEnv } = require('../../src/lib/env');

async function getOrCreateCustomer({ name, email, phone }) {
  const { data: existing, error: selErr } = await supabaseAdmin
    .from('customers')
    .select('*')
    .eq('email', email)
    .limit(1)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing.id;
  const { data, error } = await supabaseAdmin
    .from('customers')
    .insert({ name, email, phone })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

exports.handler = async (event) => {
  const pre = handleOptions(event);
  if (pre) return pre;
  if (event.httpMethod !== 'POST') return bad(405, { error: 'Method not allowed' }, event.headers.origin);
  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch { return bad(400, { error: 'Invalid JSON' }, event.headers.origin); }
  const { quote, files } = payload || {};
  const required = ['quote_id','client_name','client_email','source_lang','target_lang','intended_use'];
  for (const k of required) { if (!quote?.[k]) return bad(400, { error: `Missing field ${k}` }, event.headers.origin); }
  // Server-side guard: English must be in pair; otherwise flag hitl_required
  const englishPair = /english/i.test(quote.source_lang || '') || /english/i.test(quote.target_lang || '');
  const hitl_required = !englishPair;

  try {
    const customer_id = await getOrCreateCustomer({ name: quote.client_name, email: quote.client_email, phone: quote.phone });
    const insertQuote = {
      quote_id: quote.quote_id,
      customer_id,
      client_name: quote.client_name,
      client_email: quote.client_email,
      phone: quote.phone || null,
      source_lang: quote.source_lang,
      target_lang: quote.target_lang,
      intended_use: quote.intended_use,
      status: 'pending',
      payment_status: 'unpaid',
      hitl_requested: false,
      hitl_required,
    };
    const { error: qErr } = await supabaseAdmin.from('quote_submissions').insert(insertQuote);
    if (qErr) return bad(400, { error: qErr.message }, event.headers.origin);

    if (Array.isArray(files) && files.length) {
      const toInsert = files.map(f => ({
        quote_id: quote.quote_id,
        file_id: f.file_id,
        filename: f.filename,
        storage_path: f.storage_path,
        signed_url: f.signed_url || null,
        bytes: f.bytes,
        content_type: f.content_type || null,
      }));
      const { error: fErr } = await supabaseAdmin.from('quote_files').insert(toInsert);
      if (fErr) return bad(400, { error: fErr.message }, event.headers.origin);
    }

    const env = getEnv();
    // Notify n8n for OCR/LLM/pricing flow with binary files
    try {
      const form = new FormData();
      form.append('quote_id', quote.quote_id);
      form.append('event', 'files_uploaded');
      if (Array.isArray(files) && files.length) {
        for (const f of files) {
          const { data: blob, error: dlErr } = await supabaseAdmin.storage.from('orders').download(f.storage_path);
          if (dlErr || !blob) continue;
          const ab = await blob.arrayBuffer();
          const typed = new Blob([ab], { type: f.content_type || 'application/octet-stream' });
          const filename = f.filename || (f.storage_path?.split('/').pop() || 'upload.bin');
          form.append('files', typed, filename);
        }
      }
      await fetch(env.N8N_WEBHOOK_URL, { method: 'POST', body: form });
    } catch (_) {}

    return ok({ ok: true }, event.headers.origin);
  } catch (e) {
    return bad(500, { error: 'Server error' }, event.headers.origin);
  }
};
