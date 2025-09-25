const fetch = global.fetch;
const { ok, bad, handleOptions } = require('../../src/utils/cors');
const { getEnv } = require('../../src/lib/env');

exports.handler = async (event) => {
  const pre = handleOptions(event);
  if (pre) return pre;
  if (event.httpMethod !== 'POST') return bad(405, { error: 'Method not allowed' }, event.headers.origin);
  let payload; try { payload = JSON.parse(event.body || '{}'); } catch { return bad(400, { error: 'Invalid JSON' }, event.headers.origin); }
  const { quote_id, to_email } = payload || {};
  if (!quote_id || !to_email) return bad(400, { error: 'Missing fields' }, event.headers.origin);
  const env = getEnv();
  if (!env.BREVO_API_KEY) return bad(501, { error: 'Email not configured' }, event.headers.origin);
  const link = `${env.BASE_URL}/quote/${quote_id}`;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': env.BREVO_API_KEY },
    body: JSON.stringify({
      to: [{ email: to_email }],
      subject: 'Your translation quote link',
      htmlContent: `<p>View your quote: <a href="${link}">${link}</a></p>`
    })
  });
  if (!res.ok) return bad(500, { error: 'Failed to send email' }, event.headers.origin);
  return ok({ ok: true }, event.headers.origin);
};
