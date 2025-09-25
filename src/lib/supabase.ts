import { createClient } from '@supabase/supabase-js'
const url = process.env.SUPABASE_URL as string
export const supabaseClient = createClient(url, process.env.SUPABASE_ANON_KEY as string)
export const supabaseSrv = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false, autoRefreshToken: false } })
