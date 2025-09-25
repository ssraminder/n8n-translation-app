import { NextRequest, NextResponse } from 'next/server'
import { supabaseSrv } from '@/src/lib/supabase'
import { getEnv } from '@/src/lib/env'
export async function POST(req: NextRequest) {
  const { quote_id } = await req.json()
  if (!quote_id) return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  const { error } = await supabaseSrv.from('quote_submissions').update({ hitl_requested: true }).eq('quote_id', quote_id)
  if (error) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  const env = getEnv()
  if (env.N8N_WEBHOOK_URL) { fetch(env.N8N_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ quote_id, hitl_requested: true }) }).catch(()=>{}) }
  return NextResponse.json({ ok: true })
}
