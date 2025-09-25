const path = require('path');
const crypto = require('crypto');
const { ok, bad, handleOptions } = require('../../src/utils/cors');
const { supabaseAdmin } = require('../../src/lib/supabase');
const { getEnv, ALLOWED_FILE_TYPES, ALLOWED_EXTENSIONS } = require('../../src/lib/env');

exports.handler = async (event) => {
  const pre = handleOptions(event);
  if (pre) return pre;
  if (event.httpMethod !== 'POST') return bad(405, { error: 'Method not allowed' }, event.headers.origin);
  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch { return bad(400, { error: 'Invalid JSON' }, event.headers.origin); }
  const { quote_id, filename, bytes, content_type } = payload || {};
  const env = getEnv();
  if (!quote_id || !filename || !bytes || !content_type) return bad(400, { error: 'Missing fields' }, event.headers.origin);
  const ext = path.extname(filename || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_FILE_TYPES.has(content_type)) return bad(400, { error: 'Unsupported file type' }, event.headers.origin);
  const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
  if (Number(bytes) > maxBytes) return bad(400, { error: `File too large. Max ${env.MAX_UPLOAD_MB} MB` }, event.headers.origin);
  const file_id = crypto.randomUUID();
  const storage_path = `orders/${quote_id}/${file_id}-${filename}`;
  const { data, error } = await supabaseAdmin.storage.from('orders').createSignedUploadUrl(storage_path);
  if (error) return bad(500, { error: 'Failed to create signed upload URL' }, event.headers.origin);
  return ok({ file_id, storage_path, signed_url: data?.signedUrl, headers: { 'x-upsert': 'false', 'content-type': content_type } }, event.headers.origin);
};
