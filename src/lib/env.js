const required = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'N8N_WEBHOOK_URL',
  'BASE_URL'
];

function getEnv() {
  const env = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    TWILIO_API_KEY: process.env.TWILIO_API_KEY,
    BASE_URL: process.env.BASE_URL,
    MAX_UPLOAD_MB: Number(process.env.MAX_UPLOAD_MB || 10),
    TZ: process.env.TZ || 'America/Edmonton',
    SAME_DAY_CUTOFF_LOCAL_TIME: process.env.SAME_DAY_CUTOFF_LOCAL_TIME || '14:00',
    SAME_DAY_CUTOFF_WEEKDAYS: (process.env.SAME_DAY_CUTOFF_WEEKDAYS || '1,2,3,4,5')
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !Number.isNaN(n)),
  };
  for (const key of required) {
    if (!env[key]) {
      console.warn(`[warn] Missing env ${key}`);
    }
  }
  return env;
}

const ALLOWED_FILE_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const ALLOWED_EXTENSIONS = new Set(['.pdf','.jpg','.jpeg','.png','.doc','.docx','.xls','.xlsx']);

module.exports = { getEnv, ALLOWED_FILE_TYPES, ALLOWED_EXTENSIONS };
