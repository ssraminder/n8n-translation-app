import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function PUT(req: NextRequest) {
  const url = new URL(req.url)
  const pathParam = url.searchParams.get('path')
  const type = url.searchParams.get('type') || 'application/octet-stream'
  if (!pathParam) return NextResponse.json({ error: 'MISSING_PATH' }, { status: 400 })
  const storagePath: string = pathParam
  const buf = await req.arrayBuffer()
  const supabaseUrl = process.env.SUPABASE_URL as string
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined
  const anonKey = process.env.SUPABASE_ANON_KEY as string
  const client = createClient(supabaseUrl, serviceKey || anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

  async function attemptUpload() {
    return client.storage.from('orders').upload(storagePath, Buffer.from(buf), { contentType: type, upsert: true })
  }

  let { error } = await attemptUpload()
  if (error) {
    const msg = (error.message || '').toLowerCase()
    const permission = msg.includes('permission') || msg.includes('unauthorized')
    const missingBucket = msg.includes('not found') || msg.includes('does not exist') || msg.includes('no such bucket')
    if (missingBucket && serviceKey) {
      try {
        await client.storage.createBucket('orders', { public: false })
        const retry = await attemptUpload()
        error = retry.error || null
      } catch (_) {
        // fallthrough to error handling
      }
    }
    if (error) {
      const status = permission ? 403 : 500
      return NextResponse.json({ error: 'UPLOAD_ERROR', details: error.message }, { status })
    }
  }
  return NextResponse.json({ ok: true, path: storagePath })
}
