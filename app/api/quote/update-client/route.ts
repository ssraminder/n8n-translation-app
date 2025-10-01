import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function jobIdFromQuote(id: string) {
  let h = 0 >>> 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const num = (h % 90000) + 10000
  return `CS${num}`
}

export async function POST(req: NextRequest) {
  const payload = await req.json()
  const { quote_id, client_name, client_email, phone } = payload || {}
  if (!quote_id || !client_name || !client_email) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  }

  const supabaseUrl = process.env.SUPABASE_URL as string
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined
  const anonKey = process.env.SUPABASE_ANON_KEY as string
  const supabase = createClient(supabaseUrl, serviceKey || anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // Optional: create or find customer by email
  let customer_id: string | null = null
  try {
    const { data: existing } = await supabase.from('customers').select('id').eq('email', client_email).maybeSingle()
    if (existing?.id) {
      customer_id = existing.id as any
    } else {
      const { data: created } = await supabase.from('customers').insert({ name: client_name, email: client_email, phone: phone || null }).select('id').single()
      customer_id = (created as any)?.id || null
    }
  } catch (_) {
    customer_id = null
  }

  // Optional selections from step 3
  const source_lang = typeof payload?.source_lang === 'string' ? payload.source_lang : undefined
  const target_lang = typeof payload?.target_lang === 'string' ? payload.target_lang : undefined
  const intended_use: string | undefined = typeof payload?.intended_use === 'string' ? payload.intended_use : undefined
  const intended_use_id: number | undefined = typeof payload?.intended_use_id === 'number' ? payload.intended_use_id : (typeof payload?.intended_use_id === 'string' ? parseInt(payload.intended_use_id, 10) : undefined)
  const source_code: string | undefined = typeof payload?.source_code === 'string' ? payload.source_code : undefined
  const target_code: string | undefined = typeof payload?.target_code === 'string' ? payload.target_code : undefined
  const country: string | undefined = typeof payload?.country === 'string' ? payload.country : undefined
  const country_code: string | undefined = typeof payload?.country_code === 'string' ? payload.country_code : undefined

  const update: Record<string, any> = { status: 'submitted', name: client_name, email: client_email, client_email }
  if (typeof phone === 'string' && phone) update.phone = phone
  if (source_lang) update.source_lang = source_lang
  if (target_lang) update.target_lang = target_lang
  if (typeof intended_use === 'string') update.intended_use = intended_use
  // Note: we intentionally do not write intended_use_id/source_code/target_code/country/country_code to DB to avoid schema mismatches

  const { error } = await supabase
    .from('quote_submissions')
    .update(update)
    .eq('quote_id', quote_id)
  if (error) {
    return NextResponse.json({ error: 'DB_ERROR', details: error.message }, { status: 500 })
  }

  // Fire webhook only when step 3 fields are present
  const hasStep3 = Boolean(
    (source_lang && source_lang.trim()) ||
    (target_lang && target_lang.trim()) ||
    typeof intended_use_id === 'number' ||
    (source_code && source_code.trim()) ||
    (target_code && target_code.trim()) ||
    (country && country.trim()) ||
    (country_code && country_code.trim())
  )
  if (hasStep3) {
    const env = { STEP3: process.env.N8N_STEP3_WEBHOOK_URL, PRIMARY: process.env.N8N_WEBHOOK_URL }
    const webhook = env.STEP3 || env.PRIMARY
    if (webhook) {
      // Compute tier/multiplier from languages (+ flexible columns) and tiers
      let tier_name: string | null = null
      let tier_multiplier: number | null = null

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

      try {
        let tierRow = await resolveLangTierFlexible(source_code, source_lang)
        if (!tierRow) tierRow = await resolveLangTierFlexible(target_code, target_lang)
        if (tierRow) {
          tier_name = (tierRow as any).name ?? tier_name
          tier_multiplier = typeof (tierRow as any).multiplier === 'number' ? (tierRow as any).multiplier : tier_multiplier
        }
      } catch (_) {}

      // Compute cert type name + rate from intended_use_id → intended_use_cert_map → cert_type(s)
      let cert_type_name: string | null = null
      let cert_type_rate: number | null = null
      try {
        if (typeof intended_use_id === 'number') {
          const { data: mapRow } = await supabase
            .from('intended_use_cert_map')
            .select('*')
            .eq('intended_use_id', intended_use_id)
            .maybeSingle()
          const certTypeId: number | string | null = mapRow ? ((mapRow as any).cert_type_id ?? (mapRow as any).cert_type ?? null) : null
          if (certTypeId !== null) {
            if (typeof certTypeId === 'number') {
              const { data: cert } = await supabase
                .from('cert_types')
                .select('id,name,amount,pricing_type,multiplier,rate')
                .eq('id', certTypeId)
                .maybeSingle()
              if (cert) {
                cert_type_name = (cert as any).name ?? null
                cert_type_rate = typeof (cert as any).rate === 'number' ? (cert as any).rate : (typeof (cert as any).amount === 'number' ? (cert as any).amount : (typeof (cert as any).multiplier === 'number' ? (cert as any).multiplier : null))
              }
            } else {
              const { data: cert } = await supabase
                .from('cert_types')
                .select('id,name,amount,pricing_type,multiplier,rate')
                .eq('name', String(certTypeId))
                .maybeSingle()
              if (cert) {
                cert_type_name = (cert as any).name ?? null
                cert_type_rate = typeof (cert as any).rate === 'number' ? (cert as any).rate : (typeof (cert as any).amount === 'number' ? (cert as any).amount : (typeof (cert as any).multiplier === 'number' ? (cert as any).multiplier : null))
              }
            }
          }
        }
        if (!cert_type_name && typeof intended_use === 'string' && intended_use.trim()) {
          const term = intended_use.trim()
          let { data: certByName } = await supabase
            .from('cert_types')
            .select('id,name,amount,pricing_type,multiplier,rate')
            .ilike('name', term)
            .maybeSingle()
          if (!certByName) {
            const like = term.includes('cert') ? '%cert%' : `%${term}%`
            const { data } = await supabase
              .from('cert_types')
              .select('id,name,amount,pricing_type,multiplier,rate')
              .ilike('name', like)
              .limit(1)
              .maybeSingle()
            certByName = data as any
          }
          if (certByName) {
            cert_type_name = (certByName as any).name ?? null
            cert_type_rate = typeof (certByName as any).rate === 'number' ? (certByName as any).rate : (typeof (certByName as any).amount === 'number' ? (certByName as any).amount : (typeof (certByName as any).multiplier === 'number' ? (certByName as any).multiplier : null))
          }
        }
      } catch (_) {}

      // Retry a few times if fields are still null before firing webhook
      let attempts = 0
      while (attempts < 3 && (tier_multiplier == null || cert_type_name == null || cert_type_rate == null)) {
        attempts++
        await new Promise(r => setTimeout(r, 200))
        try {
          // re-attempt language tier
          if (tier_multiplier == null) {
            let tr = await (async ()=>{
              let t = await resolveLangTierFlexible(source_code, source_lang)
              if (!t) t = await resolveLangTierFlexible(target_code, target_lang)
              return t
            })()
            if (tr) {
              tier_name = (tr as any).name ?? tier_name
              tier_multiplier = typeof (tr as any).multiplier === 'number' ? (tr as any).multiplier : tier_multiplier
            }
          }
          // re-attempt cert by intended_use text only
          if ((cert_type_name == null || cert_type_rate == null) && typeof intended_use === 'string' && intended_use.trim()) {
            const term = intended_use.trim()
            const { data: cert } = await supabase
              .from('cert_types')
              .select('id,name,amount,pricing_type,multiplier,rate')
              .ilike('name', `%${term}%`)
              .limit(1)
              .maybeSingle()
            if (cert) {
              cert_type_name = (cert as any).name ?? cert_type_name
              const rate = typeof (cert as any).rate === 'number' ? (cert as any).rate : (typeof (cert as any).amount === 'number' ? (cert as any).amount : (typeof (cert as any).multiplier === 'number' ? (cert as any).multiplier : null))
              cert_type_rate = rate ?? cert_type_rate
            }
          }
        } catch (_) {}
      }

      const payloadOut = {
        event: 'quote_updated',
        quote_id,
        job_id: jobIdFromQuote(quote_id),
        source_language: source_lang || '',
        target_language: target_lang || '',
        intended_use_id: typeof intended_use_id === 'number' ? intended_use_id : null,
        source_code: source_code || null,
        target_code: target_code || null,
        country: country || '',
        country_code: country_code || null,
        tier: tier_name,
        tier_multiplier: tier_multiplier,
        cert_type_name: cert_type_name,
        cert_type_rate: cert_type_rate
      }

      if (tier_multiplier != null && cert_type_name != null && cert_type_rate != null) {
        await fetch(webhook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payloadOut) })
      } else {
        try {
          await supabase.from('quote_submissions').update({ hitl_requested: true }).eq('quote_id', quote_id)
        } catch (_) {}
        const hitlPayload: any = {
          quote_id,
          hitl_requested: true,
          job_id: jobIdFromQuote(quote_id),
          source_language: source_lang || '',
          target_language: target_lang || '',
          intended_use: typeof intended_use === 'string' ? intended_use : '',
          country_of_issue: country || ''
        }
        try {
          if (!hitlPayload.country_of_issue) {
            const { data: res } = await supabase.from('quote_results').select('results_json').eq('quote_id', quote_id).maybeSingle()
            hitlPayload.country_of_issue = (res as any)?.results_json?.country_of_issue || ''
          }
        } catch (_) {}
        if (process.env.N8N_WEBHOOK_URL) {
          await fetch(String(process.env.N8N_WEBHOOK_URL), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(hitlPayload) }).catch(()=>{})
        }
      }
    }
  }

  return NextResponse.json({ ok: true, customer_id })
}
