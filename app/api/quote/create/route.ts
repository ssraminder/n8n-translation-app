import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function generateCsId() {
  const n = Math.floor(Math.random() * 100000)
  const digits = String(n).padStart(5, '0')
  return `CS${digits}`
}

export async function POST() {
  const url = process.env.SUPABASE_URL as string
  const anon = process.env.SUPABASE_ANON_KEY as string
  const client = createClient(url, anon)

  let quote_id = generateCsId()
  let attempt = 0
  while (attempt < 10) {
    const { error } = await client
      .from('quote_submissions')
      .insert({ quote_id, name: '', email: '' })
    if (!error) return NextResponse.json({ quote_id })
    const msg = (error && (error as any).message) || ''
    const code = (error && (error as any).code) || ''
    if ((code && String(code) === '23505') || /duplicate/i.test(msg)) {
      attempt += 1
      quote_id = generateCsId()
      continue
    }
    return NextResponse.json({ error: 'DB_ERROR', details: msg || 'Unknown error' }, { status: 500 })
  }

  return NextResponse.json({ error: 'ID_GENERATION_FAILED' }, { status: 500 })
}
