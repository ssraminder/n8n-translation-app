import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function jobIdFromQuote(id: string) {
  let h = 0 >>> 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const num = (h % 90000) + 10000
  return `CS${num}`
}

function stringOrNull(...values: (string | null | undefined)[]) {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed) return trimmed
    }
  }
  return undefined
}

function numberOrNull(...values: (number | string | null | undefined)[]) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return undefined
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

  // Optional: create or find customer by email (only if provided)
  let customer_id: string | null = null
  try {
    const email = typeof client_email === 'string' ? client_email.trim() : ''
    if (email) {
      const { data: existing } = await supabase.from('customers').select('id').eq('email', email).maybeSingle()
      if (existing?.id) {
        customer_id = existing.id as any
      } else {
        const { data: created } = await supabase
          .from('customers')
          .insert({ name: client_name || null, email, phone: phone || null })
          .select('id')
          .single()
        customer_id = (created as any)?.id || null
      }
    }
  } catch (_) {
    customer_id = null
  }

  const { data: existingSubmission } = await supabase
    .from('quote_submissions')
    .select('*')
    .eq('quote_id', quote_id)
    .maybeSingle()

  if (!existingSubmission) {
    return NextResponse.json({ error: 'QUOTE_NOT_FOUND' }, { status: 404 })
  }

  const existingRow = existingSubmission as any
  const payloadInputs = (typeof payload?.inputs === 'object' && payload.inputs) ? payload.inputs : undefined
  const payloadResolved = (typeof payload?.resolved === 'object' && payload.resolved) ? payload.resolved : undefined

  const finalName = stringOrNull(client_name, existingRow?.name)
  const finalEmail = stringOrNull(client_email, existingRow?.email, existingRow?.client_email)
  const finalPhone = stringOrNull(phone, existingRow?.phone)

  const finalSourceLang = stringOrNull(payload?.source_lang, payloadInputs?.source_lang, existingRow?.source_lang)
  const finalTargetLang = stringOrNull(payload?.target_lang, payloadInputs?.target_lang, existingRow?.target_lang)
  const finalIntendedUse = stringOrNull(payload?.intended_use, payloadInputs?.intended_use, existingRow?.intended_use)
  const intendedUseIdCandidate = numberOrNull(payload?.intended_use_id, payloadInputs?.intended_use_id, existingRow?.intended_use_id)
  const finalIntendedUseId = typeof intendedUseIdCandidate === 'number' ? intendedUseIdCandidate : null
  const finalSourceCode = stringOrNull(payload?.source_code, payloadInputs?.source_code, existingRow?.source_code)
  const finalTargetCode = stringOrNull(payload?.target_code, payloadInputs?.target_code, existingRow?.target_code)
  let finalCountry = stringOrNull(payload?.country, payloadInputs?.country, existingRow?.country_of_issue) ?? null
  const finalCountryCode = stringOrNull(payload?.country_code, payloadInputs?.country_code, existingRow?.country_code)

  let tierName = stringOrNull(payloadResolved?.tier_name, existingRow?.tier_name, existingRow?.language_tier) ?? null
  let tierMultiplier = numberOrNull(payloadResolved?.tier_multiplier, existingRow?.tier_multiplier, existingRow?.language_tier_multiplier) ?? null
  let certTypeName = stringOrNull(payloadResolved?.cert_type_name, existingRow?.cert_type_name) ?? null
  let certTypeRate = numberOrNull(payloadResolved?.cert_type_rate, existingRow?.cert_type_rate, existingRow?.cert_type_amount) ?? null
  let certTypeCode = stringOrNull(payloadResolved?.cert_type_code, existingRow?.cert_type_code) ?? null
  let storedBaseRate = numberOrNull(payload?.base_rate, payloadResolved?.base_rate, existingRow?.base_rate, baseRate) ?? baseRate

  async function resolveLangTierFlexible(code?: string | null, name?: string | null) {
    if (code && code.trim()) {
      const { data: byCode } = await supabase.from('languages').select('*').eq('iso_code', code.trim()).maybeSingle()
      if (byCode) {
        const tname = (byCode as any).tier || null
        if (tname) {
          const { data: tierRow } = await supabase.from('language_tiers').select('name,multiplier').eq('name', tname).maybeSingle()
          if (tierRow) return tierRow as any
          return { name: tname, multiplier: null as any }
        }
      }
    }
    if (name && name.trim()) {
      const { data: byName } = await supabase.from('languages').select('*').ilike('language', name.trim()).maybeSingle()
      if (byName) {
        const tname = (byName as any).tier || null
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
    if (!tierName || tierMultiplier === null) {
      const srcTier = await resolveLangTierFlexible(finalSourceCode, finalSourceLang)
      const tgtTier = await resolveLangTierFlexible(finalTargetCode, finalTargetLang)
      const candidates: { name: string | null; multiplier: number | null }[] = []
      if (srcTier) candidates.push({ name: (srcTier as any).name ?? null, multiplier: typeof (srcTier as any).multiplier === 'number' ? (srcTier as any).multiplier : null })
      if (tgtTier) candidates.push({ name: (tgtTier as any).name ?? null, multiplier: typeof (tgtTier as any).multiplier === 'number' ? (tgtTier as any).multiplier : null })
      if (candidates.length) {
        let chosen = candidates[0]
        for (const candidate of candidates.slice(1)) {
          const current = Number(chosen.multiplier ?? 0)
          const next = Number(candidate.multiplier ?? 0)
          if (next > current) chosen = candidate
        }
        if (candidates.length === 2 && (candidates[0].multiplier === candidates[1].multiplier) && candidates[0].name && candidates[0].name === candidates[1].name) {
          tierName = candidates[0].name
          tierMultiplier = candidates[0].multiplier
        } else {
          tierName = chosen.name
          tierMultiplier = chosen.multiplier
        }
      }
    }
  } catch (_) {}

  try {
    if (typeof finalIntendedUseId === 'number') {
      const { data: mapRow } = await supabase.from('intended_use_cert_map').select('cert_type_id').eq('intended_use_id', finalIntendedUseId).maybeSingle()
      if (mapRow?.cert_type_id) {
        const { data: certRow } = await supabase.from('cert_types').select('id,name,pricing_type,amount').eq('id', mapRow.cert_type_id).maybeSingle()
        if (certRow) {
          if (!certTypeName && (certRow as any).name) certTypeName = String((certRow as any).name)
          const rawAmount = (certRow as any).amount
          if (certTypeRate === null && typeof rawAmount === 'number') certTypeRate = rawAmount
        }
      }
      if (!certTypeName || certTypeRate === null) {
        const { data: intendedUseRow } = await supabase.from('intended_uses').select('certification_type,certification_price').eq('id', finalIntendedUseId).maybeSingle()
        if (intendedUseRow) {
          if (!certTypeName && (intendedUseRow as any).certification_type) certTypeName = String((intendedUseRow as any).certification_type)
          const price = (intendedUseRow as any).certification_price
          if (certTypeRate === null && price !== null && price !== undefined) {
            const parsed = Number(price)
            if (Number.isFinite(parsed)) certTypeRate = parsed
          }
        }
      }
    }
  } catch (_) {}

  if (certTypeRate !== null) {
    certTypeRate = Number(certTypeRate)
  }

  if (!finalCountry) {
    try {
      const { data: resultsRow } = await supabase.from('quote_results').select('results_json').eq('quote_id', quote_id).maybeSingle()
      const extractedCountry = (resultsRow as any)?.results_json?.country_of_issue
      if (typeof extractedCountry === 'string') {
        const normalized = stringOrNull(extractedCountry)
        if (normalized) finalCountry = normalized
      }
    } catch (_) {}
  }

  const finalStatus = finalName && finalEmail ? 'submitted' : (stringOrNull(existingRow?.status) ?? null)
  const finalJobId = existingRow?.job_id || jobIdFromQuote(quote_id)
  const baseRateForStorage = Number(storedBaseRate)
  const tierMultiplierValue = tierMultiplier !== null ? Number(tierMultiplier) : null

  const finalUpdate: Record<string, any> = {
    status: finalStatus ?? null,
    name: finalName ?? null,
    email: finalEmail ?? null,
    client_email: finalEmail ?? null,
    phone: finalPhone ?? null,
    source_lang: finalSourceLang ?? null,
    target_lang: finalTargetLang ?? null,
    intended_use: finalIntendedUse ?? null,
    intended_use_id: typeof finalIntendedUseId === 'number' ? finalIntendedUseId : null,
    source_code: finalSourceCode ?? null,
    target_code: finalTargetCode ?? null,
    country_of_issue: finalCountry ?? null,
    country_code: finalCountryCode ?? null,
    base_rate: baseRateForStorage,
    tier_name: tierName ?? null,
    tier_multiplier: tierMultiplierValue,
    language_tier: tierName ?? null,
    language_tier_multiplier: tierMultiplierValue,
    cert_type_name: certTypeName ?? null,
    cert_type_amount: certTypeRate ?? null,
    cert_type_rate: certTypeRate ?? null,
    cert_type_code: certTypeCode ?? null,
    job_id: finalJobId,
  }

  let persistedStep3Data = false
  const allowedKeys = existingRow ? Object.keys(existingRow) : []
  const filteredUpdate = Object.fromEntries(Object.entries(finalUpdate).filter(([k]) => allowedKeys.includes(k)))
  const { error: updateError } = await supabase.from('quote_submissions').update(filteredUpdate).eq('quote_id', quote_id)
  if (updateError) {
    return NextResponse.json({ error: 'DB_ERROR', details: updateError.message }, { status: 500 })
  }
  persistedStep3Data = true

  if (persistedStep3Data) {
    const env = { STEP3: process.env.N8N_STEP3_WEBHOOK_URL, PRIMARY: process.env.N8N_WEBHOOK_URL }

    if (env.STEP3) {
      const step3Payload = {
        event: 'quote_step3_updated',
        quote_id,
        job_id: finalJobId,
        base_rate: baseRateForStorage,
        inputs: {
          source_lang: finalSourceLang ?? null,
          target_lang: finalTargetLang ?? null,
          intended_use: finalIntendedUse ?? null,
          intended_use_id: typeof finalIntendedUseId === 'number' ? finalIntendedUseId : null,
          source_code: finalSourceCode ?? null,
          target_code: finalTargetCode ?? null,
          country: finalCountry ?? null,
          country_code: finalCountryCode ?? null,
        },
        resolved: {
          tier_name: tierName ?? null,
          tier_multiplier: tierMultiplierValue,
          cert_type_name: certTypeName ?? null,
          cert_type_code: certTypeCode ?? null,
          cert_type_rate: certTypeRate ?? null,
        },
      }
      try {
        await fetch(env.STEP3, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(step3Payload),
        })
      } catch (err) {
        console.error('STEP3_WEBHOOK_FAILED', err)
      }
    }

    try {
      const meta: Record<string, any> = {}
      if (finalSourceLang) meta.source_lang = finalSourceLang
      if (finalTargetLang) meta.target_lang = finalTargetLang
      if (typeof finalIntendedUseId === 'number') meta.intended_use_id = finalIntendedUseId
      if (finalCountry) meta.country_of_issue = finalCountry
      if (Object.keys(meta).length) await supabase.from('quote_files').update(meta).eq('quote_id', quote_id)
    } catch (_) {}

    // Skip price calculations here as requested
  }

  return NextResponse.json({ ok: true, customer_id })
}
