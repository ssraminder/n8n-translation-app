import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const quote_id = searchParams.get('quote_id') || ''
  if (!quote_id) return NextResponse.json({ error: 'MISSING_QUOTE_ID' }, { status: 400 })

  const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string)

  // Check status first
  const { data: sub, error: subErr } = await supabase
    .from('quote_submissions')
    .select('quote_id,status')
    .eq('quote_id', quote_id)
    .maybeSingle()
  if (subErr) return NextResponse.json({ error: 'DB_ERROR', details: subErr.message }, { status: 500 })
  if (!sub) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  const status = (sub as any).status || 'pending'
  if (!['ready', 'completed'].includes(status)) {
    return NextResponse.json({ error: 'NOT_READY', status }, { status: 409 })
  }

  // Try primary source: quote_sub_orders
  const { data: items, error: itemsErr } = await supabase
    .from('quote_sub_orders')
    .select('document_label,billable_pages,language_tier_multiplier,unit_rate,amount_pages,certification_type_code,certification_type_name,certification_amount,line_total')
    .eq('quote_id', quote_id)
    .order('id', { ascending: true })
  if (itemsErr) return NextResponse.json({ error: 'DB_ERROR', details: itemsErr.message }, { status: 500 })

  let lineItems = (items || []).map((r: any) => ({
    document_label: r.document_label,
    billable_pages: Number(r.billable_pages ?? 0),
    language_tier_multiplier: Number(r.language_tier_multiplier ?? 1),
    unit_rate: Number(r.unit_rate ?? 0),
    amount_pages: Number(r.amount_pages ?? 0),
    certification_type_code: r.certification_type_code ?? null,
    certification_type_name: r.certification_type_name ?? null,
    certification_amount: Number(r.certification_amount ?? 0),
    line_total: Number(r.line_total ?? 0),
  }))

  // Fallback: derive from quote_results if orders are missing (race conditions)
  if (!lineItems.length) {
    const { data: res, error: resErr } = await supabase
      .from('quote_results')
      .select('results_json')
      .eq('quote_id', quote_id)
      .maybeSingle()
    if (resErr) return NextResponse.json({ error: 'DB_ERROR', details: resErr.message }, { status: 500 })

    const docs: any[] = Array.isArray((res as any)?.results_json?.documents)
      ? (res as any).results_json.documents
      : []

    // Build a best-effort representation from results_json
    lineItems = docs.map((d: any) => {
      const label = d.document_type || d.filename || d.label || 'document'
      const pagesNum = typeof d.pages === 'number' ? d.pages : (typeof d.billable_pages === 'number' ? d.billable_pages : 0)
      const mult = typeof d.language_multiplier === 'number' ? d.language_multiplier : (typeof d.language_tier_multiplier === 'number' ? d.language_tier_multiplier : 1)
      const unit = typeof d.unit_rate === 'number' ? d.unit_rate : Number((Math.ceil((65 * (mult || 1)) / 2.5) * 2.5).toFixed(2))
      const amountPages = Number((pagesNum * unit).toFixed(2))
      const certAmt = typeof d.certification_amount === 'number' ? d.certification_amount : 0
      const lineTotal = typeof d.line_total === 'number' ? d.line_total : Number((amountPages + certAmt).toFixed(2))
      return {
        document_label: label,
        billable_pages: Number(pagesNum.toFixed?.(2) ?? pagesNum),
        language_tier_multiplier: Number((mult || 1).toFixed?.(3) ?? (mult || 1)),
        unit_rate: Number(unit.toFixed?.(2) ?? unit),
        amount_pages: amountPages,
        certification_type_code: d.certification_type_code ?? null,
        certification_type_name: d.certification_type_name ?? null,
        certification_amount: certAmt,
        line_total: lineTotal,
      }
    })

    // Backfill orders for consistency (best effort, do not fail response)
    if (lineItems.length) {
      try {
        const rows = lineItems.map((li: any) => ({
          quote_id,
          document_label: li.document_label,
          billable_pages: li.billable_pages,
          language_tier_multiplier: li.language_tier_multiplier,
          unit_rate: li.unit_rate,
          amount_pages: li.amount_pages,
          certification_type_code: li.certification_type_code,
          certification_type_name: li.certification_type_name,
          certification_amount: li.certification_amount,
          line_total: li.line_total,
        }))
        // Clear then insert so totals stay correct if recomputed
        await supabase.from('quote_sub_orders').delete().eq('quote_id', quote_id)
        if (rows.length) await supabase.from('quote_sub_orders').insert(rows)
      } catch (_) {
        // ignore backfill failures
      }
    }
  }

  const subtotal = Number(lineItems.reduce((a, b) => a + (b.line_total || 0), 0).toFixed(2))
  let taxRate = 0.05
  try {
    const { data: settings } = await supabase.from('app_settings').select('gst_rate').maybeSingle()
    if (settings?.gst_rate !== null && settings?.gst_rate !== undefined) {
      const v = Number(settings.gst_rate)
      if (Number.isFinite(v)) taxRate = v
    }
  } catch {}
  const tax = Number((subtotal * taxRate).toFixed(2))
  const total = Number((subtotal + tax).toFixed(2))

  return NextResponse.json({ quote_id, status, items: lineItems, subtotal, tax_rate: taxRate, tax, total })
}
