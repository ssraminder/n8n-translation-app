import { NextRequest, NextResponse } from 'next/server'
export async function POST(req: NextRequest) {
  const { quote_id, filename, contentType } = await req.json()
  if (!quote_id || !filename) return NextResponse.json({ error: 'MISSING' }, { status: 400 })
  const fileId = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) as string
  const path = `orders/${quote_id}/${fileId}-${filename}`
  const url = `${process.env.BASE_URL || ''}/api/upload/put?path=${encodeURIComponent(path)}&type=${encodeURIComponent(contentType || 'application/octet-stream')}`
  return NextResponse.json({ path, url, headers: { 'Content-Type': contentType || 'application/octet-stream' } })
}
