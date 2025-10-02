import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getEnv } from '@/src/lib/env'
import { supabaseSrv } from '@/src/lib/supabase'

function jobIdFromQuote(id: string) {
  let h = 0 >>> 0
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0
  }
  const num = (h % 90000) + 10000
  return `CS${num}`
}

export async function POST(req: NextRequest) {
  const payload = await req.json()
  const { client_name, client_email, quote_id, files } = payload || {}
  if (!client_name || !client_email || !quote_id || !Array.isArray(files)) return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  const client = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string)
  const { data: quote, error: qErr } = await client.from('quote_submissions').update({ name: client_name, email: client_email, client_email, status: 'submitted' }).eq('quote_id', quote_id).select('quote_id').single()
  if (qErr) return NextResponse.json({ error: 'DB_ERROR', details: qErr.message }, { status: 500 })
  if (files.length) {
    const rows = files.map((f: any) => ({ quote_id, storage_path: f.path, content_type: f.contentType || null }))
    const { error: fErr } = await client.from('quote_files').insert(rows)
    if (fErr) return NextResponse.json({ error: 'DB_ERROR_FILES', details: fErr.message }, { status: 500 })
  }
  const env = getEnv()
  if (env.N8N_WEBHOOK_URL) {
    try {
      const { data: sub } = await client.from('quote_submissions').select('source_lang,target_lang,intended_use').eq('quote_id', quote_id).maybeSingle()
      const { data: res } = await client.from('quote_results').select('results_json').eq('quote_id', quote_id).maybeSingle()
      const payloadOut = {
        quote_id,
        job_id: jobIdFromQuote(quote_id),
        source_language: (sub as any)?.source_lang || '',
        target_language: (sub as any)?.target_lang || '',
        intended_use: (sub as any)?.intended_use || '',
        country_of_issue: (res as any)?.results_json?.country_of_issue || '',
      }
      // Fire webhook and await response (if any)
      const resp = await fetch(env.N8N_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payloadOut) })
      let result: any = null
      try { result = await resp.json() } catch {}

      // Update quote_submissions with info obtained
      const updates: Record<string, any> = {}
      if (result && typeof result.source_language === 'string') updates.source_lang = result.source_language
      if (result && typeof result.target_language === 'string') updates.target_lang = result.target_language
      if (result && typeof result.intended_use === 'string') updates.intended_use = result.intended_use
      if (result && typeof result.country_of_issue === 'string') updates.country_of_issue = result.country_of_issue
      if (Object.keys(updates).length) {
        await supabaseSrv.from('quote_submissions').update(updates).eq('quote_id', quote_id)
      }

      // Populate quote_sub_orders derived from results and webhook
      const documents: any[] = (res as any)?.results_json?.documents || []
      if (Array.isArray(documents) && documents.length) {
        // Remove existing rows for this quote
        await supabaseSrv.from('quote_sub_orders').delete().eq('quote_id', quote_id)

        const certCode = typeof result?.certification_type_code === 'string' ? result.certification_type_code : null
        const certName = typeof result?.certification_type_name === 'string' ? result.certification_type_name : null
        const certAmount = typeof result?.certification_amount === 'number' ? result.certification_amount : (typeof result?.certification_amount === 'string' ? Number(result.certification_amount) : null)

        function roundUpTo(value: number, step: number) {
          if (step <= 0) return value
          return Math.ceil(value / step) * step
        }

        const rows = documents.map((d: any) => {
          const label = d.document_type || d.filename || d.label || 'document'
          const pages = typeof d.pages === 'number' ? d.pages : (typeof d.billable_pages === 'number' ? d.billable_pages : 0)
          const tierMult = typeof d.language_multiplier === 'number' ? d.language_multiplier : (typeof d.language_tier_multiplier === 'number' ? d.language_tier_multiplier : 1)
          const unitBase = 65 * (tierMult || 1)
          const unit = roundUpTo(unitBase, 2.5)
          const amtPages = Number((pages * unit).toFixed(2))
          const certAmt = typeof certAmount === 'number' ? certAmount : 0
          const lineTotal = Number((amtPages + certAmt).toFixed(2))
          return {
            quote_id,
            document_label: label,
            billable_pages: Number(pages.toFixed(2)),
            language_tier_multiplier: Number((tierMult || 1).toFixed(3)),
            unit_rate: Number(unit.toFixed(2)),
            amount_pages: amtPages,
            certification_type_code: certCode,
            certification_type_name: certName,
            certification_amount: certAmt,
            line_total: lineTotal,
          }
        })

        if (rows.length) {
          await supabaseSrv.from('quote_sub_orders').insert(rows)
        }
      }
    } catch (_) {
      // ignore webhook failures
    }
  }
  return NextResponse.json({ ok: true, quote_id: quote!.quote_id })
}
