import { NextRequest, NextResponse } from 'next/server'

function jobIdFromQuote(id: string) {
  let h = 0 >>> 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const num = (h % 90000) + 10000
  return `CS${num}`
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const p = url.searchParams

    const quote_id = p.get('quote_id') || ''
    if (!quote_id) return NextResponse.json({ error: 'MISSING_QUOTE_ID' }, { status: 400 })

    const job_id = p.get('job_id') || jobIdFromQuote(quote_id)
    const source_language = p.get('source_language') || ''
    const target_language = p.get('target_language') || ''
    const intended_use_id = p.get('intended_use_id') ? Number(p.get('intended_use_id')) : null
    const source_code = p.get('source_code') || null
    const target_code = p.get('target_code') || null
    const country = p.get('country') || ''
    const country_code = p.get('country_code') || null

    const tier = p.get('tier') || null
    const tier_multiplier = p.get('tier_multiplier') ? Number(p.get('tier_multiplier')) : null
    const cert_type_name = p.get('cert_type_name') || null
    const cert_type_rate = p.get('cert_type_rate') ? Number(p.get('cert_type_rate')) : null

    const overrideWebhook = p.get('webhook')
    const webhook = overrideWebhook || process.env.N8N_STEP3_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL
    if (!webhook) return NextResponse.json({ error: 'WEBHOOK_NOT_CONFIGURED' }, { status: 500 })

    const payloadOut = {
      event: 'quote_updated',
      quote_id,
      job_id,
      source_language,
      target_language,
      intended_use_id,
      source_code,
      target_code,
      country,
      country_code,
      tier,
      tier_multiplier,
      cert_type_name,
      cert_type_rate,
    }

    await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payloadOut),
    }).catch(() => {})

    return NextResponse.json({ ok: true, webhook, payload: payloadOut })
  } catch (e: any) {
    return NextResponse.json({ error: 'UNEXPECTED', details: e?.message || String(e) }, { status: 500 })
  }
}
