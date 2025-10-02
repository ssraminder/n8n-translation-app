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
  if (!quote_id) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 })
  }

  const supabaseUrl = process.env.SUPABASE_URL as string
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined
  const anonKey = process.env.SUPABASE_ANON_KEY as string
  const supabase = createClient(supabaseUrl, serviceKey || anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

  let baseRate = 40
  try {
    const { data: settings } = await supabase.from('app_settings').select('base_rate').maybeSingle()
    if (settings?.base_rate !== null && settings?.base_rate !== undefined) {
      const val = Number(settings.base_rate)
      if (Number.isFinite(val)) baseRate = val
    }
  } catch (_) {}

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

  const update: Record<string, any> = {}
  if (typeof client_name === 'string' && client_name && typeof client_email === 'string' && client_email) {
    update.status = 'submitted'
    update.name = client_name
    update.email = client_email
    update.client_email = client_email
  }
  if (typeof phone === 'string' && phone) update.phone = phone
  if (source_lang) update.source_lang = source_lang
  if (target_lang) update.target_lang = target_lang
  if (typeof intended_use === 'string') update.intended_use = intended_use
  if (typeof country === 'string' && country) update.country_of_issue = country
  if (typeof intended_use_id === 'number' && Number.isFinite(intended_use_id)) update.intended_use_id = intended_use_id
  if (typeof source_code === 'string' && source_code) update.source_code = source_code
  if (typeof target_code === 'string' && target_code) update.target_code = target_code
  if (typeof country_code === 'string' && country_code) update.country_code = country_code

  if (Object.keys(update).length) {
    const { error } = await supabase
      .from('quote_submissions')
      .update(update)
      .eq('quote_id', quote_id)
    if (error) {
      return NextResponse.json({ error: 'DB_ERROR', details: error.message }, { status: 500 })
    }
    persistedStep3Data = true
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
  let persistedStep3Data = false
  if (hasStep3) {
    const env = { STEP3: process.env.N8N_STEP3_WEBHOOK_URL, PRIMARY: process.env.N8N_WEBHOOK_URL }
    {
      // Compute tier/multiplier from languages (+ flexible columns) and tiers
      let tier_name: string | null = null
      let tier_multiplier: number | null = null

      async function resolveLangTierFlexible(code?: string, name?: string) {
        const q = supabase.from('languages').select('*').limit(1)
        if (code && code.trim()) {
          const c = code.trim()
          const { data: langByCode } = await supabase.from('languages').select('*').eq('iso_code', c).maybeSingle()
          if (langByCode) {
            const tname = (langByCode as any).tier || null
            if (tname) {
              const { data: tierRow } = await supabase.from('language_tiers').select('name,multiplier').eq('name', tname).maybeSingle()
              if (tierRow) return tierRow as any
              return { name: tname, multiplier: null as any }
            }
          }
        }
        if (name && name.trim()) {
          const n = name.trim()
          const { data: langByName } = await supabase.from('languages').select('*').ilike('language', n).maybeSingle()
          if (langByName) {
            const tname = (langByName as any).tier || null
            if (tname) {
              const { data: tierRow } = await supabase.from('language_tiers').select('name,multiplier').eq('name', tname).maybeSingle()
              if (tierRow) return tierRow as any
              return { name: tname, multiplier: null as any }
            }
          }
        }
        return null as any
      }

      try {
        const src = await resolveLangTierFlexible(source_code, source_lang)
        const tgt = await resolveLangTierFlexible(target_code, target_lang)
        const cand: { name: string | null; multiplier: number | null }[] = []
        if (src) cand.push({ name: (src as any).name ?? null, multiplier: typeof (src as any).multiplier === 'number' ? (src as any).multiplier : null })
        if (tgt) cand.push({ name: (tgt as any).name ?? null, multiplier: typeof (tgt as any).multiplier === 'number' ? (tgt as any).multiplier : null })
        if (cand.length) {
          // choose highest multiplier; if equal, keep common tier name if same
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
      } catch (_) {}

      // Compute cert type name + rate from intended_use_id → intended_use_cert_map → cert_type(s)
      let cert_type_name: string | null = null
      let cert_type_code: string | null = null
      let cert_type_rate: number | null = null
      try {
        if (typeof intended_use_id === 'number') {
          // mapping table → cert_types
          const { data: map } = await supabase.from('intended_use_cert_map').select('cert_type_id').eq('intended_use_id', intended_use_id).maybeSingle()
          if (map?.cert_type_id) {
            const { data: ct } = await supabase.from('cert_types').select('id,name,pricing_type,amount').eq('id', map.cert_type_id).maybeSingle()
            if (ct) {
              cert_type_name = (ct as any).name || null
              cert_type_rate = typeof (ct as any).amount === 'number' ? (ct as any).amount : null
            }
          }
          // fallback to intended_uses own columns
          if (!cert_type_name) {
            const { data: iu } = await supabase.from('intended_uses').select('certification_type,certification_price').eq('id', intended_use_id).maybeSingle()
            if (iu) {
              cert_type_name = (iu as any).certification_type || cert_type_name
              const price = (iu as any).certification_price
              if (price !== null && price !== undefined) cert_type_rate = Number(price)
            }
          }
        }
      } catch (_) {}

      // No retries needed with direct schema lookups

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
        cert_type_code: cert_type_code,
        cert_type_rate: cert_type_rate
      }

      // Update quote_submissions fields with resolved tier/cert and country
      try {
        let country_of_issue: string | null = (typeof country === 'string' && country) ? country : null
        if (!country_of_issue) {
          const { data: res } = await supabase.from('quote_results').select('results_json').eq('quote_id', quote_id).maybeSingle()
          country_of_issue = (res as any)?.results_json?.country_of_issue || null
        }
        const subUpdates: Record<string, any> = {}
        if (country_of_issue) subUpdates.country_of_issue = country_of_issue
        if (tier_name != null) subUpdates.language_tier = tier_name
        if (tier_multiplier != null) subUpdates.language_tier_multiplier = tier_multiplier
        if (cert_type_name != null) subUpdates.cert_type_name = cert_type_name
        if (cert_type_rate != null) subUpdates.cert_type_amount = cert_type_rate
        if (Object.keys(subUpdates).length) {
          await supabase.from('quote_submissions').update(subUpdates).eq('quote_id', quote_id)
          persistedStep3Data = true
        }
      } catch (_) {}

      if (env.STEP3 && persistedStep3Data) {
        const step3Payload = {
          event: 'quote_step3_updated',
          quote_id,
          job_id: jobIdFromQuote(quote_id),
          base_rate: baseRate,
          inputs: {
            source_lang: source_lang || null,
            target_lang: target_lang || null,
            intended_use: intended_use || null,
            intended_use_id: typeof intended_use_id === 'number' ? intended_use_id : null,
            source_code: source_code || null,
            target_code: target_code || null,
            country: country || null,
            country_code: country_code || null
          },
          resolved: {
            tier_name,
            tier_multiplier,
            cert_type_name,
            cert_type_code,
            cert_type_rate
          }
        }
        try {
          await fetch(env.STEP3, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(step3Payload)
          })
        } catch (err) {
          console.error('STEP3_WEBHOOK_FAILED', err)
        }
      }

      // Update quote_files metadata with selected fields (best-effort)
      try {
        const meta: Record<string, any> = {}
        if (typeof source_lang === 'string') meta.source_lang = source_lang
        if (typeof target_lang === 'string') meta.target_lang = target_lang
        if (typeof intended_use_id === 'number') meta.intended_use_id = intended_use_id
        if (typeof country === 'string') meta.country_of_issue = country
        if (Object.keys(meta).length) await supabase.from('quote_files').update(meta).eq('quote_id', quote_id)
      } catch (_) {}

      // Skip price calculations here as requested
    }
  }

  return NextResponse.json({ ok: true, customer_id })
}
