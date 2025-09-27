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

export async function POST(req: NextRequest) {
  const payload = await req.json()
  const { quote_id, files } = payload || {}
  const source_lang: string | null = payload?.source_lang ?? null
  const target_lang: string | null = payload?.target_lang ?? null
  const intended_use_id: number | null = typeof payload?.intended_use_id === 'number' ? payload.intended_use_id : (typeof payload?.intended_use_id === 'string' ? parseInt(payload.intended_use_id, 10) : null)
  const country_of_issue: string | null = payload?.country_of_issue ?? null
  if (!quote_id || !Array.isArray(files) || files.length === 0) return NextResponse.json({ error: 'INVALID' }, { status: 400 })

  const supabaseUrl = process.env.SUPABASE_URL as string
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined
  const anonKey = process.env.SUPABASE_ANON_KEY as string
  const supabase = createClient(supabaseUrl, serviceKey || anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const env = getEnv()
  const maxBytes = (env.MAX_UPLOAD_MB || 50) * 1024 * 1024
  const totalBytes = (files as { bytes?: number }[]).reduce((acc, f) => acc + (typeof f.bytes === 'number' ? f.bytes : 0), 0)
  if (totalBytes > maxBytes) return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE', details: `Total files must be <= ${env.MAX_UPLOAD_MB} MB` }, { status: 400 })

  const upload_session_id = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) as string
  const job_id = jobIdFromQuote(quote_id)

  const rows: any[] = []
  for (const f of files as { path: string; contentType?: string; filename?: string; bytes?: number }[]) {
    const path = f.path
    if (!path) continue
    const { data: signed, error: signErr } = await supabase.storage.from('orders').createSignedUrl(path, 60 * 60 * 24 * 7)
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

  if (rows.length === 0) return NextResponse.json({ error: 'NO_VALID_FILES' }, { status: 400 })

  const { error: insertErr } = await supabase.from('quote_files').insert(rows)
  if (insertErr) return NextResponse.json({ error: 'DB_ERROR_FILES', details: insertErr.message }, { status: 500 })

  let webhook = 'skipped'
  if (env.N8N_WEBHOOK_URL) {
    try {
      await fetch(env.N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quote_id, job_id }),
      })
      webhook = 'ok'
    } catch (_) {
      webhook = 'failed'
    }
  }

  return NextResponse.json({ ok: true, webhook })
}
