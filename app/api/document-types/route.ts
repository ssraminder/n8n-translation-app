import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const url = process.env.SUPABASE_URL as string
  const anon = process.env.SUPABASE_ANON_KEY as string
  if (!url || !anon) return NextResponse.json({ error: 'MISSING_ENV' }, { status: 500 })
  const client = createClient(url, anon)
  const { data, error } = await client.from('document_types').select('id,name').order('name', { ascending: true })
  if (error) return NextResponse.json({ error: 'DB_ERROR', details: error.message }, { status: 500 })
  return NextResponse.json({ document_types: data || [] })
}
