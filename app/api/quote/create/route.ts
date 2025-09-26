import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

export async function POST() {
  const url = process.env.SUPABASE_URL as string
  const anon = process.env.SUPABASE_ANON_KEY as string
  const client = createClient(url, anon)

  const quote_id = randomUUID()
  const { error } = await client
    .from('quote_submissions')
    .insert({ quote_id, name: '', email: '' })

  if (error) {
    const msg = (error as any)?.message || 'Unknown error'
    return NextResponse.json({ error: 'DB_ERROR', details: msg }, { status: 500 })
  }

  return NextResponse.json({ quote_id })
}
