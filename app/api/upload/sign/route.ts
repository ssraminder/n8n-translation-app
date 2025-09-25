import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export async function POST(req: NextRequest) {
  const { quote_id, filename, contentType } = await req.json()
  if (!quote_id || !filename) return NextResponse.json({ error: 'MISSING' }, { status: 400 })
  const supa = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string)
  const fileId = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) as string
  const path = `orders/${quote_id}/${fileId}-${filename}`
  const { data, error } = await supa.storage.from('orders').createSignedUploadUrl(path)
  if (error || !data) return NextResponse.json({ error: 'SIGN_ERROR' }, { status: 500 })
  return NextResponse.json({ path, url: data.signedUrl, headers: { 'Content-Type': contentType || 'application/octet-stream' } })
}
