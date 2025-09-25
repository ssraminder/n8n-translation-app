const crypto = require('crypto');
const { ok, bad, handleOptions } = require('../../src/utils/cors');

exports.handler = async (event) => {
  const pre = handleOptions(event);
  if (pre) return pre;
  if (event.httpMethod !== 'POST') return bad(405, { error: 'Method not allowed' }, event.headers.origin);
  const quote_id = crypto.randomUUID();
  return ok({ quote_id }, event.headers.origin);
};
