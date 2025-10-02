import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function roundUpTo(value: number, step: number) {
  return step > 0 ? Math.ceil(value / step) * step : value
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const quote_id = searchParams.get('quote_id') || ''
  if (!quote_id) return NextResponse.json({ error: 'MISSING_QUOTE_ID' }, { status: 400 })

  const supabaseUrl = process.env.SUPABASE_URL as string
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined
  const anonKey = process.env.SUPABASE_ANON_KEY as string
  const supabase = createClient(supabaseUrl, serviceKey || anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // Load submission basics
  const { data: sub } = await supabase
    .from('quote_submissions')
    .select('source_lang,target_lang,intended_use,country_of_issue,intended_use_id,source_code,target_code,country_code')
    .eq('quote_id', quote_id)
    .maybeSingle()

  // Load results documents (if any)
  const { data: res } = await supabase
    .from('quote_results')
    .select('results_json')
    .eq('quote_id', quote_id)
    .maybeSingle()

  // Resolve base rate
  let baseRate = 40
  try {
    const { data: settings } = await supabase.from('app_settings').select('base_rate').maybeSingle()
    if (settings?.base_rate !== null && settings?.base_rate !== undefined) {
      const val = Number(settings.base_rate)
      if (Number.isFinite(val)) baseRate = val
    }
  } catch {}

  const source_lang = (sub as any)?.source_lang || ''
  const target_lang = (sub as any)?.target_lang || ''
  const intended_use: string | undefined = (sub as any)?.intended_use || undefined
  const intended_use_id: number | undefined = typeof (sub as any)?.intended_use_id === 'number' ? (sub as any)?.intended_use_id : undefined
  const source_code: string | undefined = (sub as any)?.source_code || undefined
  const target_code: string | undefined = (sub as any)?.target_code || undefined
  const country: string | undefined = (sub as any)?.country_of_issue || undefined
  const country_code: string | undefined = (sub as any)?.country_code || undefined

  async function resolveLangTierFlexible(code?: string, name?: string) {
    const orParts: string[] = []
    if (code && code.trim()) {
      const c = code.trim()
      orParts.push(`code.eq.${c}`, `iso_code.eq.${c}`, `lang_code.eq.${c}`)
    }
    if (name && name.trim()) {
      const n = name.trim()
      orParts.push(`name.eq.${n}`, `label.eq.${n}`, `language.eq.${n}`, `title.eq.${n}`)
    }
    if (orParts.length === 0) return null as any
    const { data: langRow } = await supabase
      .from('languages')
      .select('*')
      .or(orParts.join(','))
      .limit(1)
      .maybeSingle()
    if (!langRow) return null as any
    const tid: number | null = typeof (langRow as any).tier_id === 'number' ? (langRow as any).tier_id : null
    const tname: string | null = (langRow as any).tier_name || (langRow as any).tier || null
    const directMult: number | null = typeof (langRow as any).multiplier === 'number' ? (langRow as any).multiplier : null
    if (directMult !== null) return { name: tname, multiplier: directMult }
    if (tid !== null) {
      const { data: tierRow } = await supabase
        .from('tiers')
        .select('name,multiplier')
        .eq('id', tid)
        .maybeSingle()
      if (tierRow) return tierRow as any
    }
    if (tname) {
      const { data: tierRowByName } = await supabase
        .from('tiers')
        .select('name,multiplier')
        .eq('name', tname)
        .maybeSingle()
      if (tierRowByName) return tierRowByName as any
      return { name: tname, multiplier: null as any }
    }
    return null as any
  }

  let tier_name: string | null = null
  let tier_multiplier: number | null = null
  try {
    const src = await resolveLangTierFlexible(source_code, source_lang)
    const tgt = await resolveLangTierFlexible(target_code, target_lang)
    const cand: { name: string | null; multiplier: number | null }[] = []
    if (src) cand.push({ name: (src as any).name ?? null, multiplier: typeof (src as any).multiplier === 'number' ? (src as any).multiplier : null })
    if (tgt) cand.push({ name: (tgt as any).name ?? null, multiplier: typeof (tgt as any).multiplier === 'number' ? (tgt as any).multiplier : null })
    if (cand.length) {
      let chosen = cand[0]
      for (const c of cand.slice(1)) {
        const m0 = Number(chosen.multiplier ?? 0)
        const m1 = Number(c.multiplier ?? 0)
        if (m1 > m0) chosen = c
      }
      if (cand.length === 2 && (cand[0].multiplier === cand[1].multiplier) && cand[0].name && cand[0].name === cand[1].name) {
        tier_name = cand[0].name
        tier_multiplier = cand[0].multiplier
      } else {
        tier_name = chosen.name
        tier_multiplier = chosen.multiplier
      }
    }
  } catch {}

  let cert_type_name: string | null = null
  let cert_type_code: string | null = null
  let cert_type_rate: number | null = null
  try {
    if (typeof intended_use_id === 'number') {
      const { data: mapRow } = await supabase
        .from('intended_use_cert_map')
        .select('cert_type_id')
        .eq('intended_use_id', intended_use_id)
        .maybeSingle()
      if (mapRow && typeof (mapRow as any).cert_type_code === 'string' && (mapRow as any).cert_type_code.trim()) {
        cert_type_code = ((mapRow as any).cert_type_code as string).trim()
      }
      const certTypeId: number | string | null = mapRow ? ((mapRow as any).cert_type_id ?? (mapRow as any).cert_type ?? null) : null
      if (certTypeId !== null) {
        if (typeof certTypeId === 'number') {
          const { data: cert } = await supabase
            .from('cert_types')
            .select('id,name,pricing_type,amount')
            .eq('id', certTypeId)
            .maybeSingle()
          if (cert) {
            cert_type_name = (cert as any).name ?? cert_type_name
            if ((cert as any).code) {
              const codeVal = String((cert as any).code).trim()
              if (codeVal) cert_type_code = codeVal
            }
            cert_type_rate = typeof (cert as any).rate === 'number' ? (cert as any).rate : (typeof (cert as any).amount === 'number' ? (cert as any).amount : (typeof (cert as any).multiplier === 'number' ? (cert as any).multiplier : null))
          }
        } else {
          const { data: cert } = await supabase
            .from('cert_types')
            .select('id,name,pricing_type,amount')
            .eq('name', String(certTypeId))
            .maybeSingle()
          if (cert) {
            cert_type_name = (cert as any).name ?? cert_type_name
            if ((cert as any).code) {
              const codeVal = String((cert as any).code).trim()
              if (codeVal) cert_type_code = codeVal
            }
            cert_type_rate = typeof (cert as any).rate === 'number' ? (cert as any).rate : (typeof (cert as any).amount === 'number' ? (cert as any).amount : (typeof (cert as any).multiplier === 'number' ? (cert as any).multiplier : null))
          }
        }
      }
    }
    if (!cert_type_name && typeof intended_use === 'string' && intended_use.trim()) {
      const term = intended_use.trim()
      let { data: certByName } = await supabase
        .from('cert_types')
        .select('id,name,pricing_type,amount')
        .ilike('name', term)
        .maybeSingle()
      if (!certByName) {
        const like = term.includes('cert') ? '%cert%' : `%${term}%`
        const { data } = await supabase
          .from('cert_types')
          .select('id,name,pricing_type,amount')
          .ilike('name', like)
          .limit(1)
          .maybeSingle()
        certByName = data as any
      }
      if (certByName) {
        cert_type_name = (certByName as any).name ?? cert_type_name
        cert_type_rate = typeof (certByName as any).amount === 'number' ? (certByName as any).amount : cert_type_rate
      }
    }
  } catch {}

  // Existing sub-order rows
  const { data: subOrders } = await supabase
    .from('quote_sub_orders')
    .select('id,document_label,billable_pages,language_tier_multiplier,language_multiplier,unit_rate,amount_pages,certification_type_code,certification_type_name,certification_amount,line_total')
    .eq('quote_id', quote_id)

  const certAmt = typeof cert_type_rate === 'number' ? cert_type_rate : 0
  const preview = (subOrders || []).map((r: any) => {
    const pages = typeof r.billable_pages === 'number' ? r.billable_pages : 0
    const tierMult = typeof r.language_multiplier === 'number' ? r.language_multiplier : (typeof r.language_tier_multiplier === 'number' ? r.language_tier_multiplier : (tier_multiplier ?? 1))
    const unit = roundUpTo(baseRate * (tierMult || 1), 2.5)
    const amtPages = Number((pages * unit).toFixed(2))
    const lineTotal = Number((amtPages + certAmt).toFixed(2))
    return {
      id: r.id,
      document_label: r.document_label,
      billable_pages: pages,
      language_multiplier: typeof r.language_multiplier === 'number' ? r.language_multiplier : null,
      language_tier_multiplier: typeof r.language_tier_multiplier === 'number' ? r.language_tier_multiplier : null,
      unit_rate: Number(unit.toFixed(2)),
      amount_pages: amtPages,
      certification_type_code: r.certification_type_code || null,
      certification_type_name: r.certification_type_name || null,
      certification_amount: certAmt,
      line_total: lineTotal,
    }
  })

  const docs: any[] = Array.isArray((res as any)?.results_json?.documents) ? (res as any).results_json.documents : []

  return NextResponse.json({
    quote_id,
    base_rate: baseRate,
    inputs: {
      source_lang,
      target_lang,
      intended_use: intended_use || null,
      intended_use_id: intended_use_id ?? null,
      source_code: source_code || null,
      target_code: target_code || null,
      country: country || null,
      country_code: country_code || null,
    },
    resolved: {
      tier_name,
      tier_multiplier,
      cert_type_name,
      cert_type_code,
      cert_type_rate,
    },
    existing_sub_orders: subOrders || [],
    preview_updates: preview,
    results_documents: docs,
  })
}
