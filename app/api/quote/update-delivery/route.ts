import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export async function POST(req: NextRequest) {
  const { quote_id, delivery_option_id, delivery_eta_date } = await req.json()
  if (!quote_id || !delivery_option_id) return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  const client = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string)
  const { error } = await client.from('quote_submissions').update({ delivery_option_id, delivery_eta_date: delivery_eta_date || null }).eq('quote_id', quote_id)
  if (error) return NextResponse.json({ error: 'DB_ERROR', details: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
