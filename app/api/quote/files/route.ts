import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getEnv } from '@/src/lib/env'

function trimName(name: string | null | undefined) {
  if (!name) return null
  const trimmed = name.trim()
  const idx = trimmed.lastIndexOf('.')
  const ext = idx > -1 ? trimmed.slice(idx) : ''
  const base = idx > -1 ? trimmed.slice(0, idx) : trimmed
  const safeBase = base.replace(/[^a-zA-Z0-9 _.-]/g, '_')
  const maxBaseLen = 80
  const shortBase = safeBase.length > maxBaseLen ? safeBase.slice(0, maxBaseLen) : safeBase
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '')
  const candidate = `${shortBase}${safeExt}`
  return candidate.length ? candidate : null
}

function jobIdFromQuote(id: string) {
  let h = 0 >>> 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const num = (h % 90000) + 10000
  return `CS${num}`
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

export async function POST(req: NextRequest) {
  const payload = await req.json()
  const { quote_id, files, idempotency_key } = payload || {}
  const source_lang: string | null = payload?.source_lang ?? null
  const target_lang: string | null = payload?.target_lang ?? null
  const intended_use_id: number | null = typeof payload?.intended_use_id === 'number' ? payload.intended_use_id : (typeof payload?.intended_use_id === 'string' ? parseInt(payload.intended_use_id, 10) : null)
  const country_of_issue: string | null = payload?.country_of_issue ?? null

  if (!quote_id || !isUuid(String(quote_id))) return NextResponse.json({ error: 'INVALID_QUOTE_ID', message: 'quote_id must be a UUID' }, { status: 400 })
  if (!Array.isArray(files) || files.length === 0) return NextResponse.json({ error: 'NO_FILES', message: 'At least one file is required' }, { status: 400 })

  const supabaseUrl = process.env.SUPABASE_URL as string
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined
  if (!serviceKey) return NextResponse.json({ error: 'SERVER_MISCONFIG', message: 'Missing service role key' }, { status: 500 })
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const env = getEnv()
  const maxBytes = (env.MAX_UPLOAD_MB || 50) * 1024 * 1024
  const totalBytes = (files as { bytes?: number }[]).reduce((acc, f) => acc + (typeof f.bytes === 'number' ? f.bytes : 0), 0)
  if (totalBytes > maxBytes) return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE', details: `Total files must be <= ${env.MAX_UPLOAD_MB} MB` }, { status: 400 })

  // Idempotency session handling
  let upload_session_id: string
  if (idempotency_key) {
    const { data: existing } = await supabase
      .from('quote_upload_sessions')
      .select('upload_session_id')
      .eq('idempotency_key', idempotency_key)
      .maybeSingle()
    if (existing?.upload_session_id) {
      upload_session_id = existing.upload_session_id
    } else {
      const newId = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) as string
      const { data: created, error: sessErr } = await supabase
        .from('quote_upload_sessions')
        .insert({ quote_id, idempotency_key, upload_session_id: newId })
        .select('upload_session_id')
        .single()
      if (sessErr) return NextResponse.json({ error: 'SESSION_CREATE_FAILED', details: sessErr.message }, { status: 500 })
      upload_session_id = created.upload_session_id
    }
  } else {
    upload_session_id = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) as string
  }

  const job_id = jobIdFromQuote(quote_id)
  if (!job_id) return NextResponse.json({ error: 'JOB_ID_ERROR' }, { status: 500 })

  const ttl = Number(env.SIGNED_URL_TTL_SECS || 1209600)
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString()

  const rows: any[] = []
  for (const f of files as { path: string; contentType?: string; filename?: string; bytes?: number }[]) {
    const path = f.path
    if (!path) return NextResponse.json({ error: 'MISSING_PATH', message: 'File path missing' }, { status: 400 })
    const { data: signed, error: signErr } = await supabase.storage.from('orders').createSignedUrl(path, ttl)
    if (signErr) return NextResponse.json({ error: 'SIGN_URL_ERROR', details: signErr.message }, { status: 500 })

    const file_id = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) as string
    const filename = trimName(f.filename) || (path.split('/').pop() || 'upload.bin')
    const storage_key = path
    const file_url = signed?.signedUrl || null

    rows.push({
      quote_id,
      job_id,
      file_id,
      filename,
      storage_key,
      file_url,
      file_url_expires_at: expiresAt,
      source_lang,
      target_lang,
      intended_use_id,
      country_of_issue,
      status: 'uploaded',
      upload_session_id,
      // Back-compat fields
      storage_path: path,
      signed_url: signed?.signedUrl || null,
      bytes: typeof f.bytes === 'number' ? f.bytes : null,
      content_type: f.contentType || null,
    })
  }

  // Upsert to avoid duplicates across retries; if unique index missing, fallback to selective insert
  const { error: upsertErr } = await supabase
    .from('quote_files')
    .upsert(rows, { onConflict: 'quote_id,storage_key', ignoreDuplicates: true })

  if (upsertErr && /no unique|exclusion constraint/i.test(upsertErr.message || '')) {
    const keys = rows.map(r => r.storage_key)
    const { data: existing, error: selErr } = await supabase
      .from('quote_files')
      .select('storage_key')
      .eq('quote_id', quote_id)
      .in('storage_key', keys)
    if (selErr) return NextResponse.json({ error: 'DB_ERROR_FILES', details: selErr.message }, { status: 500 })
    const existingSet = new Set((existing || []).map((r: any) => r.storage_key))
    const toInsert = rows.filter(r => !existingSet.has(r.storage_key))
    if (toInsert.length) {
      const { error: insErr } = await supabase.from('quote_files').insert(toInsert)
      if (insErr) return NextResponse.json({ error: 'DB_ERROR_FILES', details: insErr.message }, { status: 500 })
    }
  } else if (upsertErr) {
    return NextResponse.json({ error: 'DB_ERROR_FILES', details: upsertErr.message }, { status: 500 })
  }

  // Minimal webhook with correlation IDs; one retry on failure
  let webhook = 'skipped'
  if (env.N8N_WEBHOOK_URL) {
    const body = JSON.stringify({ quote_id, job_id })
    try {
      const res = await fetch(env.N8N_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      webhook = 'ok'
    } catch (err: any) {
      console.error('WEBHOOK_FAILED', { quote_id, job_id, upload_session_id, error: err?.message })
      webhook = 'failed'
      setTimeout(() => {
        fetch(env.N8N_WEBHOOK_URL!, { method: 'POST', headers: { 'content-type': 'application/json' }, body }).catch(() => {})
      }, 3000)
    }
  }

  return NextResponse.json({ ok: true, webhook, upload_session_id })
}
