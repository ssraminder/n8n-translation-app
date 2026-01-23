import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function jobIdFromQuote(id: string) {
  let h = 0 >>> 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const num = (h % 90000) + 10000
  return `CS${num}`
}

function uuid() { return (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) as string }

export async function GET(req: NextRequest) {
  const url = process.env.SUPABASE_URL as string
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined
  if (!serviceKey) return NextResponse.json({ error: 'SERVER_MISCONFIG' }, { status: 500 })
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // 1) Create quote_submissions row
  const quote_id = uuid()
  const job_id = jobIdFromQuote(quote_id)
  const { error: insErr } = await supabase.from('quote_submissions').insert({ quote_id, job_id, name: '', email: '' })
  if (insErr) return NextResponse.json({ error: 'DB_INSERT_QUOTE', details: insErr.message }, { status: 500 })

  // 2) Upload a small dummy PDF to storage
  try { await supabase.storage.createBucket('orders', { public: false }) } catch {}
  const storage_key = `${quote_id}/${uuid()}__dummy.pdf`
  const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF')
  const up = await supabase.storage.from('orders').upload(storage_key, pdfBytes, { contentType: 'application/pdf', upsert: true })
  if (up.error) return NextResponse.json({ error: 'STORAGE_UPLOAD_FAILED', details: up.error.message }, { status: 500 })

  // 3) Create signed URL and insert into quote_files (simulate /api/quote/files)
  const ttl = 60 * 60 // 1 hour
  const { data: signed, error: signErr } = await supabase.storage.from('orders').createSignedUrl(storage_key, ttl)
  if (signErr) return NextResponse.json({ error: 'SIGN_URL_ERROR', details: signErr.message }, { status: 500 })
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString()

  const row = {
    quote_id,
    job_id,
    file_id: uuid(),
    filename: 'dummy.pdf',
    storage_key,
    file_url: signed?.signedUrl || null,
    file_url_expires_at: expiresAt,
    status: 'uploaded',
    upload_session_id: uuid(),
    storage_path: storage_key,
    signed_url: signed?.signedUrl || null,
    bytes: pdfBytes.length,
    content_type: 'application/pdf',
  }
  const { error: fErr } = await supabase.from('quote_files').upsert([row])
  if (fErr) return NextResponse.json({ error: 'DB_ERROR_FILES', details: fErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, quote_id, job_id, storage_key })
}
