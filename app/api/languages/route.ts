import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const url = process.env.SUPABASE_URL as string
  const anon = process.env.SUPABASE_ANON_KEY as string
  if (!url || !anon) return NextResponse.json({ error: 'MISSING_ENV' }, { status: 500 })
  const client = createClient(url, anon)

  // Select all columns to avoid column mismatch errors across schemas, then normalize
  const { data, error } = await client.from('languages').select('*')
  if (error) return NextResponse.json({ error: 'DB_ERROR', details: error.message }, { status: 500 })

  const rows = (data || []).map((r: any) => {
    const name: string = r.name ?? r.label ?? r.language ?? r.display_name ?? r.title ?? String(r.id)
    const iso_code: string | null = r.iso_code ?? r.iso ?? r.code ?? r.lang_code ?? null
    return { id: r.id, name, iso_code }
  })

  rows.sort((a, b) => a.name.localeCompare(b.name))
  return NextResponse.json({ languages: rows })
}
