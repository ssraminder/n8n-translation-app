const { createClient } = require('@supabase/supabase-js');
const { getEnv } = require('./env');

const env = getEnv();

const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

module.exports = { supabaseAdmin };
