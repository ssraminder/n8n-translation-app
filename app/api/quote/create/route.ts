import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

function jobIdFromQuote(id: string) {
  let h = 0 >>> 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const num = (h % 90000) + 10000
  return `CS${num}`
}

export async function POST() {
  const url = process.env.SUPABASE_URL as string
  const service = (process.env.SUPABASE_SERVICE_ROLE_KEY as string) || (process.env.SUPABASE_ANON_KEY as string)
  const client = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })

  const quote_id = randomUUID()
  const job_id = jobIdFromQuote(quote_id)

  const insertRow = {
    quote_id,
    job_id,
    name: '',
    email: ''
  }

  const { error } = await client.from('quote_submissions').insert(insertRow)

  if (error) {
    console.error('QUOTE_CREATE_DB_ERROR', { details: (error as any)?.message, code: (error as any)?.code })
    const msg = (error as any)?.message || 'Unknown error'
    return NextResponse.json({ error: 'DB_ERROR', details: msg }, { status: 500 })
  }

  return NextResponse.json({ quote_id, job_id })
}
