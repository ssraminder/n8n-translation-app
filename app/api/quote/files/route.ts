import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getEnv } from '@/src/lib/env'

export async function POST(req: NextRequest) {
  const { quote_id, files } = await req.json()
  if (!quote_id || !Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  }
  const supabaseUrl = process.env.SUPABASE_URL as string
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined
  const anonKey = process.env.SUPABASE_ANON_KEY as string
  const supabase = createClient(supabaseUrl, serviceKey || anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // Create signed URLs for each uploaded file and insert DB rows
  const rows: { quote_id: string; filename: string | null; storage_path: string; signed_url: string | null; bytes: number | null; content_type: string | null }[] = []
  for (const f of files as { path: string; contentType?: string; filename?: string; bytes?: number }[]) {
    const path = f.path
    if (!path) continue
    const { data: signed, error: signErr } = await supabase.storage.from('orders').createSignedUrl(path, 60 * 60 * 24 * 7)
    if (signErr) {
      return NextResponse.json({ error: 'SIGN_URL_ERROR', details: signErr.message }, { status: 500 })
    }
    rows.push({
      quote_id,
      filename: f.filename || null,
      storage_path: path,
      signed_url: signed?.signedUrl || null,
      bytes: typeof f.bytes === 'number' ? f.bytes : null,
      content_type: f.contentType || null,
    })
  }

  if (rows.length) {
    const { error: insertErr } = await supabase.from('quote_files').insert(rows)
    if (insertErr) {
      return NextResponse.json({ error: 'DB_ERROR_FILES', details: insertErr.message }, { status: 500 })
    }
  }

  const env = getEnv()
  if (env.N8N_WEBHOOK_URL) {
    try {
      const form = new FormData()
      form.append('quote_id', quote_id)
      form.append('event', 'files_uploaded')
      for (const r of rows) {
        const { data: blob, error: dlErr } = await supabase.storage.from('orders').download(r.storage_path)
        if (dlErr || !blob) continue
        const filename = r.filename || r.storage_path.split('/').pop() || 'upload.bin'
        // Ensure a Blob with correct type
        const ab = await blob.arrayBuffer()
        const typed = new Blob([ab], { type: r.content_type || 'application/octet-stream' })
        form.append('files', typed, filename)
      }
      await fetch(env.N8N_WEBHOOK_URL, { method: 'POST', body: form })
    } catch (_) {
      // Non-blocking failure
    }
  }

  return NextResponse.json({ ok: true })
}
