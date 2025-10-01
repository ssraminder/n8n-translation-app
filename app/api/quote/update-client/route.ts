import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function jobIdFromQuote(id: string) {
  let h = 0 >>> 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const num = (h % 90000) + 10000
  return `CS${num}`
}

export async function POST(req: NextRequest) {
  const payload = await req.json()
  const { quote_id, client_name, client_email, phone } = payload || {}
  if (!quote_id || !client_name || !client_email) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  }

  const supabaseUrl = process.env.SUPABASE_URL as string
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined
  const anonKey = process.env.SUPABASE_ANON_KEY as string
  const supabase = createClient(supabaseUrl, serviceKey || anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // Optional: create or find customer by email
  let customer_id: string | null = null
  try {
    const { data: existing } = await supabase.from('customers').select('id').eq('email', client_email).maybeSingle()
    if (existing?.id) {
      customer_id = existing.id as any
    } else {
      const { data: created } = await supabase.from('customers').insert({ name: client_name, email: client_email, phone: phone || null }).select('id').single()
      customer_id = (created as any)?.id || null
    }
  } catch (_) {
    customer_id = null
  }

  // Optional selections from step 3
  const source_lang = typeof payload?.source_lang === 'string' ? payload.source_lang : undefined
  const target_lang = typeof payload?.target_lang === 'string' ? payload.target_lang : undefined
  const intended_use: string | undefined = typeof payload?.intended_use === 'string' ? payload.intended_use : undefined
  const intended_use_id: number | undefined = typeof payload?.intended_use_id === 'number' ? payload.intended_use_id : (typeof payload?.intended_use_id === 'string' ? parseInt(payload.intended_use_id, 10) : undefined)
  const source_code: string | undefined = typeof payload?.source_code === 'string' ? payload.source_code : undefined
  const target_code: string | undefined = typeof payload?.target_code === 'string' ? payload.target_code : undefined
  const country: string | undefined = typeof payload?.country === 'string' ? payload.country : undefined
  const country_code: string | undefined = typeof payload?.country_code === 'string' ? payload.country_code : undefined

  const update: Record<string, any> = { status: 'submitted', name: client_name, email: client_email, client_email }
  if (typeof phone === 'string' && phone) update.phone = phone
  if (source_lang) update.source_lang = source_lang
  if (target_lang) update.target_lang = target_lang
  if (typeof intended_use === 'string') update.intended_use = intended_use
  // Note: we intentionally do not write intended_use_id/source_code/target_code/country/country_code to DB to avoid schema mismatches

  const { error } = await supabase
    .from('quote_submissions')
    .update(update)
    .eq('quote_id', quote_id)
  if (error) {
    return NextResponse.json({ error: 'DB_ERROR', details: error.message }, { status: 500 })
  }

  // Fire webhook only when step 3 fields are present
  const hasStep3 = Boolean(
    (source_lang && source_lang.trim()) ||
    (target_lang && target_lang.trim()) ||
    typeof intended_use_id === 'number' ||
    (source_code && source_code.trim()) ||
    (target_code && target_code.trim()) ||
    (country && country.trim()) ||
    (country_code && country_code.trim())
  )
  if (hasStep3) {
    const env = { STEP3: process.env.N8N_STEP3_WEBHOOK_URL, PRIMARY: process.env.N8N_WEBHOOK_URL }
    const webhook = env.STEP3 || env.PRIMARY
    if (webhook) {
      const payloadOut = {
        event: 'quote_updated',
        quote_id,
        job_id: jobIdFromQuote(quote_id),
        source_language: source_lang || '',
        target_language: target_lang || '',
        intended_use_id: typeof intended_use_id === 'number' ? intended_use_id : null,
        source_code: source_code || null,
        target_code: target_code || null,
        country: country || '',
        country_code: country_code || null
      }
      fetch(webhook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payloadOut) }).catch(()=>{})
    }
  }

  return NextResponse.json({ ok: true, customer_id })
}
