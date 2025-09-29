import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getEnv, ALLOWED_FILE_TYPES, ALLOWED_EXTENSIONS } from '@/src/lib/env'

function sanitizeFilename(name: string) {
  const trimmed = (name || '').trim()
  const idx = trimmed.lastIndexOf('.')
  const ext = idx > -1 ? trimmed.slice(idx) : ''
  const base = idx > -1 ? trimmed.slice(0, idx) : trimmed
  const safeBase = base.replace(/[^a-zA-Z0-9 _.-]/g, '_')
  const maxBaseLen = 80
  const shortBase = safeBase.length > maxBaseLen ? safeBase.slice(0, maxBaseLen) : safeBase
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '')
  const candidate = `${shortBase}${safeExt}`
  return candidate.length ? candidate : 'upload.bin'
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

export async function POST(req: NextRequest) {
  const { quote_id, filename, contentType, bytes } = await req.json()
  if (!quote_id || !filename || !contentType || typeof bytes !== 'number') {
    return NextResponse.json({ error: 'MISSING' }, { status: 400 })
  }
  if (!isUuid(String(quote_id))) return NextResponse.json({ error: 'INVALID_QUOTE_ID' }, { status: 400 })

  const env = getEnv()
  const ext = (filename.includes('.') ? `.${filename.split('.').pop()}` : '').toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_FILE_TYPES.has(contentType)) {
    return NextResponse.json({ error: 'UNSUPPORTED' }, { status: 400 })
  }
  const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024
  if (bytes > maxBytes) {
    return NextResponse.json({ error: 'TOO_LARGE', details: `Max ${env.MAX_UPLOAD_MB} MB` }, { status: 400 })
  }

  const safeName = encodeURIComponent(sanitizeFilename(String(filename)))
  const fileId = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) as string
  const path = `${quote_id}/${fileId}__${safeName}`

  const supabaseUrl = process.env.SUPABASE_URL as string
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined
  if (!serviceKey) return NextResponse.json({ error: 'SERVER_MISCONFIG', details: 'Missing service role key' }, { status: 500 })
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  let { data, error } = await supabase.storage.from('orders').createSignedUploadUrl(path)
  if (error) {
    const msg = (error.message || '').toLowerCase()
    const missingBucket = msg.includes('not found') || msg.includes('does not exist') || msg.includes('no such bucket')
    if (missingBucket) {
      try {
        await supabase.storage.createBucket('orders', { public: false })
        const retry = await supabase.storage.from('orders').createSignedUploadUrl(path)
        data = retry.data
        error = retry.error as any
      } catch (_) {
        // fallthrough
      }
    }
  }
  if (error || !data?.signedUrl) {
    const origin = new URL(req.url).origin
    const directUrl = `${origin}/api/upload/put?path=${encodeURIComponent(path)}&type=${encodeURIComponent(contentType)}`
    return NextResponse.json({ path, url: directUrl, headers: { 'content-type': contentType } })
  }

  return NextResponse.json({ path, url: data?.signedUrl, headers: { 'x-upsert': 'false', 'content-type': contentType } })
}
