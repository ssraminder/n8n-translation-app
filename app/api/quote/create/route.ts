import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export async function POST() {
  const url = process.env.SUPABASE_URL as string
  const anon = process.env.SUPABASE_ANON_KEY as string
  const client = createClient(url, anon)
  const quote_id = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) as string
  const { error } = await client
    .from('quote_submissions')
    .insert({ quote_id, name: '', email: '' })
  if (error) return NextResponse.json({ error: 'DB_ERROR', details: error.message }, { status: 500 })
  return NextResponse.json({ quote_id })
}
