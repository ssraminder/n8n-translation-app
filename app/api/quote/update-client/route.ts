import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

  // Step 3 optional selections
  const source_lang = typeof payload?.source_lang === 'string' ? payload.source_lang : undefined
  const target_lang = typeof payload?.target_lang === 'string' ? payload.target_lang : undefined
  const intended_use_id = typeof payload?.intended_use_id === 'number' ? payload.intended_use_id : (typeof payload?.intended_use_id === 'string' ? parseInt(payload.intended_use_id, 10) : undefined)
  let intended_use: string | undefined = typeof payload?.intended_use === 'string' ? payload.intended_use : undefined

  if (!intended_use && typeof intended_use_id === 'number' && Number.isFinite(intended_use_id)) {
    try {
      const { data: useRow } = await supabase.from('intended_uses').select('name').eq('id', intended_use_id).maybeSingle()
      if (useRow?.name) intended_use = useRow.name
    } catch (_) {}
  }

  const update: Record<string, any> = { status: 'submitted', name: client_name, email: client_email }
  if (typeof phone === 'string' && phone) update.phone = phone
  if (customer_id) update.customer_id = customer_id
  if (source_lang) update.source_lang = source_lang
  if (target_lang) update.target_lang = target_lang
  if (typeof intended_use_id === 'number' && Number.isFinite(intended_use_id)) update.intended_use_id = intended_use_id
  if (typeof intended_use === 'string') update.intended_use = intended_use

  const { error } = await supabase
    .from('quote_submissions')
    .update(update)
    .eq('quote_id', quote_id)
  if (error) {
    return NextResponse.json({ error: 'DB_ERROR', details: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, customer_id })
}
