import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    let quote_id = url.searchParams.get('quote_id') || ''

    // If no quote_id, bootstrap via test/step1
    if (!quote_id) {
      const step1 = await fetch(`${url.origin}/api/test/step1`)
      if (!step1.ok) return NextResponse.json({ error: 'STEP1_FAILED', status: step1.status }, { status: 500 })
      const j = await step1.json()
      quote_id = j.quote_id
    }

    // Load languages and intended uses
    const [langsRes, usesRes] = await Promise.all([
      fetch(`${url.origin}/api/languages`),
      fetch(`${url.origin}/api/intended-uses`),
    ])
    if (!langsRes.ok) return NextResponse.json({ error: 'LANGS_FAILED', status: langsRes.status }, { status: 500 })
    if (!usesRes.ok) return NextResponse.json({ error: 'USES_FAILED', status: usesRes.status }, { status: 500 })
    const langs = (await langsRes.json()).languages as { id:number; name:string; iso_code?:string|null }[]
    const uses = (await usesRes.json()).intended_uses as { id:number; name:string }[]

    // Pick English -> Spanish (fallback to first two options)
    const english = langs.find(l => /english/i.test(l.name)) || langs[0]
    const spanish = langs.find(l => /spanish/i.test(l.name)) || langs[1] || langs[0]
    const use = uses.find(u => /immigration|official|government/i.test(u.name)) || uses[0]

    const payload = {
      quote_id,
      client_name: 'Test User',
      client_email: 'test@example.com',
      source_lang: english?.name || '',
      target_lang: spanish?.name || '',
      intended_use_id: use?.id || null,
      intended_use: use?.name || '',
      source_code: english?.iso_code || null,
      target_code: spanish?.iso_code || null,
      country: 'Canada',
      country_code: 'CA',
    }

    const save = await fetch(`${url.origin}/api/quote/update-client`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    if (!save.ok) {
      let info = ''
      try { const j = await save.json(); info = j?.details || j?.error || JSON.stringify(j) } catch { try { info = await save.text() } catch {} }
      return NextResponse.json({ error: 'UPDATE_FAILED', status: save.status, details: info, payload }, { status: 500 })
    }

    const dbg = await fetch(`${url.origin}/api/quote/debug-suborders?quote_id=${encodeURIComponent(quote_id)}`)
    const debugJson = dbg.ok ? await dbg.json() : { error: 'DEBUG_FETCH_FAILED', status: dbg.status }

    return NextResponse.json({ ok: true, quote_id, payload, debug: debugJson })
  } catch (e: any) {
    return NextResponse.json({ error: 'UNEXPECTED', details: e?.message || String(e) }, { status: 500 })
  }
}
