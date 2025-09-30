import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getEnv } from '@/src/lib/env'

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

export async function POST(req: NextRequest) {
  const payload = await req.json()
  const { quote_id } = payload || {}
  if (!quote_id || !isUuid(String(quote_id))) return NextResponse.json({ error: 'INVALID_QUOTE_ID' }, { status: 400 })

  const supabaseUrl = process.env.SUPABASE_URL as string
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined
  const anonKey = process.env.SUPABASE_ANON_KEY as string
  const supabase = createClient(supabaseUrl, serviceKey || anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const env = getEnv()
  const ttl = Number(env.SIGNED_URL_TTL_SECS || 1209600)

  const { data: existing } = await supabase.from('quote_results').select('results_json').eq('quote_id', quote_id).maybeSingle()
  const current = (existing as any)?.results_json || {}

  const next: any = { ...current }

  if (typeof payload?.document_type_id === 'number') next.document_type_id = payload.document_type_id
  if (typeof payload?.document_type_other === 'string') next.document_type_other = payload.document_type_other
  if (typeof payload?.reference_notes === 'string') next.reference_notes = payload.reference_notes

  if (Array.isArray(payload?.reference_files)) {
    const entries: any[] = []
    for (const f of payload.reference_files as { path: string; filename?: string }[]) {
      if (!f?.path) continue
      const { data: signed } = await supabase.storage.from('orders').createSignedUrl(f.path, ttl)
      entries.push({ path: f.path, filename: f.filename || f.path.split('/').pop(), url: signed?.signedUrl || null })
    }
    next.reference_files = entries
  }

  // Upsert without clobbering totals
  const { data: row } = await supabase.from('quote_results').select('subtotal,tax,total,currency').eq('quote_id', quote_id).maybeSingle()
  if (row) {
    const { error: upErr } = await supabase.from('quote_results').update({ results_json: next }).eq('quote_id', quote_id)
    if (upErr) return NextResponse.json({ error: 'DB_ERROR', details: upErr.message }, { status: 500 })
  } else {
    const { error: insErr } = await supabase.from('quote_results').insert({ quote_id, results_json: next })
    if (insErr) return NextResponse.json({ error: 'DB_ERROR', details: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
