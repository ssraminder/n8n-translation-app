import { NextRequest, NextResponse } from 'next/server'
import { supabaseSrv } from '@/src/lib/supabase'
export async function POST(req: NextRequest) {
  const { quote_id, delivery_option_id, delivery_eta_date } = await req.json()
  if (!quote_id || !delivery_option_id) return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  const { error } = await supabaseSrv.from('quote_submissions').update({ delivery_option_id, delivery_eta_date: delivery_eta_date || null }).eq('quote_id', quote_id)
  if (error) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
