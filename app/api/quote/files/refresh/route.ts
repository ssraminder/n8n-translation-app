import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getEnv } from '@/src/lib/env'

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

export async function POST(req: NextRequest) {
  const { quote_id } = await req.json()
  if (!quote_id || !isUuid(String(quote_id))) return NextResponse.json({ error: 'INVALID_QUOTE_ID' }, { status: 400 })

  const env = getEnv()
  const ttl = Number(env.SIGNED_URL_TTL_SECS || 1209600)

  const supabaseUrl = process.env.SUPABASE_URL as string
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined
  if (!serviceKey) return NextResponse.json({ error: 'SERVER_MISCONFIG', details: 'Missing service role key' }, { status: 500 })
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: rows, error: selErr } = await supabase
    .from('quote_files')
    .select('id,storage_key')
    .eq('quote_id', quote_id)
  if (selErr) return NextResponse.json({ error: 'DB_ERROR', details: selErr.message }, { status: 500 })

  const updates: { id: number; file_url: string | null; file_url_expires_at: string }[] = []

  for (const r of rows || []) {
    const path = (r as any).storage_key
    if (!path) continue
    const { data: signed, error: signErr } = await supabase.storage.from('orders').createSignedUrl(path, ttl)
    if (signErr) return NextResponse.json({ error: 'SIGN_URL_ERROR', details: signErr.message }, { status: 500 })
    updates.push({ id: (r as any).id, file_url: signed?.signedUrl || null, file_url_expires_at: new Date(Date.now() + ttl * 1000).toISOString() })
  }

  if (updates.length) {
    const { error: upErr } = await supabase.from('quote_files').upsert(updates, { onConflict: 'id' })
    if (upErr) return NextResponse.json({ error: 'DB_UPDATE_ERROR', details: upErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, refreshed: updates.length })
}
