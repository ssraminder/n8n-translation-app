export function getEnv() {
  const env = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL,
    N8N_STEP3_WEBHOOK_URL: process.env.N8N_STEP3_WEBHOOK_URL,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    BREVO_FROM_EMAIL: process.env.BREVO_FROM_EMAIL || 'no-reply@example.com',
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_FROM: process.env.TWILIO_FROM,
    BASE_URL: process.env.BASE_URL,
    MAX_UPLOAD_MB: Number(process.env.MAX_UPLOAD_MB || 50),
    SIGNED_URL_TTL_SECS: Number(process.env.SIGNED_URL_TTL_SECS || 1209600),
    TZ: process.env.TZ || 'America/Edmonton',
    SAME_DAY_CUTOFF_LOCAL_TIME: process.env.SAME_DAY_CUTOFF_LOCAL_TIME || '14:00',
    SAME_DAY_CUTOFF_WEEKDAYS: (process.env.SAME_DAY_CUTOFF_WEEKDAYS || '1,2,3,4,5').split(',').map((s)=>parseInt(s.trim(),10)).filter((n)=>!Number.isNaN(n)),
  }
  return env
}

export const ALLOWED_FILE_TYPES = new Set([
  'application/pdf','image/jpeg','image/png','image/tiff','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])
export const ALLOWED_EXTENSIONS = new Set(['.pdf','.jpg','.jpeg','.png','.tif','.tiff','.doc','.docx','.xls','.xlsx'])
