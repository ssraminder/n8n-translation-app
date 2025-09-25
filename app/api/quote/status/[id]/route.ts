import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const client = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string)
  const { data, error } = await client.from('quote_submissions').select('status').eq('quote_id', params.id).single()
  if (error) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ stage: (data as any).status || 'unknown' })
}
