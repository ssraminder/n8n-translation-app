import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getEnv } from '@/src/lib/env'

function jobIdFromQuote(id: string) {
  let h = 0 >>> 0
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0
  }
  const num = (h % 90000) + 10000
  return `CS${num}`
}

export async function POST(req: NextRequest) {
  const { quote_id } = await req.json()
  if (!quote_id) return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  const client = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string)
  const { error } = await client.from('quote_submissions').update({ hitl_required: true }).eq('quote_id', quote_id)
  if (error) return NextResponse.json({ error: 'DB_ERROR', details: error.message }, { status: 500 })
  const env = getEnv()
  if (env.N8N_WEBHOOK_URL) {
    try {
      const { data: sub } = await client.from('quote_submissions').select('source_lang,target_lang,intended_use').eq('quote_id', quote_id).maybeSingle()
      const { data: res } = await client.from('quote_results').select('results_json').eq('quote_id', quote_id).maybeSingle()
      const payload = {
        quote_id,
        hitl_requested: true,
        job_id: jobIdFromQuote(quote_id),
        source_language: (sub as any)?.source_lang || '',
        target_language: (sub as any)?.target_lang || '',
        intended_use: (sub as any)?.intended_use || '',
        country_of_issue: (res as any)?.results_json?.country_of_issue || '',
      }
      fetch(env.N8N_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).catch(()=>{})
    } catch (_) {
      // ignore
    }
  }
  return NextResponse.json({ ok: true })
}
