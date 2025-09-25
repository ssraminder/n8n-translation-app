import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function PUT(req: NextRequest) {
  const url = new URL(req.url)
  const path = url.searchParams.get('path')
  const type = url.searchParams.get('type') || 'application/octet-stream'
  if (!path) return NextResponse.json({ error: 'MISSING_PATH' }, { status: 400 })
  const buf = await req.arrayBuffer()
  const client = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string)
  const { error } = await client.storage.from('orders').upload(path, Buffer.from(buf), { contentType: type, upsert: true })
  if (error) return NextResponse.json({ error: 'UPLOAD_ERROR', details: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, path })
}
