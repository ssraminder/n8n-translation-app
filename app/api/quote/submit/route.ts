import { NextRequest, NextResponse } from 'next/server'
import { supabaseSrv } from '@/src/lib/supabase'
import { getEnv } from '@/src/lib/env'
export async function POST(req: NextRequest) {
  const payload = await req.json()
  const { client_name, client_email, quote_id, files } = payload || {}
  if (!client_name || !client_email || !quote_id || !Array.isArray(files)) return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  const { data: quote, error: qErr } = await supabaseSrv.from('quote_submissions').update({ client_name, client_email, status: 'submitted' }).eq('quote_id', quote_id).select('quote_id').single()
  if (qErr) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  if (files.length) {
    const rows = files.map((f: any) => ({ quote_id, path: f.path, content_type: f.contentType || null }))
    const { error: fErr } = await supabaseSrv.from('quote_files').insert(rows)
    if (fErr) return NextResponse.json({ error: 'DB_ERROR_FILES' }, { status: 500 })
  }
  const env = getEnv()
  if (env.N8N_WEBHOOK_URL) { fetch(env.N8N_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quote_id }) }).catch(()=>{}) }
  return NextResponse.json({ ok: true, quote_id: quote!.quote_id })
}
