import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const { quote_id, client_name, client_email } = await req.json()
  if (!quote_id || !client_name || !client_email) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  }
  const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string)
  const { error } = await supabase
    .from('quote_submissions')
    .update({ name: client_name, email: client_email, status: 'submitted' })
    .eq('quote_id', quote_id)
  if (error) return NextResponse.json({ error: 'DB_ERROR', details: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
