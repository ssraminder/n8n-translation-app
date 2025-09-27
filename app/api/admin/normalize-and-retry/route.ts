import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

function jobIdFromQuote(id: string) {
  let h = 0 >>> 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const num = (h % 90000) + 10000
  return `CS${num}`
}

export async function POST(req: NextRequest) {
  const { quote_id, job_id: providedJob } = await req.json()
  if (!quote_id || !isUuid(String(quote_id))) return NextResponse.json({ error: 'INVALID_QUOTE_ID' }, { status: 400 })

  const supabaseUrl = process.env.SUPABASE_URL as string
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined
  if (!serviceKey) return NextResponse.json({ error: 'SERVER_MISCONFIG', details: 'Missing service role key' }, { status: 500 })
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const ttl = Number(process.env.SIGNED_URL_TTL_SECS || 1209600)

  // Fetch rows for this quote
  const { data: rows, error: selErr } = await supabase
    .from('quote_files')
    .select('id, storage_key, file_url, file_url_expires_at')
    .eq('quote_id', quote_id)
  if (selErr) return NextResponse.json({ error: 'DB_ERROR', details: selErr.message }, { status: 500 })

  const toUpdate: { id: number; storage_key: string; storage_path: string; file_url: string | null; file_url_expires_at: string }[] = []

  for (const r of rows || []) {
    const current = (r as any).storage_key as string | null
    if (!current) continue
    const normalized = current.replace(/^orders\//, '')
    let changed = normalized !== current
    const { data: signed, error: signErr } = await supabase.storage.from('orders').createSignedUrl(normalized, ttl)
    if (signErr) return NextResponse.json({ error: 'SIGN_URL_ERROR', details: signErr.message }, { status: 500 })
    const exp = new Date(Date.now() + ttl * 1000).toISOString()
    toUpdate.push({ id: (r as any).id, storage_key: normalized, storage_path: normalized, file_url: signed?.signedUrl || null, file_url_expires_at: exp })
  }

  if (toUpdate.length) {
    const { error: upErr } = await supabase.from('quote_files').upsert(toUpdate, { onConflict: 'id' })
    if (upErr) return NextResponse.json({ error: 'DB_UPDATE_ERROR', details: upErr.message }, { status: 500 })
  }

  const job_id = providedJob || jobIdFromQuote(quote_id)
  let webhook = 'skipped'
  if (process.env.N8N_WEBHOOK_URL) {
    try {
      const res = await fetch(process.env.N8N_WEBHOOK_URL, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quote_id, job_id })
      })
      webhook = res.ok ? 'ok' : `http_${res.status}`
    } catch (e: any) {
      webhook = 'failed'
    }
  }

  return NextResponse.json({ ok: true, updated: toUpdate.length, webhook })
}
