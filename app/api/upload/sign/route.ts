import { NextRequest, NextResponse } from 'next/server'

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

export async function POST(req: NextRequest) {
  const { quote_id, filename, contentType } = await req.json()
  if (!quote_id || !filename) return NextResponse.json({ error: 'MISSING' }, { status: 400 })
  const safeName = sanitizeFilename(String(filename))
  const fileId = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) as string
  const path = `orders/${quote_id}/${fileId}-${safeName}`
  const url = `${process.env.BASE_URL || ''}/api/upload/put?path=${encodeURIComponent(path)}&type=${encodeURIComponent(contentType || 'application/octet-stream')}`
  return NextResponse.json({ path, url, headers: { 'Content-Type': contentType || 'application/octet-stream' } })
}
