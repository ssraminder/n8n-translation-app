const { getEnv } = require('../lib/env');

function corsHeaders(origin) {
  const { BASE_URL } = getEnv();
  const allowed = new Set([
    BASE_URL,
    'https://cethos.com',
    'https://www.cethos.com',
  ]);
  const allowOrigin = origin && allowed.has(origin) ? origin : BASE_URL || '';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };
}

function ok(body, origin, extraHeaders={}) {
  return { statusCode: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin), ...extraHeaders }, body: JSON.stringify(body) };
}
function bad(statusCode, body, origin) {
  return { statusCode, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }, body: JSON.stringify(body) };
}

function handleOptions(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...corsHeaders(event.headers.origin || event.headers.Origin) }, body: '' };
  }
  return null;
}

module.exports = { corsHeaders, ok, bad, handleOptions };
