import { NextRequest, NextResponse } from 'next/server'
import { supabaseSrv } from '@/src/lib/supabase'
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabaseSrv.from('quote_submissions').select('status').eq('quote_id', params.id).single()
  if (error) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ stage: (data as any).status || 'unknown' })
}
