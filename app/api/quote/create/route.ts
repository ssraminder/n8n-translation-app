import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export async function POST() {
  const url = process.env.SUPABASE_URL as string
  const anon = process.env.SUPABASE_ANON_KEY as string
  const client = createClient(url, anon)
  const { data, error } = await client.from('quote_submissions').insert({ client_name: 'TBD', client_email: 'tbd@example.com' }).select('quote_id').single()
  if (error) return NextResponse.json({ error: 'DB_ERROR', details: error.message }, { status: 500 })
  return NextResponse.json({ quote_id: (data as any).quote_id })
}
