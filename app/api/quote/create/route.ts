import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

export async function POST() {
  const url = process.env.SUPABASE_URL as string
  const service = (process.env.SUPABASE_SERVICE_ROLE_KEY as string) || (process.env.SUPABASE_ANON_KEY as string)
  const client = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })

  const quote_id = randomUUID()

  const insertRow = {
    quote_id,
    client_name: '',
    client_email: '',
    source_lang: '',
    target_lang: '',
    intended_use: ''
  }

  const { error } = await client.from('quote_submissions').insert(insertRow)

  if (error) {
    const msg = (error as any)?.message || 'Unknown error'
    return NextResponse.json({ error: 'DB_ERROR', details: msg }, { status: 500 })
  }

  return NextResponse.json({ quote_id })
}
