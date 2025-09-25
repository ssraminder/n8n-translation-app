import { NextResponse } from 'next/server'
import { supabaseSrv } from '@/src/lib/supabase'
export async function POST() {
  const { data, error } = await supabaseSrv.from('quote_submissions').insert({ client_name: 'TBD', client_email: 'tbd@example.com' }).select('quote_id').single()
  if (error) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  return NextResponse.json({ quote_id: (data as any).quote_id })
}
